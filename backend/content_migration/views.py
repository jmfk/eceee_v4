from django.core.management.base import CommandError
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Namespace
from core.permissions import HasTenantAccess
from data_connections.models import DataConnection
from tenant_plugins.models import TenantPluginActivation
from tenant_plugins.registry import PluginRegistryError, registry

from .models import MigrationJob, MigrationPlan, MigrationTask, PluginImportJob
from .serializers import (
    MigrationJobSerializer,
    MigrationPlanSerializer,
    MigrationTaskSerializer,
    PluginImportJobSerializer,
)
from .tasks import run_migration_job, run_plugin_import_job


def _admin(request):
    if not request.tenant.user_has_access(request.user):
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Workspace administrator access is required.")


def _active_plugins(tenant):
    return {item.plugin_id: item for item in TenantPluginActivation.objects.filter(tenant=tenant, is_active=True)}


class PluginCatalogView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get(self, request):
        active = _active_plugins(request.tenant)
        return Response(
            {
                "results": [
                    plugin.as_dict(
                        active=plugin.id in active and active[plugin.id].plugin_version == plugin.version,
                        compatible=plugin.supports_tenant(request.tenant),
                    )
                    for plugin in registry.plugins()
                ],
                "canManage": request.tenant.user_has_access(request.user),
            }
        )


class PluginActivationView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    @transaction.atomic
    def post(self, request, plugin_id):
        _admin(request)
        try:
            plugin = registry.plugin(plugin_id)
        except PluginRegistryError as exc:
            raise serializers.ValidationError({"pluginId": str(exc)}) from exc
        if not plugin.supports_tenant(request.tenant):
            raise serializers.ValidationError({"pluginId": "This plugin is not available for this workspace."})
        activation, _created = TenantPluginActivation.objects.update_or_create(
            tenant=request.tenant,
            plugin_id=plugin.id,
            defaults={
                "plugin_version": plugin.version,
                "is_active": True,
                "activated_by": request.user,
            },
        )
        return Response(plugin.as_dict(active=activation.is_active, compatible=True))

    @transaction.atomic
    def delete(self, request, plugin_id):
        _admin(request)
        TenantPluginActivation.objects.filter(tenant=request.tenant, plugin_id=plugin_id).update(is_active=False)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ImporterCatalogView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get(self, request):
        active = _active_plugins(request.tenant)
        namespaces = [
            {"value": item.slug, "label": item.name}
            for item in Namespace.objects.filter(tenant=request.tenant, is_active=True).order_by("name")
        ]
        results = []
        for plugin in registry.plugins():
            activation = active.get(plugin.id)
            if (
                not plugin.supports_tenant(request.tenant)
                or not activation
                or activation.plugin_version != plugin.version
            ):
                continue
            for importer in plugin.importers:
                data = importer.as_dict()
                data["pluginId"] = plugin.id
                data["pluginLabel"] = plugin.label
                data["fields"] = [
                    {**field, **({"options": namespaces} if field.get("type") == "namespace" else {})}
                    for field in data["fields"]
                ]
                results.append(data)
        return Response({"results": results})


def _importer_context(request, importer_id):
    try:
        plugin, importer = registry.importer(importer_id)
    except PluginRegistryError as exc:
        raise serializers.ValidationError({"importerId": str(exc)}) from exc
    if not plugin.supports_tenant(request.tenant):
        raise serializers.ValidationError({"importerId": "This importer is not available for this workspace."})
    active = TenantPluginActivation.objects.filter(
        tenant=request.tenant,
        plugin_id=plugin.id,
        plugin_version=plugin.version,
        is_active=True,
    ).exists()
    if not active:
        raise serializers.ValidationError({"importerId": "Activate this importer plugin first."})
    connection_id = request.data.get("connectionId") or request.data.get("connection_id")
    connection = get_object_or_404(
        DataConnection,
        id=connection_id,
        tenant=request.tenant,
        is_active=True,
    )
    if connection.connection_type not in importer.connection_kinds:
        raise serializers.ValidationError({"connectionId": "Choose a compatible source connection."})
    options = request.data.get("options") or {}
    if not isinstance(options, dict):
        raise serializers.ValidationError({"options": "Expected an object."})
    return plugin, importer, connection, options


