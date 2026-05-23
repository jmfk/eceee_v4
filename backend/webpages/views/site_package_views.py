"""API views for site package ZIP export/import jobs."""

from datetime import timedelta
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from file_manager.storage import S3MediaStorage
from webpages.models import SitePackageJob, WebPage
from webpages.serializers import (
    SitePackageExportCreateSerializer,
    SitePackageImportCreateSerializer,
    SitePackageJobSerializer,
)
from webpages.tasks import export_site_package, import_site_package


class SitePackageExportListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        jobs = _get_job_queryset(request, SitePackageJob.KIND_EXPORT)
        return Response(SitePackageJobSerializer(jobs[:10], many=True).data)

    def post(self, request):
        serializer = SitePackageExportCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        root_page = WebPage.objects.get(id=serializer.validated_data["root_page_id"])
        job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            status=SitePackageJob.STATUS_PENDING,
            root_page=root_page,
            created_by=request.user,
            options={
                "include_media": serializer.validated_data["include_media"],
                "include_themes": serializer.validated_data["include_themes"],
            },
            expires_at=timezone.now() + timedelta(hours=24),
        )
        export_site_package.delay(str(job.id))
        return Response(SitePackageJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class SitePackageExportDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, job_id):
        job = _get_job(request, job_id, SitePackageJob.KIND_EXPORT)
        return Response(SitePackageJobSerializer(job).data)


class SitePackageExportDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, job_id):
        job = _get_job(request, job_id, SitePackageJob.KIND_EXPORT)
        if job.status != SitePackageJob.STATUS_COMPLETED or not job.object_key:
            return Response(
                {"error": "Export is not ready for download"},
                status=status.HTTP_409_CONFLICT,
            )
        signed_url = S3MediaStorage().generate_signed_url(job.object_key, expires=3600)
        return Response({"download_url": signed_url, "expires_in": 3600})


class SitePackageImportListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        jobs = _get_job_queryset(request, SitePackageJob.KIND_IMPORT)
        return Response(SitePackageJobSerializer(jobs[:10], many=True).data)

    def post(self, request):
        serializer = SitePackageImportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant = getattr(request, "tenant", None)
        options = {
            "preserve_publication_status": serializer.validated_data[
                "preserve_publication_status"
            ],
        }
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
        S3MediaStorage()._save(object_key, serializer.validated_data["site_zip"])
        job.object_key = object_key
        job.save(update_fields=["object_key", "updated_at"])
        import_site_package.delay(str(job.id))
        return Response(SitePackageJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


class SitePackageImportDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, job_id):
        job = _get_job(request, job_id, SitePackageJob.KIND_IMPORT)
        return Response(SitePackageJobSerializer(job).data)


def _get_job(request, job_id, kind):
    queryset = _get_job_queryset(request, kind)
    return get_object_or_404(queryset, id=job_id)


def _get_job_queryset(request, kind):
    queryset = SitePackageJob.objects.filter(kind=kind).select_related(
        "root_page", "imported_root_page"
    )
    if not request.user.is_staff:
        queryset = queryset.filter(created_by=request.user)

    now = timezone.now()
    return queryset.filter(Q(expires_at__isnull=True) | Q(expires_at__gte=now)).order_by(
        "-created_at"
    )
