"""Explicit administrator preview and execution for old image versions."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.roles import is_tenant_admin
from file_manager.image_version_cleanup import execute_cleanup, preview_cleanup


class ImageVersionCleanupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _years(self, request, value):
        if not is_tenant_admin(request.user, getattr(request, "tenant", None)):
            return None, Response(status=status.HTTP_403_FORBIDDEN)
        try:
            if isinstance(value, bool) or isinstance(value, float):
                raise ValueError
            years = int(value)
            if not 1 <= years <= 100:
                raise ValueError
        except (TypeError, ValueError):
            return None, Response({"error": "years must be between 1 and 100"}, status=status.HTTP_400_BAD_REQUEST)
        return years, None

    def get(self, request):
        years, error = self._years(request, request.query_params.get("years"))
        if error:
            return error
        return Response(preview_cleanup(request.tenant, years))

    def post(self, request):
        years, error = self._years(request, request.data.get("years"))
        if error:
            return error
        return Response(execute_cleanup(request.tenant, years))
