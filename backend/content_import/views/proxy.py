"""Proxy views for serving external web pages."""

import logging
import requests
from urllib.parse import unquote
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.http import HttpResponse
from django.core.signing import SignatureExpired, BadSignature
from django.conf import settings

from ..services.proxy_service import ProxyService
from ..utils.token_signing import verify_proxy_token
from ..utils.image_resolution import find_highest_resolution, get_image_dimensions


logger = logging.getLogger(__name__)


class ProxyPageView(APIView):
    """Proxy an external webpage with URL rewriting."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Fetch and proxy an external webpage.

        POST /api/content-import/proxy-page/
        {
            "url": "https://example.com",
            "strip_design": true  // optional, defaults to true
        }

        Returns HTML with rewritten URLs
        """
        url = request.data.get("url")
        strip_design = request.data.get("strip_design", True)

        if not url:
            return Response(
                {"error": "URL is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            proxy_service = ProxyService()
            result = proxy_service.fetch_and_rewrite(
                url, request=request, strip_design=strip_design
            )

            return Response(
                {
                    "html": result["html"],
                    "baseUrl": result["base_url"],
                    "contentType": result["content_type"],
                }
            )

        except Exception as e:
            logger.error(f"Failed to proxy page: {e}")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProxyAssetView(APIView):
    """
    Proxy individual assets (images, CSS, JS) from external sites.

    Uses signed time-limited tokens for secure anonymous access.
    This allows browser-initiated requests (img, link, script tags)
    to load assets without requiring authentication headers.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        """
        Fetch an asset from external URL with token validation.

        For images, automatically detects and serves the highest resolution available.

        GET /api/content-import/proxy-asset/?url=https://example.com/image.jpg&token=signed_token

        Returns the asset with appropriate content type and resolution headers
        """
        url = request.GET.get("url")
        token = request.GET.get("token")

        if not url:
            return HttpResponse("URL parameter required", status=400)

        if not token:
            return HttpResponse(
                "Authentication token required", status=401, content_type="text/plain"
            )

        # Decode URL
        url = unquote(url)

        # Validate the token and get metadata
        try:
            max_age = getattr(
                settings, "CONTENT_IMPORT_PROXY_TOKEN_MAX_AGE", 3600  # Default: 1 hour
            )
            metadata = verify_proxy_token(url, token, max_age=max_age)

        except SignatureExpired:
            return HttpResponse(
                "Token has expired. Please reload the page.",
                status=410,  # 410 Gone - resource was available but is no longer
                content_type="text/plain",
            )

        except BadSignature:
            return HttpResponse(
                "Invalid authentication token", status=401, content_type="text/plain"
            )

        # Token is valid, fetch the asset
        try:
            # Determine content type first
            initial_response = requests.head(url, timeout=10)
            content_type = initial_response.headers.get(
                "content-type", "application/octet-stream"
            )

            # Fallback to URL-based detection if needed
            if content_type == "application/octet-stream" or not content_type:
                if url.endswith(".css") or "css" in url:
                    content_type = "text/css"
                elif url.endswith(".js"):
                    content_type = "application/javascript"
                elif url.endswith((".jpg", ".jpeg")):
                    content_type = "image/jpeg"
                elif url.endswith(".png"):
                    content_type = "image/png"
                elif url.endswith(".gif"):
                    content_type = "image/gif"
                elif url.endswith(".svg"):
                    content_type = "image/svg+xml"
                elif url.endswith(".webp"):
                    content_type = "image/webp"

            # High-resolution detection for images
            resolution_info = None
            final_url = url

            is_image = content_type and content_type.startswith("image/")
            if is_image and not content_type.startswith("image/svg"):
                # Extract srcset from metadata
                srcset_data = None
                if metadata and "srcset" in metadata:
                    srcset_data = metadata["srcset"]

                # Find highest resolution version
                try:
                    resolution_info = find_highest_resolution(
                        base_url=url,
                        srcset=srcset_data,
                        check_patterns=True,
                        max_checks=10,
                    )
                    final_url = resolution_info["url"]
                    logger.info(
                        f"High-res detection: {url} -> {final_url} "
                        f"({resolution_info['multiplier']}x from {resolution_info['source']})"
                    )
                except Exception as e:
                    logger.warning(
                        f"High-res detection failed for {url}: {e}, using original"
                    )
                    resolution_info = None

            # Fetch the final asset (potentially high-res version)
            asset_response = requests.get(final_url, timeout=30)
            asset_response.raise_for_status()
            asset_bytes = asset_response.content

            # Get image dimensions if it's an image
            dimensions = None
            if is_image and resolution_info:
                dimensions = get_image_dimensions(asset_bytes)
                if dimensions:
                    resolution_info["dimensions"] = dimensions

            # Create response with custom headers
            response = HttpResponse(asset_bytes, content_type=content_type)

            # Add resolution headers for images
            if resolution_info:
                multiplier = resolution_info["multiplier"]
                # Format multiplier as "2x", "3x", "1x"
                if multiplier == int(multiplier):
                    multiplier_str = f"{int(multiplier)}x"
                else:
                    multiplier_str = f"{multiplier:.1f}x"

                response["X-Image-Resolution"] = multiplier_str
                response["X-Resolution-Source"] = resolution_info["source"]

                if dimensions:
                    response["X-Image-Dimensions"] = f"{dimensions[0]}x{dimensions[1]}"

                # Allow frontend to read these custom headers
                response["Access-Control-Expose-Headers"] = (
                    "X-Image-Resolution, X-Resolution-Source, X-Image-Dimensions"
                )

            return response

        except Exception as e:
            logger.error(f"Failed to fetch asset: {e}")
            return HttpResponse(f"Failed to fetch asset: {str(e)}", status=500)
