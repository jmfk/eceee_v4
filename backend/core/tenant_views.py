"""System-owner workspace administration."""

import re

from django.db import transaction
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .hostname_policy import hostname_allowed, policy_for
from .models import MachineAPIKey, Tenant, TenantRole

HOSTNAME_RE = re.compile(r"^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$")


class TenantInput(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    identifier = serializers.SlugField(max_length=100)


class PolicyInput(serializers.Serializer):
    mode = serializers.ChoiceField(choices=("unrestricted", "exact", "domains"))
    values = serializers.ListField(child=serializers.CharField(max_length=253), max_length=100)

    def validate(self, data):
        values = [value.lower().strip().rstrip(".") for value in data["values"]]
        if any(not HOSTNAME_RE.fullmatch(value) or ".." in value for value in values):
            raise serializers.ValidationError({"values": "Use hostnames without scheme, path, port or wildcard."})
        if data["mode"] == "domains" and any("." not in value for value in values):
            raise serializers.ValidationError({"values": "A domain must contain a dot."})
        data["values"] = sorted(set(values))
        return data


class TenantUpdate(serializers.Serializer):
    is_active = serializers.BooleanField(required=False)
    hostname_policy = PolicyInput(required=False)


def require_owner(request):
    if isinstance(request.auth, MachineAPIKey) or not request.user.is_superuser:
        raise PermissionDenied("Only a system owner may manage workspaces.")


def tenant_data(tenant):
    return {
        "id": str(tenant.pk),
        "name": tenant.name,
        "identifier": tenant.identifier,
        "isActive": tenant.is_active,
        "hostnamePolicy": policy_for(tenant),
        "pageCount": tenant.page_count,
        "hostnames": tenant.hostnames,
    }


def tenants_with_counts():
    from webpages.models import WebPage

    tenants = list(Tenant.objects.annotate(page_count=Count("webpages", distinct=True)).order_by("name"))
    roots = WebPage.objects.filter(parent__isnull=True, is_deleted=False).values_list("tenant_id", "hostnames")
    by_tenant = {tenant.pk: set() for tenant in tenants}
    for tenant_id, hostnames in roots:
        by_tenant.setdefault(tenant_id, set()).update(hostnames or [])
    for tenant in tenants:
        tenant.hostnames = sorted(by_tenant.get(tenant.pk, set()))
    return tenants


class TenantListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        require_owner(request)
        return Response([tenant_data(tenant) for tenant in tenants_with_counts()])

    @transaction.atomic
    def post(self, request):
        require_owner(request)
        schema = TenantInput(data=request.data)
        schema.is_valid(raise_exception=True)
        if Tenant.objects.filter(identifier=schema.validated_data["identifier"]).exists():
            raise ValidationError({"identifier": "This identifier is already used."})
        tenant = Tenant.objects.create(
            **schema.validated_data,
            created_by=request.user,
            settings={"hostname_policy": {"mode": "exact", "values": []}},
        )
        for name, permissions in (
            ("Administratör", ["tenant.admin", "roles.manage"]),
            (
                "Redaktör",
                [
                    "page.read",
                    "page.write",
                    "media.read",
                    "media.write",
                    "object.read",
                    "object.write",
                    "content.read",
                    "content.write",
                    "layout.read",
                    "site.read",
                ],
            ),
            ("Publicerare", ["page.read", "page.publish", "object.read", "object.publish"]),
            ("Designer", ["theme.read", "theme.write", "theme.version", "layout.read", "site.read"]),
            ("Läsare", ["page.read", "media.read", "object.read", "content.read", "layout.read", "site.read"]),
        ):
            TenantRole.objects.create(tenant=tenant, name=name, permissions=permissions)
        tenant.page_count = 0
        tenant.hostnames = []
        return Response(tenant_data(tenant), status=status.HTTP_201_CREATED)


class TenantDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, pk):
        require_owner(request)
        schema = TenantUpdate(data=request.data)
        schema.is_valid(raise_exception=True)
        tenant = get_object_or_404(Tenant.objects.select_for_update(), pk=pk)
        if "hostname_policy" in schema.validated_data:
            policy = schema.validated_data["hostname_policy"]
            previous = tenant.settings
            tenant.settings = {**(tenant.settings or {}), "hostname_policy": policy}
            from webpages.models import WebPage

            current = WebPage.objects.filter(tenant=tenant, parent__isnull=True, is_deleted=False)
            denied = [host for page in current for host in page.hostnames if not hostname_allowed(tenant, host)]
            if denied:
                tenant.settings = previous
                raise ValidationError({"hostnamePolicy": f"Existing hostname '{denied[0]}' is outside the new grant."})
        if "is_active" in schema.validated_data:
            new_active = schema.validated_data["is_active"]
            if new_active != tenant.is_active:
                from webpages.middleware import DynamicHostValidationMiddleware

                transaction.on_commit(DynamicHostValidationMiddleware.clear_hostname_cache, robust=True)
            tenant.is_active = new_active
        tenant.save(update_fields=["settings", "is_active", "updated_at"])
        updated = next(item for item in tenants_with_counts() if item.pk == tenant.pk)
        return Response(tenant_data(updated))
