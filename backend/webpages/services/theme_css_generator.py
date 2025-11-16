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

        CSS is generated in a specific order where later rules override earlier ones:
        1. Google Fonts imports
        2. CSS variables from colors
        3. Widget type styles CSS (defaults that can be overridden)
        4. Design groups (overrides widget defaults with theme-specific styles)
        5. Component styles CSS
        6. Gallery styles CSS
        7. Carousel styles CSS

        Widget CSS loads before design groups so it acts as defaults.
        Design groups can then override widget styles for specific widgets/slots.

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

        # 2-3. Widget Type Styles CSS (defaults from registered widgets)
        # These provide baseline styles that design groups can override
        widget_css = self._generate_widget_css()
        if widget_css:
            css_parts.append(widget_css)

        # 4. Use theme's generate_css method for colors and design groups
        # Design groups override widget defaults with theme-specific element styles
        theme_css = theme.generate_css(scope="", widget_type=None, slot=None, frontend_scoped=frontend_scoped)
        if theme_css:
            css_parts.append(theme_css)

        # 5. Component Styles CSS
        if theme.component_styles:
            component_css = self._generate_component_css(theme.component_styles, theme)
            if component_css:
                css_parts.append(component_css)

        # 6. Gallery Styles CSS
        if theme.gallery_styles:
            gallery_css = self._generate_gallery_css(theme.gallery_styles, theme)
            if gallery_css:
                css_parts.append(gallery_css)

        # 7. Carousel Styles CSS
        if theme.carousel_styles:
            carousel_css = self._generate_carousel_css(theme.carousel_styles, theme)
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

    def _generate_component_css(self, component_styles, theme):
        """Generate CSS from component styles with breakpoint support"""
        if not component_styles:
            return ""

        css_parts = ["/* Component Styles */"]
        breakpoints = theme.get_breakpoints()

        for key, style in component_styles.items():
            css_content = style.get("css", "")
            if not css_content:
                continue
                
            css_parts.append(f"/* {style.get('name', key)} */")
            
            # Support both string (legacy) and object (new) formats
            if isinstance(css_content, str):
                css_parts.append(css_content)
            elif isinstance(css_content, dict):
                # Generate default + media queries
                if css_content.get('default'):
                    css_parts.append(css_content['default'])
                
                # Generate media queries for each breakpoint (mobile-first)
                for bp_key in ['sm', 'md', 'lg', 'xl']:
                    if css_content.get(bp_key) and breakpoints.get(bp_key):
                        media_query = f"@media (min-width: {breakpoints[bp_key]}px) {{\n{css_content[bp_key]}\n}}"
                        css_parts.append(media_query)

        return "\n\n".join(css_parts) if len(css_parts) > 1 else ""

    def _generate_gallery_css(self, gallery_styles, theme):
        """Generate CSS from gallery styles with breakpoint support"""
        if not gallery_styles:
            return ""

        css_parts = ["/* Gallery Styles */"]
        breakpoints = theme.get_breakpoints()

        for key, style in gallery_styles.items():
            css_content = style.get("css", "")
            if not css_content:
                continue
                
            css_parts.append(f"/* Gallery: {style.get('name', key)} */")
            
            # Support both string (legacy) and object (new) formats
            if isinstance(css_content, str):
                css_parts.append(css_content)
            elif isinstance(css_content, dict):
                # Generate default + media queries
                if css_content.get('default'):
                    css_parts.append(css_content['default'])
                
                # Generate media queries for each breakpoint (mobile-first)
                for bp_key in ['sm', 'md', 'lg', 'xl']:
                    if css_content.get(bp_key) and breakpoints.get(bp_key):
                        media_query = f"@media (min-width: {breakpoints[bp_key]}px) {{\n{css_content[bp_key]}\n}}"
                        css_parts.append(media_query)

        return "\n\n".join(css_parts) if len(css_parts) > 1 else ""

    def _generate_carousel_css(self, carousel_styles, theme):
        """Generate CSS from carousel styles with breakpoint support"""
        if not carousel_styles:
            return ""

        css_parts = ["/* Carousel Styles */"]
        breakpoints = theme.get_breakpoints()

        for key, style in carousel_styles.items():
            css_content = style.get("css", "")
            if not css_content:
                continue
                
            css_parts.append(f"/* Carousel: {style.get('name', key)} */")
            
            # Support both string (legacy) and object (new) formats
            if isinstance(css_content, str):
                css_parts.append(css_content)
            elif isinstance(css_content, dict):
                # Generate default + media queries
                if css_content.get('default'):
                    css_parts.append(css_content['default'])
                
                # Generate media queries for each breakpoint (mobile-first)
                for bp_key in ['sm', 'md', 'lg', 'xl']:
                    if css_content.get(bp_key) and breakpoints.get(bp_key):
                        media_query = f"@media (min-width: {breakpoints[bp_key]}px) {{\n{css_content[bp_key]}\n}}"
                        css_parts.append(media_query)

        return "\n\n".join(css_parts) if len(css_parts) > 1 else ""

    def _generate_widget_css(self):
        """Generate CSS from all registered widget types"""
        from webpages.widget_registry import widget_type_registry

        css_parts = ["/* Widget Type Styles */"]
        css_variables = {}

        # Get all registered widget types
        widget_types = widget_type_registry.list_widget_types(active_only=True)

        for widget_type in widget_types:
            # Skip widgets without CSS
            if not widget_type.widget_css:
                continue

            # Add widget CSS
            css_parts.append(f"/* Widget: {widget_type.name} ({widget_type.type}) */")
            css_parts.append(widget_type.widget_css)

            # Collect widget CSS variables
            if hasattr(widget_type, "css_variables") and widget_type.css_variables:
                css_variables.update(widget_type.css_variables)

        # Prepend CSS variables if any were collected
        if css_variables:
            variables_css = ":root {\n"
            for var_name, var_value in css_variables.items():
                # Add -- prefix if not already present
                if not var_name.startswith("--"):
                    var_name = f"--{var_name}"
                variables_css += f"  {var_name}: {var_value};\n"
            variables_css += "}"
            css_parts.insert(1, variables_css)

        return "\n\n".join(css_parts) if len(css_parts) > 1 else ""