class ImporterPreflightView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def post(self, request, importer_id):
        _admin(request)
        _plugin, importer, connection, options = _importer_context(request, importer_id)
        try:
            result = importer.handler.preflight(
                tenant=request.tenant,
                user=request.user,
                connection=connection,
                options=options,
            )
        except CommandError as exc:
            raise serializers.ValidationError({"error": str(exc)}) from exc
        return Response(result)


class PluginImportJobListView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get(self, request):
        jobs = PluginImportJob.objects.filter(tenant=request.tenant).select_related("connection")[:25]
        return Response({"results": PluginImportJobSerializer(jobs, many=True).data})

    @transaction.atomic
    def post(self, request):
        _admin(request)
        importer_id = request.data.get("importerId") or request.data.get("importer_id")
        _plugin, importer, connection, options = _importer_context(request, importer_id)
        try:
            validated_options = importer.handler.validate_options(request.tenant, options)
        except CommandError as exc:
            raise serializers.ValidationError({"options": str(exc)}) from exc
        idempotency_key = request.data.get("idempotencyKey") or request.data.get("idempotency_key")
        if not idempotency_key:
            raise serializers.ValidationError({"idempotencyKey": "This field is required."})
        idempotency_field = serializers.UUIDField()
        try:
            idempotency_key = idempotency_field.run_validation(idempotency_key)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({"idempotencyKey": "Enter a valid UUID."}) from exc
        job, created = PluginImportJob.objects.get_or_create(
            tenant=request.tenant,
            importer_id=importer.id,
            idempotency_key=idempotency_key,
            defaults={
                "importer_version": importer.version,
                "connection": connection,
                "options": validated_options,
                "created_by": request.user,
            },
        )
        if not created and (
            job.importer_version != importer.version
            or job.connection_id != connection.id
            or job.options != validated_options
        ):
            return Response(
                {"idempotencyKey": "This key is already associated with a different import request."},
                status=status.HTTP_409_CONFLICT,
            )
        if created:
            transaction.on_commit(lambda: run_plugin_import_job.delay(str(job.id)))
        return Response(PluginImportJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class PluginImportJobDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get(self, request, job_id):
        job = get_object_or_404(
            PluginImportJob.objects.select_related("connection"),
            id=job_id,
            tenant=request.tenant,
        )
        return Response(PluginImportJobSerializer(job).data)


class MigrationPlanViewSet(viewsets.ModelViewSet):
    serializer_class = MigrationPlanSerializer
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get_queryset(self):
        return MigrationPlan.objects.filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def run(self, request, pk=None):
        plan = self.get_object()
        job = MigrationJob.objects.create(plan=plan, tenant=request.tenant, created_by=request.user)
        run_migration_job.delay(str(job.id))
        return Response(MigrationJobSerializer(job).data, status=status.HTTP_201_CREATED)


class MigrationJobViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MigrationJobSerializer
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get_queryset(self):
        return MigrationJob.objects.filter(tenant=self.request.tenant).order_by("-created_at")

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        job = self.get_object()
        if job.status in ["PENDING", "RUNNING"]:
            job.status = "CANCELLED"
            job.save(update_fields=["status"])
            return Response({"status": "cancelled"})
        return Response({"error": "Job is already finished"}, status=status.HTTP_400_BAD_REQUEST)


class MigrationTaskViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MigrationTaskSerializer
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]
    filterset_fields = ["job", "status", "source_id"]

    def get_queryset(self):
        return MigrationTask.objects.filter(job__tenant=self.request.tenant).order_by("-started_at")
