"""Dedicated API surface for editing theme-owned React layouts."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import PageTheme
from ..services.designer_theme import (
    DesignerDraftConflict,
    build_draft_workspace,
    discard_layout_draft,
    get_or_create_designer_draft,
    publish_layout_draft,
    save_designer_draft,
    theme_designer_snapshot,
    user_can_design_theme,
)
from .designer_theme_views import DesignerJSONParser, DesignerJSONRenderer


def _workspace(request, theme, draft):
    workspace = build_draft_workspace(theme, draft, include_tenant_content=False)
    draft_layouts = draft.snapshot.get("layouts", theme.layouts)
    workspace["hasLayoutDraftChanges"] = draft_layouts != theme.layouts
    live_snapshot = theme_designer_snapshot(theme)
    workspace["hasOtherDraftChanges"] = {key: value for key, value in draft.snapshot.items() if key != "layouts"} != {
        key: value for key, value in live_snapshot.items() if key != "layouts"
    }
    return workspace


def _theme(request, theme_id):
    theme = PageTheme.objects.filter(id=theme_id, tenant=getattr(request, "tenant", None)).first()
    if not theme:
        return None, Response({"error": "Theme not found."}, status=status.HTTP_404_NOT_FOUND)
    if not user_can_design_theme(request.user, theme):
        return None, Response({"error": "Layout editor access denied."}, status=status.HTTP_403_FORBIDDEN)
    return theme, None


class LayoutWorkspaceView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [DesignerJSONParser]
    renderer_classes = [DesignerJSONRenderer]

    def get(self, request, theme_id):
        theme, error = _theme(request, theme_id)
        if error:
            return error
        return Response(_workspace(request, theme, get_or_create_designer_draft(theme, request.user)))

    def patch(self, request, theme_id):
        unexpected = set(request.data) - {"draft_version", "layouts"}
        if unexpected:
            return Response(
                {"error": "The Layout Editor only accepts layout changes."}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            theme, draft = save_designer_draft(theme_id, request.tenant, request.user, request.data)
        except PermissionError:
            return Response({"error": "Layout editor access denied."}, status=status.HTTP_403_FORBIDDEN)
        except PageTheme.DoesNotExist:
            return Response({"error": "Theme not found."}, status=status.HTTP_404_NOT_FOUND)
        except DesignerDraftConflict as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(_workspace(request, theme, draft))


class LayoutPublishView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [DesignerJSONRenderer]

    def post(self, request, theme_id):
        try:
            theme, draft = publish_layout_draft(
                theme_id, request.tenant, request.user, request.data.get("draft_version")
            )
        except PermissionError:
            return Response({"error": "Layout editor access denied."}, status=status.HTTP_403_FORBIDDEN)
        except PageTheme.DoesNotExist:
            return Response({"error": "Theme not found."}, status=status.HTTP_404_NOT_FOUND)
        except DesignerDraftConflict as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(_workspace(request, theme, draft))


class LayoutDiscardView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [DesignerJSONRenderer]

    def post(self, request, theme_id):
        try:
            theme, draft = discard_layout_draft(
                theme_id, request.tenant, request.user, request.data.get("draft_version")
            )
        except PermissionError:
            return Response({"error": "Layout editor access denied."}, status=status.HTTP_403_FORBIDDEN)
        except PageTheme.DoesNotExist:
            return Response({"error": "Theme not found."}, status=status.HTTP_404_NOT_FOUND)
        except DesignerDraftConflict as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(_workspace(request, theme, draft))
