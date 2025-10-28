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

    def get_cache_key(self, theme_id):
        """Generate cache key for theme CSS"""
        return f"{self.CACHE_PREFIX}{theme_id}"

    def get_cached_css(self, theme_id):
        """
        Retrieve cached CSS from Redis.

        Args:
            theme_id: Theme ID

        Returns:
            Cached CSS string or None if not cached
        """
        cache_key = self.get_cache_key(theme_id)
        return cache.get(cache_key)

    def set_cached_css(self, theme_id, css, timeout=None):
        """
        Store CSS in Redis cache.

        Args:
            theme_id: Theme ID
            css: Generated CSS string
            timeout: Cache timeout in seconds (None = use default)
        """
        cache_key = self.get_cache_key(theme_id)
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

    def generate_complete_css(self, theme):
        """
        Generate complete CSS from all theme components.

        Includes:
        - Google Fonts imports
        - CSS variables from colors
        - Typography styles
        - Component styles CSS
        - Gallery styles CSS
        - Carousel styles CSS
        - Lightbox styles (from component_styles)
        - Custom CSS

        Args:
            theme: PageTheme instance

        Returns:
            Complete CSS string
        """
        css_parts = []

        # 1. Google Fonts Imports
        if theme.fonts and theme.fonts.get("google_fonts"):
            fonts_import = self._generate_fonts_import(theme.fonts["google_fonts"])
            if fonts_import:
                css_parts.append(fonts_import)

        # 2. CSS Variables from colors
        if theme.colors:
            variables_css = self._generate_color_variables(theme.colors)
            if variables_css:
                css_parts.append(variables_css)

        # 3. Typography (HTML element styles)
        if theme.typography and theme.typography.get("groups"):
            typography_css = self._generate_typography_css(theme.typography)
            if typography_css:
                css_parts.append(typography_css)

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

        # 7. Custom CSS
        if theme.custom_css:
            css_parts.append(f"/* Custom CSS */\n{theme.custom_css}")

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

    def _generate_color_variables(self, colors):
        """Generate CSS custom properties from color definitions"""
        if not colors:
            return ""

        css = ":root {\n"
        for name, value in colors.items():
            css += f"  --{name}: {value};\n"
        css += "}"

        return css

    def _generate_typography_css(self, typography):
        """Generate CSS from typography groups with optional class scoping"""
        if not typography or not typography.get("groups"):
            return ""

        css_parts = []

        for group in typography["groups"]:
            group_name = group.get("name", "")
            class_name = group.get("className", None)
            elements = group.get("elements", {})

            if elements:
                scope_info = f" (scoped: .{class_name})" if class_name else " (global)"
                css_parts.append(f"/* Typography: {group_name}{scope_info} */")

                for element, styles in elements.items():
                    if not styles:
                        continue

                    # Build selector with optional class scope
                    if class_name:
                        selector = f".{class_name} {element}"
                    else:
                        selector = element

                    css = f"{selector} {{\n"

                    # Handle font
                    if "font" in styles:
                        css += f"  font-family: '{styles['font']}', sans-serif;\n"

                    # Handle other properties with expanded property map
                    property_map = {
                        "size": "font-size",
                        "fontSize": "font-size",
                        "lineHeight": "line-height",
                        "fontWeight": "font-weight",
                        "fontStyle": "font-style",
                        "marginBottom": "margin-bottom",
                        "marginTop": "margin-top",
                        "marginLeft": "margin-left",
                        "marginRight": "margin-right",
                        "paddingTop": "padding-top",
                        "paddingBottom": "padding-bottom",
                        "paddingLeft": "padding-left",
                        "paddingRight": "padding-right",
                        "color": "color",
                        "backgroundColor": "background-color",
                        "textDecoration": "text-decoration",
                        "textTransform": "text-transform",
                        "letterSpacing": "letter-spacing",
                        "bulletType": "list-style-type",
                    }

                    for style_key, css_prop in property_map.items():
                        if style_key in styles:
                            value = styles[style_key]
                            # If it's a color variable reference, use var()
                            if style_key in (
                                "color",
                                "backgroundColor",
                            ) and not value.startswith(("#", "rgb", "var")):
                                value = f"var(--{value})"
                            css += f"  {css_prop}: {value};\n"

                    css += "}"
                    css_parts.append(css)

        return "\n\n".join(css_parts)

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
