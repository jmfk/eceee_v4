"""Remote object catalog, preflight, export, and local import endpoints."""

from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from djangorestframework_camel_case.render import CamelCaseJSONRenderer
from rest_framework import authentication, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Namespace
from core.machine_api_keys import MachineAPIKeyAuthentication
from core.models import MachineAPIKey
from core.permissions import HasTenantAccess
from file_manager.storage import S3MediaStorage
from object_storage.models import ObjectInstance, ObjectTransferJob, ObjectTypeDefinition, TransferCheckpoint
from object_storage.services.object_transfer import (
    MAX_CANDIDATES_PER_TYPE,
    build_preflight,
    candidate_catalog,
    serialize_type,
    type_definition_differs,
    type_has_foreign_namespace,
    type_has_foreign_tenant_usage,
    type_is_compatible,
)
from object_storage.tasks import export_object_package, import_remote_object_package, restore_object_transfer_checkpoint
from webpages.models import ThemeRemoteConnection
from webpages.services.theme_remote import RemoteThemeError, remote_object_request
from webpages.services.theme_remote_credentials import RemoteCredentialConfigurationError


class ObjectTransferJSONRenderer(CamelCaseJSONRenderer):
    """Preserve object type contracts while camel-casing the API envelope."""

    json_underscoreize = {
        **CamelCaseJSONRenderer.json_underscoreize,
        "ignore_fields": ("schema", "slot_configuration", "slotConfiguration"),
    }


def _admin(request):
    if not request.tenant.user_has_access(request.user):
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Workspace administrator access is required.")


def _connection(request):
    connection_id = request.data.get("connectionId") or request.data.get("connection_id")
    connection = get_object_or_404(
        ThemeRemoteConnection,
        id=connection_id,
        tenant=request.tenant,
        is_active=True,
    )
    if connection.credential_scheme != ThemeRemoteConnection.CREDENTIAL_API_KEY:
        raise serializers.ValidationError({"connectionId": "Object transfer requires a machine API key connection."})
    return connection


def _job_data(job):
    return {
        "id": str(job.id),
        "kind": job.kind,
        "status": job.status,
        "progress": job.progress,
        "errors": job.errors,
        "createdAt": job.created_at,
        "updatedAt": job.updated_at,
    }


def _checkpoint_data(checkpoint):
    return {
        "id": str(checkpoint.id),
        "operation": checkpoint.operation,
        "status": checkpoint.status,
        "resourceScopes": checkpoint.resource_scopes,
        "sourceDetails": checkpoint.source_details,
        "createdResources": {
            key: len(value) if isinstance(value, list) else value
            for key, value in (checkpoint.created_resources or {}).items()
            if not key.endswith("paths")
        },
        "errors": checkpoint.errors,
        "createdAt": checkpoint.created_at,
        "restoredAt": checkpoint.restored_at,
    }


def _decorate_preflight(tenant, result):
    conflicts = []
    for remote_type in result.get("types", []):
        normalized_type = {
            **remote_type,
            "slot_configuration": remote_type.get("slot_configuration") or remote_type.get("slotConfiguration"),
            "hierarchy_level": remote_type.get("hierarchy_level") or remote_type.get("hierarchyLevel"),
        }
        local = ObjectTypeDefinition.objects.filter(name=remote_type["name"]).select_related("namespace").first()
        foreign_namespace = local and type_has_foreign_namespace(local, tenant)
        if local and (type_definition_differs(local, normalized_type) or foreign_namespace):
            conflicts.append(
                {
                    "name": remote_type["name"],
                    "compatible": not foreign_namespace and type_is_compatible(local, normalized_type),
                    "usedByOtherTenants": type_has_foreign_tenant_usage(local, tenant),
                }
            )
    namespace_conflicts = []
    for remote_namespace in result.get("namespaces", []):
        slug = remote_namespace["slug"]
        if Namespace.objects.filter(tenant=tenant, slug=slug).exists():
            continue
        collision = (
            Namespace.objects.filter(slug=slug).exclude(tenant=tenant).exists()
            or Namespace.objects.filter(name=remote_namespace["name"]).exclude(tenant=tenant, slug=slug).exists()
        )
        if collision:
            namespace_conflicts.append(remote_namespace)
    existing_keys = set(
        ObjectInstance.objects.filter(
            tenant=tenant,
            object_type__name__in=[item["type"] for item in result.get("objects", [])],
        ).values_list("object_type__name", "slug")
    )
    update_count = sum((item["type"], item["slug"]) in existing_keys for item in result.get("objects", []))
    return {
        **result,
        "type_conflicts": conflicts,
        "namespace_conflicts": namespace_conflicts,
        "destination_namespaces": list(
            Namespace.objects.filter(tenant=tenant, is_active=True).values("name", "slug").order_by("name")
        ),
        "outcomes": {"create": len(result.get("objects", [])) - update_count, "update": update_count},
    }


