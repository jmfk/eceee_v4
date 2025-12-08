"""
Theme CSS Views

API endpoints for serving theme CSS dynamically.
"""

from django.http import HttpResponse
from django.views import View
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.conf import settings

from webpages.models import PageTheme
from webpages.services import ThemeCSSGenerator


class ThemeCSSView(View):
    """
    Serve theme CSS dynamically.

    GET /api/themes/{theme_id}/styles.css
    Returns CSS with proper Content-Type and Cache-Control headers.
    """

    def get(self, request, theme_id):
        """
        Generate and serve CSS for a theme.

        Args:
            request: HTTP request
            theme_id: Theme ID

        Query Parameters:
            frontend_scoped: If 'true', prepend .cms-content to design group selectors

        Returns:
            CSS response with proper headers
        """
        # Get theme
        theme = get_object_or_404(PageTheme, id=theme_id)

        # Parse frontend_scoped query parameter
        frontend_scoped = request.GET.get('frontend_scoped', '').lower() == 'true'

        # Initialize generator
        generator = ThemeCSSGenerator()

        # Skip cache entirely in development (when CACHE_TIMEOUT is 0)
        if generator.CACHE_TIMEOUT == 0:
            # Development mode - always generate fresh CSS
            css = generator.generate_complete_css(theme, frontend_scoped=frontend_scoped)
        else:
            # Production mode - use cache (include frontend_scoped in cache key)
            cached_css = generator.get_cached_css(theme_id, frontend_scoped=frontend_scoped)

            if cached_css is not None:
                css = cached_css
            else:
                # Generate CSS
                css = generator.generate_complete_css(theme, frontend_scoped=frontend_scoped)

                # Cache it
                generator.set_cached_css(theme_id, css, frontend_scoped=frontend_scoped)

        # Return CSS with proper headers
        response = HttpResponse(css, content_type="text/css; charset=utf-8")

        # Add cache control headers
        if settings.DEBUG:
            # No caching in dev
            response["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response["Pragma"] = "no-cache"
            response["Expires"] = "0"
        else:
            # Cache for 1 year - URL version changes when content updates
            response["Cache-Control"] = "public, max-age=31536000, immutable"
            # Add Last-Modified header for better cache validation
            response["Last-Modified"] = theme.updated_at.strftime('%a, %d %b %Y %H:%M:%S GMT')

        return response
