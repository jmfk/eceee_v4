"""
Theme CSS Generator Service

Generates complete CSS from all theme components and manages caching.
"""

from django.core.cache import cache
from django.conf import settings


class ThemeCSSGenerator:
    """Service for generating and caching theme CSS"""

    CACHE_PREFIX = "theme_css_"
    CACHE_TIMEOUT = getattr(
        settings, "THEME_CSS_CACHE_TIMEOUT", 3600 * 24
    )  # 24 hours default

    def get_cache_key(self, theme_id, frontend_scoped=False):
        """Generate cache key for theme CSS"""
        suffix = "_frontend" if frontend_scoped else ""
        return f"{self.CACHE_PREFIX}{theme_id}{suffix}"

    def get_cached_css(self, theme_id, frontend_scoped=False):
        """
        Retrieve cached CSS from Redis.

        Args:
            theme_id: Theme ID
            frontend_scoped: If True, get frontend-scoped CSS cache

        Returns:
            Cached CSS string or None if not cached
        """
        cache_key = self.get_cache_key(theme_id, frontend_scoped)
        return cache.get(cache_key)

    def set_cached_css(self, theme_id, css, timeout=None, frontend_scoped=False):
        """
        Store CSS in Redis cache.

        Args:
            theme_id: Theme ID
            css: Generated CSS string
            timeout: Cache timeout in seconds (None = use default)
            frontend_scoped: If True, cache frontend-scoped CSS separately
        """
        cache_key = self.get_cache_key(theme_id, frontend_scoped)
        timeout = timeout if timeout is not None else self.CACHE_TIMEOUT
        cache.set(cache_key, css, timeout)

    def invalidate_cache(self, theme_id):
        """
        Clear cached CSS for theme.

        Args:
            theme_id: Theme ID
        """
        cache_key = self.get_cache_key(theme_id)
        cache.delete(cache_key)

    def generate_complete_css(self, theme, frontend_scoped=False):
        """
        Generate complete CSS from all theme components.

        Includes:
        - Google Fonts imports
        - CSS variables from colors
        - Design groups (from PageTheme.generate_css for proper data attribute targeting)
        - Component styles CSS
        - Gallery styles CSS
        - Carousel styles CSS
        - Custom CSS

        Args:
            theme: PageTheme instance
            frontend_scoped: If True, prepend .cms-content to design group selectors

        Returns:
            Complete CSS string
        """
        css_parts = []

        # 1. Google Fonts Imports
        if theme.fonts and theme.fonts.get("google_fonts"):
            fonts_import = self._generate_fonts_import(theme.fonts["google_fonts"])
            if fonts_import:
                css_parts.append(fonts_import)

        # 2-3. Use theme's generate_css method for colors and design groups
        # This ensures proper widget_type/slot targeting with data attributes
        theme_css = theme.generate_css(scope="", widget_type=None, slot=None, frontend_scoped=frontend_scoped)
        if theme_css:
            css_parts.append(theme_css)

        # 4. Component Styles CSS
        if theme.component_styles:
            component_css = self._generate_component_css(theme.component_styles)
            if component_css:
                css_parts.append(component_css)

        # 5. Gallery Styles CSS
        if theme.gallery_styles:
            gallery_css = self._generate_gallery_css(theme.gallery_styles)
            if gallery_css:
                css_parts.append(gallery_css)

        # 6. Carousel Styles CSS
        if theme.carousel_styles:
            carousel_css = self._generate_carousel_css(theme.carousel_styles)
            if carousel_css:
                css_parts.append(carousel_css)

        return "\n\n".join(css_parts)

    def _generate_fonts_import(self, google_fonts):
        """Generate @import statement for Google Fonts"""
        if not google_fonts or not isinstance(google_fonts, list):
            return ""

        imports = []
        for font in google_fonts:
            family = font.get("family", "")
            variants = font.get("variants", ["400"])
            display = font.get("display", "swap")

            if family:
                # Format: Inter:wght@400;500;600
                family_param = family.replace(" ", "+")
                if variants:
                    weights = ";".join(str(v) for v in variants)
                    family_param = f"{family_param}:wght@{weights}"

                imports.append(
                    f"@import url('https://fonts.googleapis.com/css2?family={family_param}&display={display}');"
                )

        return "\n".join(imports) if imports else ""

    def _generate_component_css(self, component_styles):
        """Generate CSS from component styles"""
        if not component_styles:
            return ""

        css_parts = ["/* Component Styles */"]

        for key, style in component_styles.items():
            css_content = style.get("css", "")
            if css_content:
                css_parts.append(f"/* {style.get('name', key)} */")
                css_parts.append(css_content)

        return "\n\n".join(css_parts) if len(css_parts) > 1 else ""

    def _generate_gallery_css(self, gallery_styles):
        """Generate CSS from gallery styles"""
        if not gallery_styles:
            return ""

        css_parts = ["/* Gallery Styles */"]

        for key, style in gallery_styles.items():
            css_content = style.get("css", "")
            if css_content:
                css_parts.append(f"/* Gallery: {style.get('name', key)} */")
                css_parts.append(css_content)

        return "\n\n".join(css_parts) if len(css_parts) > 1 else ""

    def _generate_carousel_css(self, carousel_styles):
        """Generate CSS from carousel styles"""
        if not carousel_styles:
            return ""

        css_parts = ["/* Carousel Styles */"]

        for key, style in carousel_styles.items():
            css_content = style.get("css", "")
            if css_content:
                css_parts.append(f"/* Carousel: {style.get('name', key)} */")
                css_parts.append(css_content)

        return "\n\n".join(css_parts) if len(css_parts) > 1 else ""
