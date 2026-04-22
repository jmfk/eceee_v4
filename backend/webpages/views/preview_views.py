"""
Preview-related views for page editor
"""

import os

from rest_framework import viewsets, permissions, status
from rest_framework.authentication import SessionAuthentication, TokenAuthentication
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.shortcuts import get_object_or_404
from django.http import HttpResponse, HttpRequest
from django.template.loader import render_to_string
from django.conf import settings
from django.views.decorators.clickjacking import xframe_options_exempt

from ..models import PreviewSize, WebPage, PageVersion
from ..serializers import PreviewSizeSerializer
from ..renderers import WebPageRenderer


class PreviewTokenAuthentication(JWTAuthentication):
    """
    Custom authentication class for webpage previews.
    Allows JWT token to be provided via 'token' query parameter.
    """

    def authenticate(self, request):
        # First try standard Authorization header via superclass
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        # Fallback to 'token' query parameter
        token = request.query_params.get("token")
        if not token:
            return None

        # Create a mock request with the token in the header for JWTAuthentication to process
        mock_request = HttpRequest()
        mock_request.META = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

        try:
            return super().authenticate(mock_request)
        except (InvalidToken, TokenError):
            # Let DRF handle the error
            raise


class PreviewSizeViewSet(viewsets.ModelViewSet):
    """
    API viewset for managing preview size configurations.

    Allows authenticated users to create, read, update, and delete
    preview size configurations for the page editor.
    """

    queryset = PreviewSize.objects.all()
    serializer_class = PreviewSizeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return preview sizes ordered by sort_order"""
        return PreviewSize.objects.all().order_by("sort_order", "id")


@api_view(["GET"])
@authentication_classes([
    PreviewTokenAuthentication,
    SessionAuthentication,
    TokenAuthentication,
])
@permission_classes([permissions.IsAuthenticated])
@xframe_options_exempt
def render_version_preview(request, page_id, version_id):
    """
    Render a specific page version for preview in the page editor.

    This endpoint renders the complete HTML for a page version, suitable
    for display in an iframe. Only authenticated users with page editing
    permissions can access this endpoint.

    Authentication can be provided via:
    - Standard Authorization header (for API calls)
    - Query parameter 'token' with JWT access token (for iframe src)

    Args:
        request: HTTP request
        page_id: ID of the WebPage
        version_id: ID of the PageVersion to render

    Returns:
        HttpResponse with complete HTML page including CSS and meta tags
    """

    # Check if user has permission to edit pages
    # For now, we'll allow any authenticated user. In production, you might
    # want to check for specific permissions like is_staff or has page editing permission
    if not request.user.is_authenticated:
        return HttpResponse(
            "<html><body><h1>Unauthorized</h1><p>You must be logged in to preview pages.</p></body></html>",
            status=401,
        )

    # Optional: Add stricter permission check
    # if not (request.user.is_staff or request.user.has_perm('webpages.change_webpage')):
    #     return HttpResponse(
    #         '<html><body><h1>Forbidden</h1><p>You do not have permission to preview pages.</p></body></html>',
    #         status=403
    #     )

    # Get the page and version
    page = get_object_or_404(WebPage, id=page_id)
    version = get_object_or_404(PageVersion, id=version_id, page=page)

    # Get the root page to access hostnames
    root_page = page
    while root_page.parent:
        root_page = root_page.parent

    # Check if root page has hostnames configured.
    # The hostname is only used to build the <base href> and asset URLs for
    # the preview iframe. When the root page has no explicit hostnames we
    # fall back to the current request's host, which is always a valid
    # origin for serving the page's assets (the editor itself is being
    # served from it). This avoids surfacing a misleading "configuration
    # required" page in production for sub-pages whose root page simply
    # has no hostnames configured yet.
    hostname = None
    if not root_page.hostnames or len(root_page.hostnames) == 0:
        hostname = request.get_host()
        # Determine protocol: respect the proxied scheme when available so
        # production previews behind a reverse proxy still use https.
        forwarded_proto = request.META.get("HTTP_X_FORWARDED_PROTO")
        if forwarded_proto:
            protocol = forwarded_proto.split(",")[0].strip()
        elif request.is_secure():
            protocol = "https"
        elif hostname.startswith("localhost") or hostname.startswith("127.0.0.1"):
            protocol = "http"
        else:
            protocol = "https"
        base_url = f"{protocol}://{hostname}/"
    else:
        # Get the first hostname from the root page
        hostname = root_page.hostnames[0]

        # Determine protocol (use http for localhost, https for others)
        if hostname.startswith("localhost") or hostname.startswith("127.0.0.1"):
            protocol = "http"
        else:
            protocol = "https"

        # In development mode, if the hostname doesn't have a port, 
        # use the port from the current request to ensure assets load correctly.
        if settings.DEBUG and ":" not in hostname:
            request_host = request.get_host()
            if ":" in request_host:
                port = request_host.split(":")[-1]
                hostname = f"{hostname}:{port}"

        # Build base URL
        base_url = f"{protocol}://{hostname}/"

    try:
        # Use the WebPageRenderer to render the complete page
        renderer = WebPageRenderer(request=request)
        result = renderer.render(page, version=version)

        # Read lightbox CSS to include in preview (since it's normally loaded via <link> tag)
        lightbox_css = ""
        lightbox_css_path = os.path.join(settings.BASE_DIR, "static", "css", "lightbox.css")
        try:
            with open(lightbox_css_path, 'r') as f:
                lightbox_css = f.read()
        except FileNotFoundError:
            pass  # Lightbox CSS not found, continue without it

        # Build complete HTML document with base tag for proper URL resolution
        # and JavaScript to prevent navigation in preview
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base href="{base_url}">
    {result.get('meta', '')}
    
    <!-- Tailwind CSS - required for responsive utilities like useContentMargins -->
    <link href="{base_url}static/css/tailwind.output.css" rel="stylesheet">
    
    <style>
        /* Lightbox CSS */
        {lightbox_css}
        
        /* Page CSS */
        {result.get('css', '')}
    </style>
    <script>
        // Prevent all navigation in preview mode
        document.addEventListener('DOMContentLoaded', function() {{
            // Prevent all link clicks
            document.addEventListener('click', function(e) {{
                const link = e.target.closest('a');
                if (link) {{
                    e.preventDefault();
                    console.log('Navigation prevented in preview:', link.href);
                    return false;
                }}
            }}, true);
            
            // Prevent form submissions
            document.addEventListener('submit', function(e) {{
                e.preventDefault();
                console.log('Form submission prevented in preview');
                return false;
            }}, true);
            
            // Add visual indicator that this is preview mode
            const style = document.createElement('style');
            style.textContent = `
                a {{ cursor: default !important; }}
                a:hover {{ opacity: 0.8; }}
            `;
            document.head.appendChild(style);
        }});
    </script>
</head>
<body>
    {result.get('html', '')}
</body>
</html>
"""

        return HttpResponse(html_content, content_type="text/html")

    except Exception as e:
        # Return error page if rendering fails
        error_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview Error</title>
    <style>
        body {{
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .error-box {{
            background: white;
            border: 1px solid #e5e5e5;
            border-left: 4px solid #dc2626;
            padding: 20px;
            border-radius: 4px;
        }}
        h1 {{
            margin-top: 0;
            color: #dc2626;
        }}
        pre {{
            background: #f9f9f9;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
        }}
    </style>
</head>
<body>
    <div class="error-box">
        <h1>Preview Rendering Error</h1>
        <p>Failed to render page preview for version {version.version_number}.</p>
        {'<pre>' + str(e) + '</pre>' if settings.DEBUG else ''}
        <p><small>Page ID: {page_id} | Version ID: {version_id}</small></p>
    </div>
</body>
</html>
"""
        return HttpResponse(error_html, content_type="text/html", status=500)
