"""Workspace administration for scoped inbound remote-site credentials."""

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from webpages.models import ThemeRemoteAccessKey
from webpages.models.theme_remote import SITE_TRANSFER_CAPABILITY, THEME_TRANSFER_CAPABILITY
from webpages.services.theme_remote_credentials import generate_access_key

REMOTE_CAPABILITIES = (THEME_TRANSFER_CAPABILITY, SITE_TRANSFER_CAPABILITY)


def _workspace_admin(request):
    tenant = getattr(request, "tenant", None)
    if tenant is None or not tenant.user_has_access(request.user):
        raise PermissionDenied("Workspace administrator access is required.")
    return tenant


def _key_data(access_key, *, secret=None):
    data = {
        "id": str(access_key.id),
        "name": access_key.name,
        "keyPrefix": access_key.key_prefix,
        "capabilities": access_key.capabilities or [],
        "isActive": access_key.is_active,
        "createdAt": access_key.created_at,
        "lastUsedAt": access_key.last_used_at,
    }
    if secret is not None:
        data["secret"] = secret
    return data


class RemoteAccessKeySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    capabilities = serializers.ListField(
        child=serializers.ChoiceField(choices=REMOTE_CAPABILITIES),
        allow_empty=False,
    )

    def validate_capabilities(self, value):
        return sorted(set(value))


class RemoteAccessKeyRotateSerializer(serializers.Serializer):
    capabilities = serializers.ListField(
        child=serializers.ChoiceField(choices=REMOTE_CAPABILITIES),
        allow_empty=False,
        required=False,
    )

    def validate_capabilities(self, value):
        return sorted(set(value))


class RemoteAccessKeysView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tenant = _workspace_admin(request)
        keys = ThemeRemoteAccessKey.objects.filter(tenant=tenant).order_by("name")
        return Response(
            {
                "results": [_key_data(access_key) for access_key in keys],
                "syncEnabled": bool(getattr(settings, "THEME_SYNC_ENABLED", False)),
            }
        )

    @transaction.atomic
    def post(self, request):
        tenant = _workspace_admin(request)
        serializer = RemoteAccessKeySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if ThemeRemoteAccessKey.objects.filter(tenant=tenant, name=data["name"]).exists():
            raise serializers.ValidationError({"name": "An access key with this name already exists."})

        raw_key, key_hash, key_prefix = generate_access_key()
        access_key = ThemeRemoteAccessKey.objects.create(
            tenant=tenant,
            name=data["name"],
            key_hash=key_hash,
            key_prefix=key_prefix,
            capabilities=data["capabilities"],
            created_by=request.user,
        )
        return Response(_key_data(access_key, secret=raw_key), status=status.HTTP_201_CREATED)


class RemoteAccessKeyRotateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, access_key_id):
        tenant = _workspace_admin(request)
        access_key = get_object_or_404(
            ThemeRemoteAccessKey.objects.select_for_update(),
            id=access_key_id,
            tenant=tenant,
        )
        serializer = RemoteAccessKeyRotateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_key, key_hash, key_prefix = generate_access_key()
        access_key.key_hash = key_hash
        access_key.key_prefix = key_prefix
        access_key.capabilities = serializer.validated_data.get("capabilities", access_key.capabilities)
        access_key.is_active = True
        access_key.last_used_at = None
        access_key.created_by = request.user
        access_key.save(
            update_fields=["key_hash", "key_prefix", "capabilities", "is_active", "last_used_at", "created_by"]
        )
        return Response(_key_data(access_key, secret=raw_key))


class RemoteAccessKeyRevokeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, access_key_id):
        tenant = _workspace_admin(request)
        access_key = get_object_or_404(
            ThemeRemoteAccessKey.objects.select_for_update(),
            id=access_key_id,
            tenant=tenant,
        )
        access_key.is_active = False
        access_key.save(update_fields=["is_active"])
        return Response(_key_data(access_key))
