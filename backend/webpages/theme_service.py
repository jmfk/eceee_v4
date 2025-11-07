"""
Theme Service for resolving and applying themes across different entity types.

This service handles theme inheritance, CSS generation, and application for:
- Pages (direct theme assignment)
- Layouts (default themes for layout classes)
- Object types (default themes for object type definitions)
"""

from typing import Optional, Dict, Any, List, Union
from django.core.cache import cache
from django.utils.html import format_html
from .models import PageTheme, WebPage
from webpages.layout_registry import layout_registry


class ThemeFallbackService:
    """Service providing fallback values when theme elements are missing"""

    DEFAULT_SYSTEM_FONTS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif"

    FALLBACK_COLORS = {
        "primary": "#3b82f6",
        "secondary": "#64748b",
        "accent": "#f59e0b",
        "text-dark": "#1f2937",
        "text-light": "#6b7280",
        "background": "#ffffff",
        "border": "#e5e7eb",
    }

    FALLBACK_TYPOGRAPHY = {
        "groups": [
            {
                "name": "System Default",
                "widget_type": None,
                "slot": None,
                "elements": {
                    "h1": {
                        "font": DEFAULT_SYSTEM_FONTS,
                        "size": "2rem",
                        "lineHeight": "1.2",
                        "fontWeight": "700",
                        "marginBottom": "1rem",
                        "color": "text-dark",
                    },
                    "h2": {
                        "font": DEFAULT_SYSTEM_FONTS,
                        "size": "1.5rem",
                        "lineHeight": "1.3",
                        "fontWeight": "600",
                        "marginBottom": "0.75rem",
                        "color": "text-dark",
                    },
                    "p": {
                        "font": DEFAULT_SYSTEM_FONTS,
                        "size": "1rem",
                        "lineHeight": "1.6",
                        "marginBottom": "1rem",
                        "color": "text-dark",
                    },
                    "a": {"color": "primary", "textDecoration": "underline"},
                    "ul": {
                        "bulletType": "disc",
                        "paddingLeft": "1.5rem",
                        "marginBottom": "1rem",
                    },
                    "ol": {
                        "bulletType": "decimal",
                        "paddingLeft": "1.5rem",
                        "marginBottom": "1rem",
                    },
                },
            }
        ]
    }

    FALLBACK_COMPONENT_STYLE = {
        "name": "Default",
        "description": "Basic wrapper",
        "template": "<div>{{content}}</div>",
        "css": "",
    }

    FALLBACK_TABLE_TEMPLATE = {
        "name": "Simple Table",
        "rows": [
            {
                "cells": [
                    {"content": "Header 1", "font_style": "normal"},
                    {"content": "Header 2", "font_style": "normal"},
                ]
            },
            {
                "cells": [
                    {"content": "Cell 1", "font_style": "normal"},
                    {"content": "Cell 2", "font_style": "normal"},
                ]
            },
        ],
        "column_widths": ["auto", "auto"],
    }

    @classmethod
    def get_fallback_font(cls) -> str:
        """Get fallback system font stack"""
        return cls.DEFAULT_SYSTEM_FONTS

    @classmethod
    def get_fallback_color(cls, color_name: str) -> str:
        """Get fallback color value"""
        return cls.FALLBACK_COLORS.get(color_name, "#000000")

    @classmethod
    def get_fallback_design_groups(cls) -> Dict[str, Any]:
        """Get fallback design groups configuration"""
        return cls.FALLBACK_TYPOGRAPHY.copy()

    @classmethod
    def get_fallback_component_style(cls) -> Dict[str, Any]:
        """Get fallback component style"""
        return cls.FALLBACK_COMPONENT_STYLE.copy()

    @classmethod
    def get_fallback_table_template(cls) -> Dict[str, Any]:
        """Get fallback table template"""
        return cls.FALLBACK_TABLE_TEMPLATE.copy()


