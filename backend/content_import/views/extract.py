"""Content extraction view."""

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from ..serializers import ExtractContentSerializer
from ..services.playwright_service import PlaywrightService


logger = logging.getLogger(__name__)


class ExtractContentView(APIView):
    """Extract HTML content at coordinates from webpage."""
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """
        Extract HTML element at specific coordinates.
        
        POST /api/content-import/extract/
        {
            "url": "https://example.com",
            "x": 500,
            "y": 300,
            "timeout": 30000
        }
        
        Returns:
            {
                "html": "<div>...</div>",
                "inner_html": "...",
                "tag_name": "div",
                "text_content": "...",
                "class_name": "...",
                "id": "...",
                "attributes": {...}
            }
        """
        serializer = ExtractContentSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(
                {'errors': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        validated_data = serializer.validated_data
        url = validated_data['url']
        x = validated_data['x']
        y = validated_data['y']
        timeout = validated_data.get('timeout', 30000)
        
        try:
            # Initialize Playwright service
            playwright_service = PlaywrightService()
            
            # Extract element
            element_data = playwright_service.extract_element(
                url=url,
                x=x,
                y=y,
                timeout=timeout
            )
            
            logger.info(f"Successfully extracted element from {url} at ({x}, {y})")
            
            return Response(element_data)
            
        except Exception as e:
            logger.error(f"Failed to extract content: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

