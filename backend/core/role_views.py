from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MachineAPIKey, Tenant, TenantRole
from .roles import ROLE_PERMISSIONS, can_manage_roles, permissions_for


class RoleInput(serializers.Serializer):
    id = serializers.UUIDField(required=False)
    name = serializers.CharField(max_length=80)
    permissions = serializers.ListField(child=serializers.ChoiceField(choices=ROLE_PERMISSIONS), max_length=100)
    users = serializers.ListField(child=serializers.IntegerField(min_value=1), max_length=1000)


class MemberRolesInput(serializers.Serializer):
    user_id = serializers.IntegerField(min_value=1)
    role_ids = serializers.ListField(child=serializers.UUIDField(), max_length=100)


class NewMemberInput(MemberRolesInput):
    role_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1, max_length=100)


def _may_assign_admin(user, tenant):
    return user.is_superuser or tenant.created_by_id == user.pk


class RolesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.tenant
        if isinstance(request.auth, MachineAPIKey) or not tenant.user_has_access(request.user):
            raise PermissionDenied()
        manageable = can_manage_roles(request.user, tenant)
        roles = list(TenantRole.objects.filter(tenant=tenant).prefetch_related("users")) if manageable else []
        from tenant_support.access import members

        member_list = list(members(tenant)) if manageable else []
        member_roles = {user.pk: [] for user in member_list}
        for role in roles:
            for user in role.users.all():
                if user.pk in member_roles:
                    member_roles[user.pk].append(str(role.pk))
        return Response(
            {
                "permissions": sorted(permissions_for(request.user, tenant)),
                "available_permissions": ROLE_PERMISSIONS if manageable else [],
                "can_manage": manageable,
                "can_grant_admin": _may_assign_admin(request.user, tenant) if manageable else False,
                "members": (
                    [
                        {
                            "id": u.pk,
                            "name": u.get_full_name() or u.username,
                            "role_ids": member_roles[u.pk],
                            "permissions": sorted(permissions_for(u, tenant)),
                            "is_owner": tenant.created_by_id == u.pk,
                            "is_system_owner": u.is_superuser,
                        }
                        for u in member_list
                    ]
                    if manageable
                    else []
                ),
                "roles": [
                    {"id": r.pk, "name": r.name, "permissions": r.permissions, "users": [u.pk for u in r.users.all()]}
                    for r in roles
                ],
            }
        )

    @transaction.atomic
    def post(self, request):
        Tenant.objects.select_for_update().get(pk=request.tenant.pk)
        if isinstance(request.auth, MachineAPIKey) or not can_manage_roles(request.user, request.tenant):
            raise PermissionDenied("Du saknar behörighet att hantera roller.")
        schema = RoleInput(data=request.data)
        schema.is_valid(raise_exception=True)
        data = schema.validated_data
        if "tenant.admin" in data["permissions"] and not _may_assign_admin(request.user, request.tenant):
            raise PermissionDenied("Only a workspace owner may grant workspace administration.")
        from tenant_support.access import members

        ids = set(data.pop("users"))
        if set(members(request.tenant).filter(pk__in=ids).values_list("pk", flat=True)) != ids:
            raise ValidationError({"users": "Alla användare måste vara aktiva medlemmar i arbetsytan."})
        pk = data.pop("id", None)
        if TenantRole.objects.filter(tenant=request.tenant, name=data["name"]).exclude(pk=pk).exists():
            raise ValidationError({"name": "Det finns redan en roll med det namnet."})
        from tenant_support.access import has_role, support_users
        from tenant_support.services import sync_support_inbox

        previous_support = {user.pk for user in support_users(request.tenant)}
        role = get_object_or_404(TenantRole, tenant=request.tenant, pk=pk) if pk else TenantRole(tenant=request.tenant)
        if pk and "tenant.admin" in role.permissions and not _may_assign_admin(request.user, request.tenant):
            raise PermissionDenied("Only a workspace owner may change an administrator role.")
        for name, value in data.items():
            setattr(role, name, value)
        role.save()
        role.users.set(ids)
        for user in members(request.tenant).filter(pk__in=ids - previous_support):
            if has_role(user, request.tenant, "can_support"):
                sync_support_inbox(request.tenant, user)
        return Response({"id": role.pk})

    @transaction.atomic
    def patch(self, request):
        tenant = Tenant.objects.select_for_update().get(pk=request.tenant.pk)
        if isinstance(request.auth, MachineAPIKey) or not can_manage_roles(request.user, tenant):
            raise PermissionDenied("Du saknar behörighet att hantera roller.")
        schema = MemberRolesInput(data=request.data)
        schema.is_valid(raise_exception=True)
        from tenant_support.access import members

        user = get_object_or_404(members(tenant), pk=schema.validated_data["user_id"])
        ids = set(schema.validated_data["role_ids"])
        roles = list(TenantRole.objects.filter(tenant=tenant, pk__in=ids))
        if len(roles) != len(ids):
            raise ValidationError({"role_ids": "All roles must belong to the current workspace."})
        if any("tenant.admin" in role.permissions for role in roles) and not _may_assign_admin(request.user, tenant):
            raise PermissionDenied("Only a workspace owner may grant workspace administration.")
        from tenant_support.access import has_role
        from tenant_support.services import sync_support_inbox

        previous_support = has_role(user, tenant, "can_support")
        for role in TenantRole.objects.filter(tenant=tenant, users=user):
            if role.pk not in ids:
                role.users.remove(user)
        for role in roles:
            role.users.add(user)
        if not previous_support and has_role(user, tenant, "can_support"):
            sync_support_inbox(tenant, user)
        return Response(
            {"role_ids": [str(role.pk) for role in roles], "permissions": sorted(permissions_for(user, tenant))}
        )


class WorkspaceMemberView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        tenant = Tenant.objects.select_for_update().get(pk=request.tenant.pk)
        if isinstance(request.auth, MachineAPIKey) or not request.user.is_superuser:
            raise PermissionDenied("Only a system owner may add an existing account to a workspace.")
        schema = NewMemberInput(data=request.data)
        schema.is_valid(raise_exception=True)
        user = get_object_or_404(get_user_model(), pk=schema.validated_data["user_id"], is_active=True)
        ids = set(schema.validated_data["role_ids"])
        roles = list(TenantRole.objects.filter(tenant=tenant, pk__in=ids))
        if len(roles) != len(ids):
            raise ValidationError({"role_ids": "All roles must belong to the current workspace."})
        tenant.members.add(user)
        for role in roles:
            role.users.add(user)
        from tenant_support.access import has_role
        from tenant_support.services import sync_support_inbox

        if has_role(user, tenant, "can_support"):
            sync_support_inbox(tenant, user)
        return Response({"id": user.pk, "role_ids": [str(role.pk) for role in roles]})
