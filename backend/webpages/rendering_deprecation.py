"""Kill switches for deprecated Django HTML rendering surfaces."""

import logging

from django.http import HttpResponse
from rest_framework import status
from rest_framework.response import Response


logger = logging.getLogger(__name__)


def _log_blocked(surface, request):
    logger.warning(
        "Blocked deprecated Django rendering request",
        extra={
            "render_surface": surface,
            "request_method": request.method,
        },
    )


def disabled_public_render_response(request):
    """Return a deterministic response when Django public rendering is disabled."""
    _log_blocked("public", request)
    response = HttpResponse("Public rendering is provided by Next.js.\n", status=410, content_type="text/plain")
    response["Cache-Control"] = "no-store"
    response["X-ECEEE-Renderer"] = "django-disabled"
    return response


def disabled_legacy_render_api_response(request, surface):
    """Return a stable API response for a disabled legacy HTML renderer."""
    _log_blocked(surface, request)
    response = Response(
        {"detail": "The legacy Django rendering API is disabled."},
        status=status.HTTP_410_GONE,
    )
    response["Cache-Control"] = "no-store"
    response["X-ECEEE-Renderer"] = "django-disabled"
    return response
