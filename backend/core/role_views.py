from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import TenantRole, Tenant, MachineAPIKey
from .roles import permissions_for, can_manage_roles, ROLE_PERMISSIONS


class RoleInput(serializers.Serializer):
    id = serializers.UUIDField(required=False)
    name = serializers.CharField(max_length=80)
    permissions = serializers.ListField(child=serializers.ChoiceField(choices=ROLE_PERMISSIONS), max_length=100)
    users = serializers.ListField(child=serializers.IntegerField(min_value=1), max_length=1000)


class RolesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.tenant
        if isinstance(request.auth, MachineAPIKey) or not tenant.user_has_access(request.user):
            raise PermissionDenied()
        manageable = can_manage_roles(request.user, tenant)
        roles = TenantRole.objects.filter(tenant=tenant).prefetch_related("users") if manageable else []
        from tenant_support.access import members

        return Response(
            {
                "permissions": sorted(permissions_for(request.user, tenant)),
                "available_permissions": ROLE_PERMISSIONS if manageable else [],
                "can_manage": manageable,
                "members": (
                    [{"id": u.pk, "name": u.get_full_name() or u.username} for u in members(tenant)]
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
        from tenant_support.access import members

        ids = set(data.pop("users"))
        if set(members(request.tenant).filter(pk__in=ids).values_list("pk", flat=True)) != ids:
            raise ValidationError({"users": "Alla användare måste vara aktiva medlemmar i arbetsytan."})
        pk = data.pop("id", None)
        if TenantRole.objects.filter(tenant=request.tenant, name=data["name"]).exclude(pk=pk).exists():
            raise ValidationError({"name": "Det finns redan en roll med det namnet."})
        from tenant_support.access import support_users, has_role
        from tenant_support.services import sync_support_inbox
        previous_support = {user.pk for user in support_users(request.tenant)}
        role = get_object_or_404(TenantRole, tenant=request.tenant, pk=pk) if pk else TenantRole(tenant=request.tenant)
        for name, value in data.items():
            setattr(role, name, value)
        role.save()
        role.users.set(ids)
        for user in members(request.tenant).filter(pk__in=ids - previous_support):
            if has_role(user, request.tenant, "can_support"):
                sync_support_inbox(request.tenant, user)
        return Response({"id": role.pk})