class ThemeService:
    """Service for theme resolution and CSS generation"""

    CACHE_PREFIX = "theme_service"
    CACHE_TIMEOUT = 300  # 5 minutes

    @classmethod
    def resolve_theme_for_page(cls, page: WebPage) -> Optional[PageTheme]:
        """
        Resolve the effective theme for a page, considering inheritance hierarchy.

        Priority order:
        1. Page's current published version theme
        2. Parent page's theme (recursive up the hierarchy)
        3. Default theme (fallback)
        4. None (no theme)
        """
        # Check current published version theme
        current_version = page.get_current_published_version()
        if current_version and current_version.theme:
            return current_version.theme

        # Check parent theme (recursive)
        if page.parent:
            parent_theme = cls.resolve_theme_for_page(page.parent)
            if parent_theme:
                return parent_theme

        # Fall back to default theme
        default_theme = cls.get_default_theme()
        if default_theme:
            return default_theme

        return None

    @classmethod
    def get_default_theme(cls) -> Optional[PageTheme]:
        """
        Get the default theme for object content editors and widgets.
        """
        return PageTheme.get_default_theme()

    @classmethod
    def generate_css_for_page(
        cls,
        page_id: int,
        scope: str = ".theme-content",
        widget_type: Optional[str] = None,
        slot: Optional[str] = None,
    ) -> str:
        """
        Generate CSS for a specific page using its effective theme.

        Args:
            page_id: The page ID
            scope: CSS scope selector
            widget_type: Optional widget type for targeted design groups
            slot: Optional slot name for targeted design groups
        """
        cache_key = (
            f"{cls.CACHE_PREFIX}:css:page:{page_id}:{scope}:{widget_type}:{slot}"
        )
        cached_css = cache.get(cache_key)

        if cached_css is not None:
            return cached_css

        try:
            page = WebPage.objects.get(id=page_id)
            theme = cls.resolve_theme_for_page(page)
            css = theme.generate_css(scope, widget_type, slot) if theme else ""
        except WebPage.DoesNotExist:
            css = ""

        cache.set(cache_key, css, cls.CACHE_TIMEOUT)
        return css

    @classmethod
    def generate_default_theme_css(cls, scope: str = ".theme-content") -> str:
        """
        Generate CSS for the default theme (used in object content editors).
        """
        cache_key = f"{cls.CACHE_PREFIX}:css:default:{scope}"
        cached_css = cache.get(cache_key)

        if cached_css is not None:
            return cached_css

        theme = cls.get_default_theme()
        css = theme.generate_css(scope) if theme else ""

        cache.set(cache_key, css, cls.CACHE_TIMEOUT)
        return css

    @classmethod
    def get_available_themes(cls, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get list of available themes"""
        cache_key = f"{cls.CACHE_PREFIX}:available_themes:{active_only}"
        cached_themes = cache.get(cache_key)

        if cached_themes is not None:
            return cached_themes

        queryset = PageTheme.objects.all()
        if active_only:
            queryset = queryset.filter(is_active=True)

        themes = [theme.to_dict() for theme in queryset.order_by("name")]
        cache.set(cache_key, themes, cls.CACHE_TIMEOUT)
        return themes

    @classmethod
    def get_google_fonts_url_for_page(cls, page_id: int) -> Optional[str]:
        """Get Google Fonts URL for a specific page's theme"""
        try:
            page = WebPage.objects.get(id=page_id)
            theme = cls.resolve_theme_for_page(page)
            return theme.get_google_fonts_url() if theme else None
        except WebPage.DoesNotExist:
            return None

    @classmethod
    def get_google_fonts_url_for_theme(cls, theme_id: int) -> Optional[str]:
        """Get Google Fonts URL for a specific theme"""
        try:
            theme = PageTheme.objects.get(id=theme_id)
            return theme.get_google_fonts_url()
        except PageTheme.DoesNotExist:
            return None

    @classmethod
    def get_component_style(
        cls, theme_id: int, style_name: str
    ) -> Optional[Dict[str, Any]]:
        """Get a component style from a theme with fallback"""
        try:
            theme = PageTheme.objects.get(id=theme_id)
            return theme.get_component_style(style_name)
        except PageTheme.DoesNotExist:
            return None

    @classmethod
    def get_table_template(
        cls, theme_id: int, template_name: str
    ) -> Optional[Dict[str, Any]]:
        """Get a table template from a theme"""
        try:
            theme = PageTheme.objects.get(id=theme_id)
            return theme.get_table_template(template_name)
        except PageTheme.DoesNotExist:
            return None

    @classmethod
    def get_theme_colors(cls, theme_id: int) -> Dict[str, str]:
        """Get named colors from a theme"""
        try:
            theme = PageTheme.objects.get(id=theme_id)
            return theme.colors or theme.css_variables or {}
        except PageTheme.DoesNotExist:
            return {}

    @classmethod
    def invalidate_cache(cls, theme_id: Optional[int] = None):
        """Invalidate theme-related cache entries"""
        if theme_id:
            # Invalidate specific theme caches
            cache.delete_many(
                [f"{cls.CACHE_PREFIX}:css:*", f"{cls.CACHE_PREFIX}:available_themes:*"]
            )
        else:
            # Invalidate all theme caches
            cache.delete_pattern(f"{cls.CACHE_PREFIX}:*")

    @classmethod
    def create_default_themes(cls):
        """Create some default themes for demonstration"""
        default_themes = [
            {
                "name": "Modern Blue",
                "description": "Clean modern theme with blue accents",
                "css_variables": {
                    "primary": "#3b82f6",
                    "secondary": "#64748b",
                    "text": "#1e293b",
                    "background": "#ffffff",
                    "border": "#e2e8f0",
                },
                "html_elements": {
                    "h1": {
                        "color": "var(--primary)",
                        "font-size": "2.5rem",
                        "font-weight": "700",
                        "margin-bottom": "1.5rem",
                    },
                    "h2": {
                        "color": "var(--primary)",
                        "font-size": "2rem",
                        "font-weight": "600",
                        "margin-bottom": "1rem",
                    },
                    "h3": {
                        "color": "var(--secondary)",
                        "font-size": "1.5rem",
                        "font-weight": "600",
                        "margin-bottom": "0.75rem",
                    },
                    "p": {
                        "color": "var(--text)",
                        "line-height": "1.6",
                        "margin-bottom": "1rem",
                    },
                    "ul": {"margin-bottom": "1rem", "padding-left": "1.5rem"},
                    "li": {"margin-bottom": "0.5rem", "color": "var(--text)"},
                    "a": {
                        "color": "var(--primary)",
                        "text-decoration": "underline",
                        "transition": "color 0.2s",
                    },
                    "a:hover": {"color": "var(--secondary)"},
                    "blockquote": {
                        "border-left": "4px solid var(--primary)",
                        "padding-left": "1rem",
                        "margin": "1.5rem 0",
                        "font-style": "italic",
                        "color": "var(--secondary)",
                    },
                },
            },
            {
                "name": "Warm Earth",
                "description": "Warm, earthy theme with brown and orange tones",
                "css_variables": {
                    "primary": "#d97706",
                    "secondary": "#78716c",
                    "text": "#44403c",
                    "background": "#fefdf8",
                    "border": "#e7e5e4",
                },
                "html_elements": {
                    "h1": {
                        "color": "var(--primary)",
                        "font-size": "2.25rem",
                        "font-weight": "800",
                        "margin-bottom": "1.25rem",
                    },
                    "h2": {
                        "color": "var(--primary)",
                        "font-size": "1.875rem",
                        "font-weight": "700",
                        "margin-bottom": "1rem",
                    },
                    "h3": {
                        "color": "var(--secondary)",
                        "font-size": "1.5rem",
                        "font-weight": "600",
                        "margin-bottom": "0.75rem",
                    },
                    "p": {
                        "color": "var(--text)",
                        "line-height": "1.7",
                        "margin-bottom": "1.25rem",
                    },
                    "ul": {"margin-bottom": "1.25rem", "padding-left": "1.75rem"},
                    "li": {"margin-bottom": "0.75rem", "color": "var(--text)"},
                    "a": {
                        "color": "var(--primary)",
                        "text-decoration": "none",
                        "border-bottom": "2px solid transparent",
                        "transition": "border-color 0.2s",
                    },
                    "a:hover": {"border-bottom-color": "var(--primary)"},
                },
            },
        ]

        created_themes = []
        for theme_data in default_themes:
            theme, created = PageTheme.objects.get_or_create(
                name=theme_data["name"],
                defaults={
                    "description": theme_data["description"],
                    "css_variables": theme_data["css_variables"],
                    "html_elements": theme_data["html_elements"],
                    "created_by_id": 1,  # Assumes admin user exists
                },
            )
            if created:
                created_themes.append(theme)

        return created_themes
