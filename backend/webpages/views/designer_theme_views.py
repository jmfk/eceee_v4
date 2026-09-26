"""Restricted API surface for the theme Designer workspace."""

from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
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
from object_storage.models import ObjectInstance, ObjectVersion
from webpages.models import (
    PageTheme,
    ThemeDesignerAssignment,
    ThemeDesignerExportJob,
    ThemeRemoteConnection,
    ThemeVersion,
    WebPage,
)
from webpages.services import ThemeCSSGenerator
from webpages.services.designer_export import designer_export_filename, designer_export_object_key
from webpages.services.designer_theme import (
    MAX_IMAGE_PIXELS,
    DesignerDraftConflict,
    apply_designer_patch,
    build_draft_workspace,
    designer_preview_layout,
    designer_preview_version,
    designer_theme_queryset,
    discard_designer_draft,
    generate_placeholder_png,
    get_or_create_designer_draft,
    import_designer_preview_from_site,
    publish_designer_draft,
    replace_designer_asset,
    save_designer_draft,
    save_designer_preview_texts,
    theme_from_designer_draft,
    undo_designer_publish,
    user_can_design_theme,
)
from webpages.services.site_package import build_theme_transfer_package, restore_theme_transfer_package
from webpages.services.theme_remote import RemoteThemeError, remote_sync_request
from webpages.services.theme_remote_credentials import (
    RemoteCredentialConfigurationError,
    decrypt_access_key,
    encrypt_access_key,
)
from webpages.services.theme_versions import (
    SNAPSHOT_FIELDS,
    compare_themes,
    record_theme_version,
    restore_theme_version,
    snapshot_hash,
    snapshot_matches_current,
    theme_snapshot,
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


class DesignerPreviewSiteSerializer(serializers.Serializer):
    source_site_id = serializers.IntegerField(min_value=1)


class DesignerPreviewPageSerializer(serializers.Serializer):
    source_page_id = serializers.IntegerField(min_value=1)


class DesignerPreviewObjectSerializer(serializers.Serializer):
    source_object_id = serializers.IntegerField(min_value=1)


class DesignerThemeCheckpointSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160, trim_whitespace=True)


class DesignerThemeVersionNameSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160, trim_whitespace=True, allow_blank=True)


class DesignerThemeCompareSerializer(serializers.Serializer):
    left_theme_id = serializers.IntegerField(min_value=1)
    right_theme_id = serializers.IntegerField(min_value=1)


class DesignerRemoteSerializer(serializers.Serializer):
    connection_id = serializers.UUIDField()


class DesignerRemotePullSerializer(DesignerRemoteSerializer):
    stable_key = serializers.UUIDField()


class DesignerRemotePushSerializer(DesignerRemoteSerializer):
    theme_id = serializers.IntegerField(min_value=1)


class DesignerRemoteConnectionSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    base_url = serializers.URLField(max_length=500)
    remote_workspace = serializers.CharField(max_length=100)
    access_key = serializers.CharField(max_length=500, trim_whitespace=False, write_only=True, required=False)
    is_default = serializers.BooleanField(default=False)


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
        themes = designer_theme_queryset(request.user, tenant).prefetch_related("versions").order_by("name")
        return Response(
            {
                "results": [
                    {
                        "id": theme.id,
                        "name": theme.name,
                        "description": theme.description,
                        "syncVersion": theme.sync_version,
                        "stableKey": str(theme.stable_key),
                        "updatedAt": theme.updated_at,
                        "versionCount": len(theme.versions.all()),
                        "contentHash": snapshot_hash(theme_snapshot(theme)),
                    }
                    for theme in themes
                ],
                "canManageRemotes": tenant.user_has_access(request.user),
            }
        )