def _validate_type_resolutions(conflicts, resolutions):
    if not isinstance(resolutions, dict):
        raise serializers.ValidationError({"typeResolutions": "Expected an object keyed by object type name."})
    conflicts_by_name = {item["name"]: item for item in conflicts}
    unexpected = sorted(set(resolutions) - set(conflicts_by_name))
    if unexpected:
        raise serializers.ValidationError(
            {"typeResolutions": [f"{name} is not an object type conflict." for name in unexpected]}
        )
    invalid = []
    for name, resolution in resolutions.items():
        conflict = conflicts_by_name[name]
        allowed = {"skip"}
        if conflict["compatible"]:
            allowed.add("keep")
        if not conflict["usedByOtherTenants"]:
            allowed.add("update")
        if not isinstance(resolution, str) or resolution not in allowed:
            invalid.append(f"{resolution} is not allowed for {name}.")
    if invalid:
        raise serializers.ValidationError({"typeResolutions": invalid})


class RemoteObjectSourceMixin:
    authentication_classes = [MachineAPIKeyAuthentication, authentication.SessionAuthentication]
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]
    renderer_classes = [ObjectTransferJSONRenderer]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not isinstance(request.auth, MachineAPIKey):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("A scoped machine API key is required for object transfer.")


class RemoteObjectSourceCatalogView(RemoteObjectSourceMixin, APIView):
    def post(self, request):
        selections = request.data.get("selections") or []
        type_ids = ObjectInstance.objects.filter(tenant=request.tenant, parent__isnull=True).values("object_type_id")
        return Response(
            {
                "object_types": [
                    serialize_type(item, tenant_id=request.tenant.id)
                    for item in ObjectTypeDefinition.objects.filter(is_active=True, id__in=type_ids)
                    .filter(Q(namespace__isnull=True) | Q(namespace__tenant=request.tenant))
                    .order_by("label")
                ],
                "results": candidate_catalog(request.tenant, selections) if selections else [],
                "max_candidates_per_type": MAX_CANDIDATES_PER_TYPE,
            }
        )


class RemoteObjectSourcePreflightView(RemoteObjectSourceMixin, APIView):
    def post(self, request):
        root_ids = request.data.get("root_ids") or request.data.get("rootIds") or []
        if not root_ids:
            raise serializers.ValidationError({"rootIds": "Select at least one root object."})
        try:
            preflight = build_preflight(request.tenant, root_ids)
        except ValueError as exc:
            raise serializers.ValidationError({"rootIds": str(exc)}) from exc
        return Response(preflight)


class RemoteObjectSourceExportListView(RemoteObjectSourceMixin, APIView):
    def post(self, request):
        root_ids = request.data.get("root_ids") or request.data.get("rootIds") or []
        try:
            preflight = build_preflight(request.tenant, root_ids)
        except ValueError as exc:
            raise serializers.ValidationError({"rootIds": str(exc)}) from exc
        if not preflight["limits"]["within_limits"]:
            raise serializers.ValidationError({"rootIds": "The selection exceeds the object transfer limits."})
        job = ObjectTransferJob.objects.create(
            tenant=request.tenant,
            kind=ObjectTransferJob.KIND_EXPORT,
            created_by=request.user,
            options={"root_ids": root_ids, "machine_api_key_id": str(request.auth.id)},
            expires_at=timezone.now() + timedelta(hours=24),
        )
        export_object_package.delay(str(job.id))
        return Response(_job_data(job), status=status.HTTP_202_ACCEPTED)


def _remote_job(request, job_id, completed=False):
    filters = {
        "id": job_id,
        "tenant": request.tenant,
        "kind": ObjectTransferJob.KIND_EXPORT,
        "options__machine_api_key_id": str(request.auth.id),
        "expires_at__gte": timezone.now(),
    }
    if completed:
        filters["status"] = ObjectTransferJob.STATUS_COMPLETED
    return get_object_or_404(ObjectTransferJob, **filters)


class RemoteObjectSourceExportDetailView(RemoteObjectSourceMixin, APIView):
    def get(self, request, job_id):
        return Response(_job_data(_remote_job(request, job_id)))


class RemoteObjectSourceExportDownloadView(RemoteObjectSourceMixin, APIView):
    def get(self, request, job_id):
        job = _remote_job(request, job_id, completed=True)
        return FileResponse(
            S3MediaStorage()._open(job.object_key, "rb"), as_attachment=True, filename=f"objects-{job.id}.zip"
        )


