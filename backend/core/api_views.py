from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.machine_api_keys import ALLOWED_SCOPES, deployment_environment, generate_machine_api_key
from core.models import MachineAPIKey, Tenant


class IsSuperUser(permissions.BasePermission):
    """Reserve machine credential management for server administrators."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class MachineAPIKeySerializer(serializers.ModelSerializer):
    principal_id = serializers.PrimaryKeyRelatedField(
        source="principal", queryset=get_user_model().objects.filter(is_active=True)
    )
    tenant_ids = serializers.PrimaryKeyRelatedField(
        source="tenants", queryset=Tenant.objects.filter(is_active=True), many=True
    )
    secret = serializers.CharField(read_only=True)

    class Meta:
        model = MachineAPIKey
        fields = [
            "id",
            "name",
            "principal_id",
            "tenant_ids",
            "environment",
            "scopes",
            "key_prefix",
            "is_active",
            "expires_at",
            "last_used_at",
            "created_at",
            "secret",
        ]
        read_only_fields = ["environment", "key_prefix", "is_active", "last_used_at", "created_at"]

    def validate_scopes(self, value):
        scopes = set(value)
        if not scopes or not scopes <= ALLOWED_SCOPES:
            raise serializers.ValidationError("Select one or more supported scopes.")
        return sorted(scopes)

    def validate_tenant_ids(self, value):
        if not value:
            raise serializers.ValidationError("Select at least one tenant.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        tenants = validated_data.pop("tenants")
        raw_key, key_hash, key_prefix = generate_machine_api_key()
        api_key = MachineAPIKey.objects.create(
            **validated_data,
            environment=deployment_environment(),
            key_hash=key_hash,
            key_prefix=key_prefix,
            created_by=self.context["request"].user,
        )
        api_key.tenants.set(tenants)
        api_key.secret = raw_key
        return api_key


class MachineAPIKeyViewSet(viewsets.GenericViewSet):
    queryset = MachineAPIKey.objects.select_related("principal", "created_by").prefetch_related("tenants")
    serializer_class = MachineAPIKeySerializer
    permission_classes = [IsSuperUser]

    def list(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        api_key = serializer.save()
        return Response(self.get_serializer(api_key).data, status=status.HTTP_201_CREATED)

    def _get_object_for_update(self):
        queryset = self.filter_queryset(self.get_queryset()).select_for_update()
        api_key = get_object_or_404(queryset, pk=self.kwargs["pk"])
        self.check_object_permissions(self.request, api_key)
        return api_key

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def revoke(self, request, pk=None):
        api_key = self._get_object_for_update()
        api_key.is_active = False
        api_key.save(update_fields=["is_active"])
        return Response(self.get_serializer(api_key).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def rotate(self, request, pk=None):
        api_key = self._get_object_for_update()
        raw_key, key_hash, key_prefix = generate_machine_api_key()
        api_key.key_hash = key_hash
        api_key.key_prefix = key_prefix
        api_key.is_active = True
        api_key.last_used_at = None
        api_key.save(update_fields=["key_hash", "key_prefix", "is_active", "last_used_at"])
        api_key.secret = raw_key
        return Response(self.get_serializer(api_key).data)
