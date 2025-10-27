"""Proxy views for serving external web pages."""

import logging
from urllib.parse import unquote
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse

from ..services.proxy_service import ProxyService


logger = logging.getLogger(__name__)


class ProxyPageView(APIView):
    """Proxy an external webpage with URL rewriting."""
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """
        Fetch and proxy an external webpage.
        
        POST /api/content-import/proxy-page/
        {
            "url": "https://example.com"
        }
        
        Returns HTML with rewritten URLs
        """
        url = request.data.get('url')
        
        if not url:
            return Response(
                {'error': 'URL is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            proxy_service = ProxyService()
            result = proxy_service.fetch_and_rewrite(url)
            
            return Response({
                'html': result['html'],
                'baseUrl': result['base_url'],
                'contentType': result['content_type'],
            })
            
        except Exception as e:
            logger.error(f"Failed to proxy page: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProxyAssetView(APIView):
    """Proxy individual assets (images, CSS, JS) from external sites."""
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        Fetch an asset from external URL.
        
        GET /api/content-import/proxy-asset/?url=https://example.com/image.jpg
        
        Returns the asset with appropriate content type
        """
        url = request.GET.get('url')
        
        if not url:
            return HttpResponse('URL parameter required', status=400)
        
        # Decode URL
        url = unquote(url)
        
        try:
            proxy_service = ProxyService()
            asset_bytes = proxy_service.fetch_asset(url)
            
            # Determine content type from URL
            content_type = 'application/octet-stream'
            if url.endswith('.css'):
                content_type = 'text/css'
            elif url.endswith('.js'):
                content_type = 'application/javascript'
            elif url.endswith(('.jpg', '.jpeg')):
                content_type = 'image/jpeg'
            elif url.endswith('.png'):
                content_type = 'image/png'
            elif url.endswith('.gif'):
                content_type = 'image/gif'
            elif url.endswith('.svg'):
                content_type = 'image/svg+xml'
            elif url.endswith('.webp'):
                content_type = 'image/webp'
            
            return HttpResponse(asset_bytes, content_type=content_type)
            
        except Exception as e:
            logger.error(f"Failed to fetch asset: {e}")
            return HttpResponse(f'Failed to fetch asset: {str(e)}', status=500)

