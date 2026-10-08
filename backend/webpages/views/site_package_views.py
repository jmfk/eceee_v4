"""API views for site package ZIP export/import jobs."""

from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import authentication, permissions, serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.machine_api_keys import MachineAPIKeyAuthentication
from core.models import MachineAPIKey, Tenant
from core.permissions import HasTenantAccess
from file_manager.storage import S3MediaStorage
from webpages.models import RemoteSiteBinding, SitePackageJob, ThemeRemoteAccessKey, WebPage
from webpages.models.theme_remote import SITE_TRANSFER_CAPABILITY
from webpages.serializers import (
    RemoteSiteImportCreateSerializer,
    RemoteSiteListSerializer,
    SitePackageExportCreateSerializer,
    SitePackageImportCreateSerializer,
    SitePackageJobSerializer,
)
from webpages.services.site_package import (
    build_site_package_export_object_key,
    find_site_package_conflicts,
    find_site_package_import_in_progress,
    get_site_package_download_filename,
    inspect_site_package_upload,
)
from webpages.services.theme_remote import RemoteThemeError, remote_site_request
from webpages.services.theme_remote_credentials import (
    RemoteCredentialConfigurationError,
    ThemeRemoteAccessKeyAuthentication,
)
from webpages.tasks import export_site_package, import_remote_site_package, import_site_package


def _has_site_transfer(request):
    if isinstance(request.auth, ThemeRemoteAccessKey):
        return SITE_TRANSFER_CAPABILITY in set(request.auth.capabilities or [])
    if request.auth is None:
        return request.tenant.user_has_access(request.user)
    # Machine API-key scope is checked by MachineAPIKeyAuthentication.
    return isinstance(request.auth, MachineAPIKey)


def _remote_owner_options(request):
    if isinstance(request.auth, ThemeRemoteAccessKey):
        return {"remote_access_key_id": str(request.auth.id)}
    if isinstance(request.auth, MachineAPIKey):
        return {"machine_api_key_id": str(request.auth.id)}
    return {}


def _remote_source_job(request, job_id, *, completed=False):
    filters = {
        "id": job_id,
        "kind": SitePackageJob.KIND_EXPORT,
        "root_page__tenant": request.tenant,
    }
    if completed:
        filters["status"] = SitePackageJob.STATUS_COMPLETED
    if isinstance(request.auth, ThemeRemoteAccessKey):
        filters["options__remote_access_key_id"] = str(request.auth.id)
    elif isinstance(request.auth, MachineAPIKey):
        filters["options__machine_api_key_id"] = str(request.auth.id)
    else:
        filters["created_by"] = request.user
    return get_object_or_404(SitePackageJob.objects.select_related("root_page"), **filters)


class RemoteSiteSourceMixin:
    authentication_classes = [
        MachineAPIKeyAuthentication,
        ThemeRemoteAccessKeyAuthentication,
        authentication.SessionAuthentication,
    ]
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not _has_site_transfer(request):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("This access key is not permitted to transfer sites.")


