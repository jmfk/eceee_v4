"""Restricted API surface for the theme Designer workspace."""

import copy
import json
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from ai_tracking.services.ai_client import AIClient
from file_manager.storage import S3MediaStorage
from webpages.models import PageTheme, ThemeDesignerAssignment, ThemeDesignerExportJob
from webpages.services import ThemeCSSGenerator
from webpages.services.designer_export import designer_export_filename, designer_export_object_key
from webpages.services.designer_theme import (
    apply_designer_patch,
    build_workspace,
    designer_theme_queryset,
    generate_placeholder_png,
    replace_designer_asset,
    save_designer_patch,
    undo_designer_change,
    user_can_design_theme,
)
from webpages.tasks import export_designer_theme


DEFAULT_PREVIEW_CONTENT = {
    "eyebrow": "Design system preview",
    "title": "A clear heading for representative content",
    "lead": "This sample shows typography, colors, spacing, imagery, cards, lists, links, buttons, and tables.",
    "cardTitle": "Representative card",
    "cardBody": "Use this area to judge hierarchy, rhythm, and readability before saving the live theme.",
    "listItems": ["First representative item", "A second item with more text", "Final list item"],
}


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

    def get(self, request, theme_id):
        return Response(build_workspace(_theme(request, theme_id)))

    def patch(self, request, theme_id):
        try:
            theme = save_designer_patch(theme_id, request.tenant, request.user, request.data)
        except PermissionError:
            return Response({"error": "Designer access denied."}, status=status.HTTP_403_FORBIDDEN)
        except PageTheme.DoesNotExist:
            return Response({"error": "Theme not found."}, status=status.HTTP_404_NOT_FOUND)
        if theme is None:
            current = get_object_or_404(PageTheme, id=theme_id, tenant=request.tenant)
            return Response(
                {"error": "The theme changed after you opened it.", "syncVersion": current.sync_version},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(build_workspace(theme))


class DesignerThemePreviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, theme_id):
        theme = _theme(request, theme_id)
        draft = copy.deepcopy(theme)
        apply_designer_patch(draft, request.data, validate_version=False)
        css = ThemeCSSGenerator().generate_complete_css(draft)
        return Response(
            {
                "css": css,
                "fontUrl": draft.get_google_fonts_url(),
                "content": DEFAULT_PREVIEW_CONTENT,
            }
        )


class DesignerThemeUndoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, theme_id):
        try:
            theme = undo_designer_change(theme_id, request.tenant, request.user)
        except PermissionError:
            return Response({"error": "Designer access denied."}, status=status.HTTP_403_FORBIDDEN)
        except PageTheme.DoesNotExist:
            return Response({"error": "Theme not found."}, status=status.HTTP_404_NOT_FOUND)
        if theme is None:
            return Response({"error": "There is no designer change to undo."}, status=status.HTTP_409_CONFLICT)
        return Response(build_workspace(theme))


class DesignerThemeAssetView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, theme_id):
        _theme(request, theme_id)
        asset_key = request.data.get("asset_key")
        upload = request.FILES.get("image")
        if not asset_key or not upload:
            return Response({"error": "asset_key and image are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            theme = replace_designer_asset(theme_id, request.tenant, request.user, asset_key, upload)
        except PermissionError:
            return Response({"error": "Designer access denied."}, status=status.HTTP_403_FORBIDDEN)
        return Response(build_workspace(theme))


class DesignerThemePlaceholderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, theme_id):
        _theme(request, theme_id)
        asset_key = request.data.get("assetKey")
        display_name = str(request.data.get("displayName") or "Placeholder").strip()
        width = request.data.get("width")
        height = request.data.get("height")
        if not asset_key or not width or not height:
            return Response({"error": "assetKey, width, and height are required."}, status=status.HTTP_400_BAD_REQUEST)
        content = generate_placeholder_png(display_name, asset_key, width, height)
        upload = SimpleUploadedFile(f"{display_name}.png", content, content_type="image/png")
        theme = replace_designer_asset(theme_id, request.tenant, request.user, asset_key, upload)
        # Mark the generated file as a placeholder without exposing arbitrary JSON edits.
        if asset_key.startswith("design:"):
            parts = asset_key.split(":", 4)
            groups = copy.deepcopy(theme.design_groups.get("groups", []))
            group = groups[int(parts[1])]
            for part, breakpoint, values in _iter_layout_for_view(group):
                if part == parts[2] and breakpoint == parts[3]:
                    target = values.get(parts[4]) or (values.get("images") or {}).get(parts[4])
                    if isinstance(target, dict):
                        target.update(
                            {
                                "displayName": display_name,
                                "requiredWidth": int(width),
                                "requiredHeight": int(height),
                                "isPlaceholder": True,
                            }
                        )
                    break
            theme.design_groups = {**theme.design_groups, "groups": groups}
            theme.save(update_fields=["design_groups", "sync_version", "updated_at"])
        return Response(build_workspace(theme))


def _iter_layout_for_view(group):
    for key in ("layoutProperties", "layout_properties"):
        for part, breakpoints in (group.get(key) or {}).items():
            for breakpoint, values in (breakpoints or {}).items():
                if isinstance(values, dict):
                    yield part, breakpoint, values


class DesignerPreviewContentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, theme_id):
        _theme(request, theme_id)
        prompt = str(request.data.get("prompt") or "Create neutral sample website copy for a design-system preview.")[
            :1000
        ]
        messages = [
            {
                "role": "system",
                "content": "Return only JSON with string fields eyebrow, title, lead, cardTitle, cardBody and a listItems array of exactly three short strings. Do not include HTML.",
            },
            {"role": "user", "content": prompt},
        ]
        try:
            result = AIClient(
                provider="openai", model="gpt-4o-mini", user=request.user, prompt_type="theme_designer_preview"
            ).call(
                prompt=messages,
                task_description="Generate designer preview sample content",
                metadata={"theme_id": theme_id},
                response_format={"type": "json_object"},
                store_full_data=False,
            )
            content = json.loads(result["response"])
            required = {"eyebrow", "title", "lead", "cardTitle", "cardBody", "listItems"}
            if (
                set(content) != required
                or not all(isinstance(content[key], str) for key in required - {"listItems"})
                or not isinstance(content["listItems"], list)
                or len(content["listItems"]) != 3
            ):
                raise ValueError("AI response did not match the preview schema")
            for key in required - {"listItems"}:
                content[key] = content[key][:500]
            content["listItems"] = [str(item)[:160] for item in content["listItems"]]
            return Response({"content": content})
        except Exception:
            return Response({"content": DEFAULT_PREVIEW_CONTENT, "fallback": True})


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
            {"id": request.data.get("userId")}
            if request.data.get("userId")
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
        assignment_id = request.data.get("assignmentId")
        queryset = (
            theme.designer_assignments.filter(id=assignment_id)
            if assignment_id
            else theme.designer_assignments.filter(user_id=request.data.get("userId"))
        )
        deleted, _ = queryset.delete()
        return Response({"deleted": bool(deleted)})


class DesignerThemeExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, theme_id):
        theme = _theme(request, theme_id)
        job = ThemeDesignerExportJob.objects.create(
            theme=theme,
            created_by=request.user,
            expires_at=timezone.now() + timedelta(hours=24),
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