class RemoteObjectCatalogView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def post(self, request):
        _admin(request)
        connection = _connection(request)
        try:
            return Response(
                remote_object_request(
                    connection, "POST", "catalog/", {"selections": request.data.get("selections", [])}
                )
            )
        except (RemoteThemeError, RemoteCredentialConfigurationError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class RemoteObjectPreflightView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def post(self, request):
        _admin(request)
        connection = _connection(request)
        root_ids = request.data.get("rootIds") or request.data.get("root_ids") or []
        try:
            result = remote_object_request(connection, "POST", "preflight/", {"root_ids": root_ids})
        except (RemoteThemeError, RemoteCredentialConfigurationError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_decorate_preflight(request.tenant, result))


class RemoteObjectImportListView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get(self, request):
        _admin(request)
        jobs = ObjectTransferJob.objects.filter(
            tenant=request.tenant,
            kind=ObjectTransferJob.KIND_IMPORT,
            expires_at__gte=timezone.now(),
        )[:10]
        return Response({"results": [_job_data(job) for job in jobs]})

    def post(self, request):
        _admin(request)
        connection = _connection(request)
        root_ids = request.data.get("rootIds") or request.data.get("root_ids") or []
        if not root_ids:
            raise serializers.ValidationError({"rootIds": "Select at least one root object."})
        type_resolutions = request.data.get("typeResolutions") or request.data.get("type_resolutions") or {}
        namespace_resolutions = (
            request.data.get("namespaceResolutions") or request.data.get("namespace_resolutions") or {}
        )
        if not isinstance(namespace_resolutions, dict):
            raise serializers.ValidationError(
                {"namespaceResolutions": "Expected an object keyed by remote namespace slug."}
            )
        try:
            preflight = _decorate_preflight(
                request.tenant,
                remote_object_request(connection, "POST", "preflight/", {"root_ids": root_ids}),
            )
        except (RemoteThemeError, RemoteCredentialConfigurationError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if not preflight.get("limits", {}).get("withinLimits", preflight.get("limits", {}).get("within_limits", True)):
            raise serializers.ValidationError({"rootIds": "The selection exceeds the object transfer limits."})
        _validate_type_resolutions(preflight["type_conflicts"], type_resolutions)
        unresolved_types = [
            item["name"] for item in preflight["type_conflicts"] if item["name"] not in type_resolutions
        ]
        unresolved_namespaces = [
            item["slug"] for item in preflight["namespace_conflicts"] if item["slug"] not in namespace_resolutions
        ]
        if unresolved_types or unresolved_namespaces:
            raise serializers.ValidationError(
                {
                    "typeResolutions": [f"Resolve {name}." for name in unresolved_types],
                    "namespaceResolutions": [f"Map {slug}." for slug in unresolved_namespaces],
                }
            )
        valid_namespace_slugs = set(
            Namespace.objects.filter(tenant=request.tenant, is_active=True).values_list("slug", flat=True)
        )
        if any(slug not in valid_namespace_slugs for slug in namespace_resolutions.values()):
            raise serializers.ValidationError({"namespaceResolutions": "Choose a namespace in this workspace."})
        job = ObjectTransferJob.objects.create(
            tenant=request.tenant,
            connection=connection,
            kind=ObjectTransferJob.KIND_IMPORT,
            created_by=request.user,
            options={
                "root_ids": root_ids,
                "type_resolutions": type_resolutions,
                "namespace_resolutions": namespace_resolutions,
            },
            progress={"phase": "queued"},
            expires_at=timezone.now() + timedelta(hours=24),
        )
        import_remote_object_package.delay(str(job.id))
        return Response(_job_data(job), status=status.HTTP_202_ACCEPTED)


class RemoteObjectImportDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get(self, request, job_id):
        _admin(request)
        job = get_object_or_404(ObjectTransferJob, id=job_id, tenant=request.tenant, kind=ObjectTransferJob.KIND_IMPORT)
        return Response(_job_data(job))


class TransferCheckpointListView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get(self, request):
        _admin(request)
        checkpoints = TransferCheckpoint.objects.filter(tenant=request.tenant).select_related("source_job")[:50]
        return Response({"results": [_checkpoint_data(item) for item in checkpoints]})


class TransferCheckpointRestoreView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    @transaction.atomic
    def post(self, request, checkpoint_id):
        _admin(request)
        checkpoint = get_object_or_404(
            TransferCheckpoint.objects.select_for_update(),
            id=checkpoint_id,
            tenant=request.tenant,
        )
        if checkpoint.status == TransferCheckpoint.STATUS_RESTORED:
            return Response(_checkpoint_data(checkpoint))
        if checkpoint.status in {
            TransferCheckpoint.STATUS_RESTORE_PENDING,
            TransferCheckpoint.STATUS_RESTORING,
        }:
            raise serializers.ValidationError({"checkpointId": "This checkpoint is already being restored."})
        checkpoint.status = TransferCheckpoint.STATUS_RESTORE_PENDING
        checkpoint.restored_by = request.user
        checkpoint.errors = []
        checkpoint.save(update_fields=["status", "restored_by", "errors", "updated_at"])
        transaction.on_commit(lambda: restore_object_transfer_checkpoint.delay(str(checkpoint.id), request.user.id))
        return Response(_checkpoint_data(checkpoint), status=status.HTTP_202_ACCEPTED)