class DesignerThemeCompareView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = DesignerThemeCompareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        themes = designer_theme_queryset(request.user, request.tenant).filter(
            id__in=[serializer.validated_data["left_theme_id"], serializer.validated_data["right_theme_id"]]
        )
        by_id = {theme.id: theme for theme in themes}
        left = by_id.get(serializer.validated_data["left_theme_id"])
        right = by_id.get(serializer.validated_data["right_theme_id"])
        if not left or not right:
            return Response({"error": "Theme not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(compare_themes(left, right))


class DesignerThemeVersionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, theme_id):
        theme = _theme(request, theme_id)
        current_snapshot = theme_snapshot(theme)
        versions = list(theme.versions.select_related("created_by").all())
        current_version_id = next(
            (version.id for version in versions if snapshot_matches_current(version.snapshot, current_snapshot)),
            None,
        )
        return Response(
            {
                "results": [
                    {
                        "id": version.id,
                        "versionNumber": version.version_number,
                        "name": version.name,
                        "syncVersion": version.sync_version,
                        "contentHash": version.content_hash,
                        "source": version.source,
                        "sourceLabel": version.source_label,
                        "createdAt": version.created_at,
                        "createdBy": version.created_by.username if version.created_by else None,
                        "isCurrent": version.id == current_version_id,
                    }
                    for version in versions
                ]
            }
        )

    def post(self, request, theme_id):
        theme = _theme(request, theme_id)
        serializer = DesignerThemeCheckpointSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = record_theme_version(
            theme,
            source="named-checkpoint",
            source_label="Manual checkpoint",
            name=serializer.validated_data["name"],
            created_by=request.user,
            force=True,
        )
        return Response(
            {"id": version.id, "versionNumber": version.version_number, "name": version.name},
            status=status.HTTP_201_CREATED,
        )


class DesignerThemeVersionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, theme_id, version_id):
        theme = _theme(request, theme_id)
        version = get_object_or_404(ThemeVersion, id=version_id, theme=theme)
        serializer = DesignerThemeVersionNameSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version.name = serializer.validated_data["name"]
        version.save(update_fields=["name"])
        return Response({"id": version.id, "versionNumber": version.version_number, "name": version.name})


class DesignerThemeRestoreView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, theme_id, version_id):
        theme = _theme(request, theme_id)
        version = get_object_or_404(ThemeVersion, id=version_id, theme=theme)
        restored = restore_theme_version(theme, version, user=request.user)
        return Response({"versionNumber": restored.version_number, "syncVersion": theme.sync_version})


def _remote_admin(request):
    tenant = getattr(request, "tenant", None)
    if tenant is None or not tenant.user_has_access(request.user):
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Workspace administrator access is required.")
    return tenant


def _remote_user(request):
    tenant = getattr(request, "tenant", None)
    if tenant is None or (
        not tenant.user_has_access(request.user) and not designer_theme_queryset(request.user, tenant).exists()
    ):
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Designer access is required.")
    return tenant


def _connection_data(connection):
    return {
        "id": str(connection.id),
        "name": connection.name,
        "baseUrl": connection.base_url,
        "remoteWorkspace": connection.remote_workspace,
        "isDefault": connection.is_default,
        "isActive": connection.is_active,
        "hasAccessKey": bool(connection.encrypted_access_key),
        "updatedAt": connection.updated_at,
    }


def _remote_connection(request, connection_id):
    tenant = _remote_user(request)
    return get_object_or_404(ThemeRemoteConnection, id=connection_id, tenant=tenant, is_active=True)


def _remote_request(connection, action, payload=None):
    token = decrypt_access_key(connection.encrypted_access_key)
    return remote_sync_request(connection.base_url, connection.remote_workspace, token, action, payload)


class DesignerRemoteConnectionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tenant = _remote_user(request)
        connections = ThemeRemoteConnection.objects.filter(tenant=tenant, is_active=True).order_by(
            "-is_default", "name"
        )
        return Response(
            {
                "results": [_connection_data(connection) for connection in connections],
                "canManage": tenant.user_has_access(request.user),
            }
        )

    @transaction.atomic
    def post(self, request):
        tenant = _remote_admin(request)
        serializer = DesignerRemoteConnectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        access_key = data.pop("access_key", "")
        if not access_key:
            raise serializers.ValidationError({"accessKey": "Access key is required."})
        is_first = not ThemeRemoteConnection.objects.filter(tenant=tenant, is_active=True).exists()
        make_default = data.pop("is_default", False) or is_first
        if make_default:
            ThemeRemoteConnection.objects.filter(tenant=tenant, is_default=True).update(is_default=False)
        try:
            encrypted = encrypt_access_key(access_key)
        except RemoteCredentialConfigurationError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        connection = ThemeRemoteConnection.objects.create(
            tenant=tenant,
            encrypted_access_key=encrypted,
            is_default=make_default,
            created_by=request.user,
            updated_by=request.user,
            **data,
        )
        return Response(_connection_data(connection), status=status.HTTP_201_CREATED)


class DesignerRemoteConnectionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def patch(self, request, connection_id):
        tenant = _remote_admin(request)
        connection = get_object_or_404(ThemeRemoteConnection, id=connection_id, tenant=tenant)
        serializer = DesignerRemoteConnectionSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        access_key = data.pop("access_key", None)
        make_default = data.pop("is_default", connection.is_default)
        if make_default:
            ThemeRemoteConnection.objects.filter(tenant=tenant, is_default=True).exclude(pk=connection.pk).update(
                is_default=False
            )
        elif connection.is_default:
            raise serializers.ValidationError({"isDefault": "Choose another default connection first."})
        if access_key:
            try:
                connection.encrypted_access_key = encrypt_access_key(access_key)
            except RemoteCredentialConfigurationError as exc:
                return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        for field, value in data.items():
            setattr(connection, field, value)
        connection.is_default = make_default
        connection.updated_by = request.user
        connection.save()
        return Response(_connection_data(connection))

    @transaction.atomic
    def delete(self, request, connection_id):
        tenant = _remote_admin(request)
        connection = get_object_or_404(ThemeRemoteConnection, id=connection_id, tenant=tenant)
        was_default = connection.is_default
        connection.delete()
        if was_default:
            replacement = (
                ThemeRemoteConnection.objects.filter(tenant=tenant, is_active=True).order_by("created_at").first()
            )
            if replacement:
                replacement.is_default = True
                replacement.save(update_fields=["is_default"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class DesignerRemoteThemesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = DesignerRemoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        connection = _remote_connection(request, serializer.validated_data["connection_id"])
        try:
            result = _remote_request(connection, "pull")
        except (RemoteThemeError, RemoteCredentialConfigurationError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        themes = result.get("themes", [])
        return Response(
            {
                "results": [
                    {
                        "stableKey": str(item.get("stable_key") or item.get("stableKey") or ""),
                        "name": item.get("name"),
                        "description": item.get("description", ""),
                        "syncVersion": item.get("sync_version", item.get("syncVersion", 1)),
                    }
                    for item in themes
                ]
            }
        )


class DesignerRemotePullView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        tenant = _remote_user(request)
        serializer = DesignerRemotePullSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        connection = _remote_connection(request, data["connection_id"])
        try:
            result = _remote_request(connection, "pull", {"stable_key": str(data["stable_key"])})
        except (RemoteThemeError, RemoteCredentialConfigurationError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        remote_theme = next(
            (
                item
                for item in result.get("themes", [])
                if str(item.get("stable_key") or item.get("stableKey")) == str(data["stable_key"])
            ),
            None,
        )
        if remote_theme is None:
            return Response({"error": "Remote theme not found."}, status=status.HTTP_404_NOT_FOUND)
        camel_names = {
            "site_icon": "siteIcon",
            "design_groups": "designGroups",
            "component_styles": "componentStyles",
            "designer_preview": "designerPreview",
            "image_styles": "imageStyles",
            "gallery_styles": "galleryStyles",
            "carousel_styles": "carouselStyles",
            "table_templates": "tableTemplates",
            "css_variables": "cssVariables",
            "html_elements": "htmlElements",
            "custom_css": "customCss",
            "is_active": "isActive",
            "is_default": "isDefault",
        }
        snapshot = {
            field: remote_theme[field] if field in remote_theme else remote_theme[camel_names[field]]
            for field in SNAPSHOT_FIELDS
            if field in remote_theme or camel_names.get(field) in remote_theme
        }
        theme = PageTheme.objects.filter(tenant=tenant, stable_key=data["stable_key"]).first()
        if theme is None:
            if not tenant.user_has_access(request.user):
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("Workspace administrator access is required to import a new theme.")
            base_name = snapshot.get("name") or "Imported theme"
            name = base_name
            suffix = 2
            while PageTheme.objects.filter(tenant=tenant, name=name).exists():
                name = f"{base_name} ({suffix})"
                suffix += 1
            snapshot["name"] = name
            packaged_snapshot = remote_theme.get("transfer_package") or remote_theme.get("transferPackage")
            initial_snapshot = dict(snapshot)
            if packaged_snapshot:
                initial_snapshot.pop("image", None)
                initial_snapshot.pop("site_icon", None)
            theme = PageTheme(tenant=tenant, created_by=request.user, stable_key=data["stable_key"], **initial_snapshot)
            theme.save(
                version_source="remote-download",
                version_source_label=connection.name,
                version_created_by=request.user,
                force_version=True,
            )
            if packaged_snapshot:
                try:
                    snapshot = restore_theme_transfer_package(packaged_snapshot, theme)
                except ValueError as exc:
                    return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
                snapshot["name"] = name
                for field in SNAPSHOT_FIELDS:
                    if field in snapshot:
                        setattr(theme, field, snapshot[field])
                theme.save(update_fields=[*SNAPSHOT_FIELDS, "updated_at"], skip_version_increment=True)
                theme.versions.all().delete()
                version = record_theme_version(
                    theme,
                    source="remote-download",
                    source_label=connection.name,
                    created_by=request.user,
                    force=True,
                )
            else:
                version = theme.versions.first()
        else:
            if not user_can_design_theme(request.user, theme):
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("You do not have Designer access to this theme.")
            packaged_snapshot = remote_theme.get("transfer_package") or remote_theme.get("transferPackage")
            if packaged_snapshot:
                try:
                    snapshot = restore_theme_transfer_package(packaged_snapshot, theme)
                except ValueError as exc:
                    return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            version = record_theme_version(
                theme,
                source="remote-download",
                source_label=connection.name,
                created_by=request.user,
                force=True,
                snapshot=snapshot,
            )
        return Response({"themeId": theme.id, "versionNumber": version.version_number}, status=status.HTTP_201_CREATED)


class DesignerRemotePushView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = DesignerRemotePushSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        theme = _theme(request, data["theme_id"])
        connection = _remote_connection(request, data["connection_id"])
        try:
            remote = _remote_request(connection, "pull")
            match = next(
                (
                    item
                    for item in remote.get("themes", [])
                    if str(item.get("stable_key") or item.get("stableKey")) == str(theme.stable_key)
                ),
                None,
            )
            remote_snapshot = theme_snapshot(theme)
            for package_only_field in ("image", "site_icon", "gallery_styles", "carousel_styles"):
                remote_snapshot.pop(package_only_field, None)
            payload = {
                "sync_version": (match or {}).get("sync_version", (match or {}).get("syncVersion", 0)),
                "theme_data": remote_snapshot | {"stable_key": str(theme.stable_key)},
                "transfer_package": build_theme_transfer_package(theme),
            }
            result = _remote_request(connection, "push", payload)
        except (RemoteThemeError, RemoteCredentialConfigurationError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "name": result.get("name", theme.name),
                "syncVersion": result.get("sync_version", result.get("syncVersion")),
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


class DesignerThemePreviewPageView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [DesignerJSONParser]
    renderer_classes = [DesignerJSONRenderer]

    def post(self, request, theme_id):
        theme = _theme(request, theme_id)
        serializer = DesignerPreviewPageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        page = get_object_or_404(
            WebPage.objects.select_related("current_published_version", "latest_version", "parent"),
            id=serializer.validated_data["source_page_id"],
            tenant=theme.tenant,
            is_deleted=False,
        )

        from .webpage_views import WebPageViewSet

        inheritance = WebPageViewSet._widget_inheritance_legacy(page).data
        version = designer_preview_version(page)
        layout = designer_preview_layout(page, version)
        return Response(
            {
                "page": {
                    "id": page.id,
                    "path_pattern_key": page.path_pattern_key,
                    "hostnames": page.hostnames,
                    "cached_root_hostnames": page.cached_root_hostnames,
                },
                "version": {
                    "id": version.id if version else None,
                    "code_layout": layout,
                    "widgets": version.widgets if version else {},
                },
                "inheritance": inheritance,
            }
        )


class DesignerThemePreviewObjectView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [DesignerJSONParser]
    renderer_classes = [DesignerJSONRenderer]

    def post(self, request, theme_id):
        theme = _theme(request, theme_id)
        serializer = DesignerPreviewObjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = get_object_or_404(
            ObjectInstance.objects.select_related("object_type"),
            id=serializer.validated_data["source_object_id"],
            tenant=theme.tenant,
            current_version_id__isnull=False,
        )
        version = (
            ObjectVersion.objects.filter(id=instance.current_version_id, object_instance=instance)
            .values("id", "data", "widgets")
            .first()
        )
        if version is None:
            return Response({"error": "That object has no content to preview."}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {
                "object": {"id": instance.id, "title": instance.title},
                "objectType": {
                    "key": instance.object_type.name,
                    "label": instance.object_type.label,
                    "schema": instance.object_type.schema or {},
                },
                "version": version,
            }
        )


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
