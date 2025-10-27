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

        Returns:
            CSS response with proper headers
        """
        # Get theme
        theme = get_object_or_404(PageTheme, id=theme_id)

        # Initialize generator
        generator = ThemeCSSGenerator()

        # Check cache first
        cached_css = generator.get_cached_css(theme_id)

        if cached_css is not None:
            css = cached_css
        else:
            # Generate CSS
            css = generator.generate_complete_css(theme)

            # Cache it
            generator.set_cached_css(theme_id, css)

        # Return CSS with proper headers
        response = HttpResponse(css, content_type="text/css; charset=utf-8")

        # Add cache control headers
        if settings.DEBUG:
            # No caching in dev
            response["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response["Pragma"] = "no-cache"
            response["Expires"] = "0"
        else:
            # Cache for 24 hours in production (browser caching)
            response["Cache-Control"] = "public, max-age=86400"

        return response
