"""
Same-origin proxy for signed imgproxy URLs.
"""

import logging

import requests
from django.http import HttpResponse
from django.views import View

from file_manager.imgproxy import imgproxy_service

logger = logging.getLogger(__name__)


class ImgProxyProxyView(View):
    """Relay signed imgproxy paths through Django for local same-origin rendering."""

    passthrough_headers = {
        "Cache-Control",
        "Content-Disposition",
        "ETag",
        "Last-Modified",
        "Vary",
        "X-Origin-Content-Length",
        "X-Origin-Height",
        "X-Origin-Width",
        "X-Result-Height",
        "X-Result-Width",
    }

    def get(self, request, path):
        target_url = self._build_target_url(request, path)

        try:
            upstream = requests.get(
                target_url,
                headers=self._request_headers(request),
                timeout=(3, 30),
            )
        except requests.RequestException as exc:
            logger.warning("imgproxy proxy request failed for %s: %s", target_url, exc)
            return HttpResponse("Image proxy unavailable", status=502)

        response = HttpResponse(
            upstream.content,
            status=upstream.status_code,
            content_type=upstream.headers.get("Content-Type", "application/octet-stream"),
        )
        for header in self.passthrough_headers:
            if header in upstream.headers:
                response[header] = upstream.headers[header]
        return response

    def head(self, request, path):
        target_url = self._build_target_url(request, path)

        try:
            upstream = requests.head(
                target_url,
                headers=self._request_headers(request),
                timeout=(3, 30),
            )
        except requests.RequestException as exc:
            logger.warning("imgproxy proxy HEAD failed for %s: %s", target_url, exc)
            return HttpResponse(status=502)

        response = HttpResponse(
            status=upstream.status_code,
            content_type=upstream.headers.get("Content-Type", "application/octet-stream"),
        )
        for header in self.passthrough_headers:
            if header in upstream.headers:
                response[header] = upstream.headers[header]
        return response

    def _build_target_url(self, request, path):
        target_url = f"{imgproxy_service.internal_url.rstrip('/')}/{path}"
        if request.META.get("QUERY_STRING"):
            target_url = f"{target_url}?{request.META['QUERY_STRING']}"
        return target_url

    def _request_headers(self, request):
        headers = {}
        if request.headers.get("Accept"):
            headers["Accept"] = request.headers["Accept"]
        return headers
