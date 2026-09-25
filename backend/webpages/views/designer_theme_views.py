"""Restricted API surface for the theme Designer workspace."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.shortcuts import get_object_or_404
from django.utils import timezone
from djangorestframework_camel_case.parser import CamelCaseJSONParser
from djangorestframework_camel_case.render import CamelCaseJSONRenderer
from rest_framework import permissions, serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from file_manager.storage import S3MediaStorage
from webpages.models import PageTheme, ThemeDesignerAssignment, ThemeDesignerExportJob
from webpages.services import ThemeCSSGenerator
from webpages.services.designer_export import designer_export_filename, designer_export_object_key
from webpages.services.designer_theme import (
    MAX_IMAGE_PIXELS,
    DesignerDraftConflict,
    apply_designer_patch,
    build_draft_workspace,
    designer_theme_queryset,
    discard_designer_draft,
    generate_placeholder_png,
    get_or_create_designer_draft,
    import_designer_preview_from_site,
    publish_designer_draft,
    replace_designer_asset,
    replace_designer_preview_image,
    save_designer_draft,
    save_designer_preview_texts,
    theme_from_designer_draft,
    undo_designer_publish,
    user_can_design_theme,
)
from webpages.tasks import export_designer_theme

DESIGNER_CASE_OPTIONS = {"ignore_fields": ("colors", "values", "texts", "images")}


class DesignerJSONParser(CamelCaseJSONParser):
    """Normalize request fields without rewriting user-defined theme keys."""

    json_underscoreize = DESIGNER_CASE_OPTIONS


class DesignerJSONRenderer(CamelCaseJSONRenderer):
    """Normalize response fields without rewriting user-defined theme keys."""

    json_underscoreize = DESIGNER_CASE_OPTIONS


class DesignerExportThrottle(UserRateThrottle):
    scope = "designer_theme_export"
    rate = "10/hour"


class DesignerPlaceholderSerializer(serializers.Serializer):
    asset_key = serializers.CharField(max_length=500)
    display_name = serializers.CharField(max_length=160, default="Placeholder")
    width = serializers.IntegerField(min_value=16, max_value=8000)
    height = serializers.IntegerField(min_value=16, max_value=8000)
    draft_version = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        if attrs["width"] * attrs["height"] > MAX_IMAGE_PIXELS:
            raise serializers.ValidationError("Placeholder images cannot exceed 16 megapixels.")
        return attrs


class DesignerPreviewTextSerializer(serializers.Serializer):
    view_id = serializers.CharField(max_length=100)
    texts = serializers.DictField(child=serializers.CharField(max_length=5000, allow_blank=True), allow_empty=True)


class DesignerPreviewImageSerializer(serializers.Serializer):
    view_id = serializers.CharField(max_length=100)
    target_id = serializers.CharField(max_length=300)
    image = serializers.ImageField()


class DesignerPreviewSiteSerializer(serializers.Serializer):
    source_site_id = serializers.IntegerField(min_value=1)


def _theme(request, theme_id):
    tenant = getattr(request, "tenant", None)
    theme = get_object_or_404(PageTheme.objects.select_related("tenant"), id=theme_id, tenant=tenant)
    if not user_can_design_theme(request.user, theme):
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("You do not have Designer access to this theme.")
    return theme


def _job_data(job):
    return {
        "id": str(job.id),
        "themeId": job.theme_id,
        "status": job.status,
        "progress": job.progress,
        "errors": job.errors,
        "expiresAt": job.expires_at,
        "createdAt": job.created_at,
        "downloadReady": job.status == job.STATUS_COMPLETED and bool(job.object_key),
    }


class DesignerThemeListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tenant = getattr(request, "tenant", None)
        if tenant is None:
            return Response({"results": []})
        themes = designer_theme_queryset(request.user, tenant).order_by("name")
        return Response(
            {
                "results": [
                    {
                        "id": theme.id,
                        "name": theme.name,
                        "description": theme.description,
                        "syncVersion": theme.sync_version,
                    }
                    for theme in themes
                ]
            }
        )


class DesignerThemeWorkspaceView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [DesignerJSONParser]
    renderer_classes = [DesignerJSONRenderer]

    def get(self, request, theme_id):
        theme = _theme(request, theme_id)
        draft = get_or_create_designer_draft(theme, request.user)
        return Response(build_draft_workspace(theme, draft))

    def patch(self, request, theme_id):
        try:
            theme, draft = save_designer_draft(theme_id, request.tenant, request.user, request.data)
        except PermissionError:
            return Response({"error": "Designer access denied."}, status=status.HTTP_403_FORBIDDEN)
        except PageTheme.DoesNotExist:
            return Response({"error": "Theme not found."}, status=status.HTTP_404_NOT_FOUND)
        except DesignerDraftConflict as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(build_draft_workspace(theme, draft))


class DesignerThemePreviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [DesignerJSONParser]

    def post(self, request, theme_id):
        theme = _theme(request, theme_id)
        stored_draft = get_or_create_designer_draft(theme, request.user)
        preview_theme = theme_from_designer_draft(theme, stored_draft)
        patch = {key: value for key, value in request.data.items() if key != "draft_version"}
        apply_designer_patch(preview_theme, patch, validate_version=False)
        css = ThemeCSSGenerator().generate_complete_css(preview_theme)
        return Response(
            {
                "css": css,
                "fontUrl": preview_theme.get_google_fonts_url(),
            }
        )


class DesignerThemePublishView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [DesignerJSONRenderer]

    def post(self, request, theme_id):
        try:
            theme, draft = publish_designer_draft(
                theme_id,
                request.tenant,
                request.user,
                request.data.get("draft_version"),
            )
        except PermissionError:
            return Response({"error": "Designer access denied."}, status=status.HTTP_403_FORBIDDEN)
        except PageTheme.DoesNotExist:
            return Response({"error": "Theme not found."}, status=status.HTTP_404_NOT_FOUND)
        except DesignerDraftConflict as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(build_draft_workspace(theme, draft))


class DesignerThemeDiscardView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [DesignerJSONRenderer]

    def post(self, request, theme_id):
        try:
            theme, draft = discard_designer_draft(
                theme_id,
                request.tenant,
                request.user,
                request.data.get("draft_version"),
            )
        except PermissionError:
            return Response({"error": "Designer access denied."}, status=status.HTTP_403_FORBIDDEN)
        except PageTheme.DoesNotExist:
            return Response({"error": "Theme not found."}, status=status.HTTP_404_NOT_FOUND)
        except DesignerDraftConflict as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(build_draft_workspace(theme, draft))


class DesignerThemeUndoView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [DesignerJSONRenderer]

    def post(self, request, theme_id):
        try:
            theme, draft = undo_designer_publish(
                theme_id,
                request.tenant,
                request.user,
                request.data.get("draft_version"),
                request.data.get("live_sync_version"),
            )
        except PermissionError:
            return Response({"error": "Designer access denied."}, status=status.HTTP_403_FORBIDDEN)
        except PageTheme.DoesNotExist:
            return Response({"error": "Theme not found."}, status=status.HTTP_404_NOT_FOUND)
        except DesignerDraftConflict as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(build_draft_workspace(theme, draft))


class DesignerThemeAssetView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    renderer_classes = [DesignerJSONRenderer]

    def post(self, request, theme_id):
        _theme(request, theme_id)
        asset_key = request.data.get("asset_key")
        upload = request.FILES.get("image")
        if not asset_key or not upload:
            return Response({"error": "asset_key and image are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            theme, draft = replace_designer_asset(
                theme_id,
                request.tenant,
                request.user,
                asset_key,
                upload,
                request.data.get("draft_version"),
            )
        except PermissionError:
            return Response({"error": "Designer access denied."}, status=status.HTTP_403_FORBIDDEN)
        except DesignerDraftConflict as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(build_draft_workspace(theme, draft))


class DesignerThemePlaceholderView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [DesignerJSONRenderer]

    def post(self, request, theme_id):
        _theme(request, theme_id)
        serializer = DesignerPlaceholderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        asset_key = data["asset_key"]
        display_name = data["display_name"].strip()
        width = data["width"]
        height = data["height"]
        content = generate_placeholder_png(display_name, asset_key, width, height)
        upload = SimpleUploadedFile(f"{display_name}.png", content, content_type="image/png")
        try:
            theme, draft = replace_designer_asset(
                theme_id,
                request.tenant,
                request.user,
                asset_key,
                upload,
                data["draft_version"],
                placeholder_metadata={
                    "displayName": display_name,
                    "requiredWidth": width,
                    "requiredHeight": height,
                },
            )
        except DesignerDraftConflict as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(build_draft_workspace(theme, draft))


class DesignerThemePreviewContentView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [DesignerJSONParser]
    renderer_classes = [DesignerJSONRenderer]

    def patch(self, request, theme_id):
        serializer = DesignerPreviewTextSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            preview = save_designer_preview_texts(
                theme_id,
                request.tenant,
                request.user,
                data["view_id"],
                data["texts"],
            )
        except PermissionError:
            return Response({"error": "Designer access denied."}, status=status.HTTP_403_FORBIDDEN)
        return Response({"previewContent": preview})


class DesignerThemePreviewSiteView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [DesignerJSONParser]
    renderer_classes = [DesignerJSONRenderer]

    def post(self, request, theme_id):
        serializer = DesignerPreviewSiteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            preview = import_designer_preview_from_site(
                theme_id,
                request.tenant,
                request.user,
                serializer.validated_data["source_site_id"],
            )
        except PermissionError:
            return Response({"error": "Designer access denied."}, status=status.HTTP_403_FORBIDDEN)
        except PageTheme.DoesNotExist:
            return Response({"error": "Theme not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"previewContent": preview})


class DesignerThemePreviewImageView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    renderer_classes = [DesignerJSONRenderer]

    def post(self, request, theme_id):
        serializer = DesignerPreviewImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            preview = replace_designer_preview_image(
                theme_id,
                request.tenant,
                request.user,
                data["view_id"],
                data["target_id"],
                data["image"],
            )
        except PermissionError:
            return Response({"error": "Designer access denied."}, status=status.HTTP_403_FORBIDDEN)
        return Response({"previewContent": preview})


class ThemeDesignerAssignmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _admin_theme(self, request, theme_id):
        theme = get_object_or_404(PageTheme, id=theme_id, tenant=request.tenant)
        if not request.tenant.user_has_access(request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Tenant administrator access is required.")
        return theme

    def get(self, request, theme_id):
        theme = self._admin_theme(request, theme_id)
        assignments = theme.designer_assignments.select_related("user").order_by("user__username")
        return Response(
            {
                "results": [
                    {"id": item.id, "userId": item.user_id, "username": item.user.username, "email": item.user.email}
                    for item in assignments
                ]
            }
        )

    def post(self, request, theme_id):
        theme = self._admin_theme(request, theme_id)
        user_query = (
            {"id": request.data.get("user_id")}
            if request.data.get("user_id")
            else {"username": request.data.get("username")}
        )
        user = get_object_or_404(User, is_active=True, **user_query)
        assignment, created = ThemeDesignerAssignment.objects.get_or_create(
            tenant=theme.tenant,
            theme=theme,
            user=user,
            defaults={"created_by": request.user},
        )
        return Response(
            {"id": assignment.id, "created": created}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    def delete(self, request, theme_id):
        theme = self._admin_theme(request, theme_id)
        assignment_id = request.data.get("assignment_id")
        queryset = (
            theme.designer_assignments.filter(id=assignment_id)
            if assignment_id
            else theme.designer_assignments.filter(user_id=request.data.get("user_id"))
        )
        deleted, _ = queryset.delete()
        return Response({"deleted": bool(deleted)})


class DesignerThemeExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [DesignerExportThrottle]

    def post(self, request, theme_id):
        theme = _theme(request, theme_id)
        draft = get_or_create_designer_draft(theme, request.user)
        job = ThemeDesignerExportJob.objects.create(
            theme=theme,
            created_by=request.user,
            expires_at=timezone.now() + timedelta(hours=24),
            snapshot=draft.snapshot,
        )
        job.object_key = designer_export_object_key(job)
        job.save(update_fields=["object_key", "updated_at"])
        export_designer_theme.delay(str(job.id))
        return Response(_job_data(job), status=status.HTTP_202_ACCEPTED)


class DesignerThemeExportDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, job_id):
        job = get_object_or_404(ThemeDesignerExportJob.objects.select_related("theme", "theme__tenant"), id=job_id)
        if job.theme.tenant != request.tenant or not user_can_design_theme(request.user, job.theme):
            return Response({"error": "Export access denied."}, status=status.HTTP_403_FORBIDDEN)
        return Response(_job_data(job))


class DesignerThemeExportDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, job_id):
        job = get_object_or_404(ThemeDesignerExportJob.objects.select_related("theme", "theme__tenant"), id=job_id)
        if job.theme.tenant != request.tenant or not user_can_design_theme(request.user, job.theme):
            return Response({"error": "Export access denied."}, status=status.HTTP_403_FORBIDDEN)
        if job.status != job.STATUS_COMPLETED or not job.object_key:
            return Response({"error": "Export is not ready."}, status=status.HTTP_409_CONFLICT)
        if job.expires_at and job.expires_at <= timezone.now():
            return Response(
                {"error": "This export has expired. Create a new Designer Export."}, status=status.HTTP_410_GONE
            )
        filename = designer_export_filename(job.theme)
        url = S3MediaStorage().generate_signed_url(job.object_key, expires=3600, response_filename=filename)
        return Response({"downloadUrl": url, "filename": filename, "expiresIn": 3600})