class SitePackageExportListView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get(self, request):
        jobs = _get_job_queryset(request, SitePackageJob.KIND_EXPORT)
        return Response(SitePackageJobSerializer(jobs[:10], many=True).data)

    def post(self, request):
        serializer = SitePackageExportCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        root_page = WebPage.objects.get(id=serializer.validated_data["root_page_id"])
        job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            status=SitePackageJob.STATUS_PENDING,
            root_page=root_page,
            created_by=request.user,
            object_key=build_site_package_export_object_key(root_page),
            options={
                "include_media": serializer.validated_data["include_media"],
                "include_themes": serializer.validated_data["include_themes"],
            },
            expires_at=timezone.now() + timedelta(hours=24),
        )
        export_site_package.delay(str(job.id))
        return Response(SitePackageJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class SitePackageExportDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get(self, request, job_id):
        job = _get_job(request, job_id, SitePackageJob.KIND_EXPORT)
        return Response(SitePackageJobSerializer(job).data)


class SitePackageExportDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get(self, request, job_id):
        job = _get_job(request, job_id, SitePackageJob.KIND_EXPORT)
        if job.status != SitePackageJob.STATUS_COMPLETED or not job.object_key:
            return Response(
                {"error": "Export is not ready for download"},
                status=status.HTTP_409_CONFLICT,
            )
        filename = get_site_package_download_filename(job)
        signed_url = S3MediaStorage().generate_signed_url(
            job.object_key,
            expires=3600,
            response_filename=filename,
        )
        return Response({"download_url": signed_url, "filename": filename, "expires_in": 3600})


class SitePackageImportListView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        jobs = _get_job_queryset(request, SitePackageJob.KIND_IMPORT)
        return Response(SitePackageJobSerializer(jobs[:10], many=True).data)

    def post(self, request):
        serializer = SitePackageImportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant = getattr(request, "tenant", None)
        try:
            identity = inspect_site_package_upload(serializer.validated_data["site_zip"])
        except ValueError as exc:
            raise serializers.ValidationError({"siteZip": str(exc)}) from exc

        with transaction.atomic():
            if tenant:
                Tenant.objects.select_for_update().only("id").get(id=tenant.id)
            in_progress = find_site_package_import_in_progress(tenant, identity) if tenant else None
            if in_progress:
                return Response(
                    {
                        "code": "site_import_in_progress",
                        "message": f'“{identity["title"]}” is already being imported.',
                        "jobId": str(in_progress.id),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            conflicts = find_site_package_conflicts(tenant, identity) if tenant else []
            mode = serializer.validated_data["mode"]
            if conflicts and mode == "prompt":
                return Response(
                    {
                        "code": "site_already_exists",
                        "message": f'“{identity["title"]}” already exists. Choose how to import it.',
                        "sourceSite": identity,
                        "existingSites": [
                            {"id": item["id"], "title": item["title"], "slug": item["slug"]} for item in conflicts
                        ],
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            if mode == "update":
                selected = next(
                    (item for item in conflicts if item["id"] == serializer.validated_data["existing_root_id"]),
                    None,
                )
                if selected is None:
                    raise serializers.ValidationError(
                        {"existingRootId": "The selected site does not match this package."}
                    )
            else:
                selected = None
                mode = "clone" if mode == "clone" else "create"

            options = {
                "preserve_publication_status": serializer.validated_data["preserve_publication_status"],
                "mode": mode,
                "source_root_key": identity["stable_key"],
                "source_root_id": identity["source_id"],
                "source_package_hash": identity["package_hash"],
            }
            if selected:
                options["local_root_id"] = selected["id"]
                if selected["binding_job_id"]:
                    options["source_binding_job_id"] = selected["binding_job_id"]
            if tenant:
                options["tenant_id"] = str(tenant.id)
            job = SitePackageJob.objects.create(
                kind=SitePackageJob.KIND_IMPORT,
                status=SitePackageJob.STATUS_PENDING,
                created_by=request.user,
                options=options,
                expires_at=timezone.now() + timedelta(hours=24),
            )
            object_key = f"site-packages/imports/{job.id}.zip"
            job.object_key = object_key
            job.save(update_fields=["object_key", "updated_at"])

        try:
            S3MediaStorage()._save(object_key, serializer.validated_data["site_zip"])
            import_site_package.delay(str(job.id))
        except Exception as exc:
            job.mark_failed(exc)
            raise
        return Response(SitePackageJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class SitePackageImportDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def get(self, request, job_id):
        job = _get_job(request, job_id, SitePackageJob.KIND_IMPORT)
        return Response(SitePackageJobSerializer(job).data)


class RemoteSiteSourceListView(RemoteSiteSourceMixin, APIView):
    def get(self, request):
        roots = WebPage.objects.filter(tenant=request.tenant, parent__isnull=True, is_deleted=False).order_by("title")
        results = []
        for root in roots:
            page_count = 0
            queue = [root]
            while queue:
                page = queue.pop(0)
                page_count += 1
                queue.extend(page.children.filter(is_deleted=False).only("id"))
            results.append(
                {
                    "stableKey": str(root.stable_key),
                    "title": root.title,
                    "hostnames": root.hostnames or [],
                    "updatedAt": root.updated_at,
                    "pageCount": page_count,
                }
            )
        return Response({"results": results})


class RemoteSiteSourceExportListView(RemoteSiteSourceMixin, APIView):
    def post(self, request):
        stable_key = request.data.get("stableKey") or request.data.get("stable_key")
        if not stable_key:
            raise serializers.ValidationError({"stableKey": "This field is required."})
        root = get_object_or_404(
            WebPage,
            tenant=request.tenant,
            stable_key=stable_key,
            parent__isnull=True,
            is_deleted=False,
        )
        job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            status=SitePackageJob.STATUS_PENDING,
            root_page=root,
            created_by=request.user,
            object_key=build_site_package_export_object_key(root),
            options={
                "include_media": True,
                "include_themes": True,
                "source": "remote",
                **_remote_owner_options(request),
            },
            expires_at=timezone.now() + timedelta(hours=24),
        )
        export_site_package.delay(str(job.id))
        return Response(SitePackageJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class RemoteSiteSourceExportDetailView(RemoteSiteSourceMixin, APIView):
    def get(self, request, job_id):
        job = _remote_source_job(request, job_id)
        return Response(SitePackageJobSerializer(job).data)


class RemoteSiteSourceExportDownloadView(RemoteSiteSourceMixin, APIView):
    def get(self, request, job_id):
        job = _remote_source_job(request, job_id, completed=True)
        file_obj = S3MediaStorage()._open(job.object_key, "rb")
        return FileResponse(file_obj, as_attachment=True, filename=get_site_package_download_filename(job))


class RemoteSiteListView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def post(self, request):
        serializer = RemoteSiteListSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        connection = serializer.validated_data["connection"]
        try:
            result = remote_site_request(connection, "GET", "sites/")
        except (RemoteThemeError, RemoteCredentialConfigurationError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        bindings = RemoteSiteBinding.objects.filter(
            tenant=request.tenant,
            connection=connection,
            local_root__is_deleted=False,
            local_root__parent__isnull=True,
        ).select_related("local_root")
        local_copies = {}
        for binding in bindings:
            local_copies.setdefault(str(binding.remote_root_key), []).append(
                {"bindingId": str(binding.id), "localRootId": binding.local_root_id, "title": binding.local_root.title}
            )
        return Response(
            {
                "results": [
                    {**item, "localCopies": local_copies.get(str(item.get("stableKey")), [])}
                    for item in result.get("results", [])
                ]
            }
        )


class RemoteSiteImportView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]

    def post(self, request):
        serializer = RemoteSiteImportCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_PENDING,
            root_page_id=data.get("local_root_id"),
            created_by=request.user,
            options={
                "tenant_id": str(request.tenant.id),
                "source": "remote",
                "mode": data["mode"],
                "connection_id": str(data["connection"].id),
                "remote_site_key": str(data["remote_site_key"]),
                "local_root_id": data.get("local_root_id"),
                "preserve_publication_status": data["mode"] == "copy",
            },
            progress={"phase": "queued"},
            expires_at=timezone.now() + timedelta(hours=24),
        )
        import_remote_site_package.delay(str(job.id))
        return Response(SitePackageJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


def _get_job(request, job_id, kind):
    queryset = _get_job_queryset(request, kind)
    return get_object_or_404(queryset, id=job_id)


def _get_job_queryset(request, kind):
    queryset = SitePackageJob.objects.filter(kind=kind).select_related("root_page", "imported_root_page")
    tenant = request.tenant
    if kind == SitePackageJob.KIND_EXPORT:
        queryset = queryset.filter(root_page__tenant=tenant)
    else:
        queryset = queryset.filter(options__tenant_id=str(tenant.id))
    if not request.user.is_staff:
        queryset = queryset.filter(created_by=request.user)

    now = timezone.now()
    return queryset.filter(Q(expires_at__isnull=True) | Q(expires_at__gte=now)).order_by("-created_at")
