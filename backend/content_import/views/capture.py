"""Screenshot capture view."""

import logging
import base64
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from ..serializers import CaptureScreenshotSerializer
from ..services.playwright_service import PlaywrightService


logger = logging.getLogger(__name__)


class CaptureScreenshotView(APIView):
    """Capture screenshot of external webpage."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Capture screenshot of a URL.

        POST /api/content-import/capture/
        {
            "url": "https://example.com",
            "viewport_width": 1920,
            "viewport_height": 1080,
            "full_page": false
        }

        Returns:
            {
                "screenshot_data": "base64_encoded_png",
                "width": 1920,
                "height": 1080,
                "url": "https://example.com"
            }
        """
        serializer = CaptureScreenshotSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST
            )

        validated_data = serializer.validated_data
        url = validated_data["url"]
        viewport_width = validated_data.get("viewport_width", 1920)
        viewport_height = validated_data.get("viewport_height", 1080)
        full_page = validated_data.get("full_page", False)

        try:
            # Initialize Playwright service
            playwright_service = PlaywrightService()

            # Validate URL first
            playwright_service.validate_url(url)

            # Capture screenshot
            screenshot_bytes = playwright_service.capture_screenshot(
                url=url,
                viewport_width=viewport_width,
                viewport_height=viewport_height,
                full_page=full_page,
            )

            # Convert to base64 for JSON response
            screenshot_base64 = base64.b64encode(screenshot_bytes).decode("utf-8")

            logger.info(f"Successfully captured screenshot for {url}")

            return Response(
                {
                    "screenshot_data": screenshot_base64,
                    "width": viewport_width,
                    "height": viewport_height,
                    "url": url,
                    "format": "png",
                }
            )

        except Exception as e:
            logger.error(f"Failed to capture screenshot: {e}")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
