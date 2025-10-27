"""
PageTheme ViewSet for managing page themes.
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.http import HttpResponse
import json

from ..models import PageTheme
from ..serializers import PageThemeSerializer
from ..theme_service import ThemeService
from ..services import ThemeCSSGenerator


class PageThemeViewSet(viewsets.ModelViewSet):
    """ViewSet for managing page themes."""

    queryset = PageTheme.objects.all()
    serializer_class = PageThemeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active", "created_by"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["created_at"]  # Oldest first

    def create(self, request, *args, **kwargs):
        """Handle theme creation with image upload and JSON field parsing"""
        data = request.data.copy()

        # Parse JSON fields that might be sent as strings in FormData
        json_fields = [
            "fonts",
            "colors",
            "typography",
            "component_styles",
            "table_templates",
            "css_variables",
            "html_elements",
            "image_styles",
        ]
        for field in json_fields:
            if field in data and isinstance(data[field], str):
                try:
                    data[field] = json.loads(data[field])
                except (json.JSONDecodeError, TypeError):
                    # If parsing fails, let the serializer handle the validation error
                    pass

        # Create serializer with processed data
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    def update(self, request, *args, **kwargs):
        """Handle theme update with image upload and JSON field parsing"""
        data = request.data.copy()

        # Parse JSON fields that might be sent as strings in FormData
        json_fields = [
            "fonts",
            "colors",
            "typography",
            "component_styles",
            "table_templates",
            "css_variables",
            "html_elements",
            "image_styles",
        ]
        for field in json_fields:
            if field in data and isinstance(data[field], str):
                try:
                    data[field] = json.loads(data[field])
                except (json.JSONDecodeError, TypeError):
                    # If parsing fails, let the serializer handle the validation error
                    pass

        # Get the instance and update with processed data
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, "_prefetched_objects_cache", None):
            # If 'prefetch_related' has been applied to a queryset, we need to
            # forcibly invalidate the prefetch cache on the instance.
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Get only active themes"""
        active_themes = self.queryset.filter(is_active=True)
        serializer = self.get_serializer(active_themes, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def css(self, request, pk=None):
        """Generate CSS for a specific theme"""
        theme = self.get_object()
        scope = request.query_params.get("scope", ".theme-content")
        css_content = theme.generate_css(scope)
        return HttpResponse(css_content, content_type="text/css")

    @action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        """Get theme preview data with sample HTML"""
        theme = self.get_object()

        sample_html = """
        <div class="theme-content">
            <h1>Sample Heading 1</h1>
            <h2>Sample Heading 2</h2>
            <h3>Sample Heading 3</h3>
            <p>This is a sample paragraph with some <a href="#">linked text</a> to show how the theme styles different HTML elements.</p>
            <ul>
                <li>First list item</li>
                <li>Second list item with more content</li>
                <li>Third list item</li>
            </ul>
            <blockquote>
                This is a sample blockquote to demonstrate quote styling in the theme.
            </blockquote>
            <p>Here's some <code>inline code</code> and a code block:</p>
            <pre><code>function example() {
    return "Hello, World!";
}</code></pre>
        </div>
        """

        return Response(
            {
                "theme": PageThemeSerializer(theme).data,
                "css": theme.generate_css(),
                "sample_html": sample_html,
            }
        )

    @action(detail=False, methods=["post"])
    def create_defaults(self, request):
        """Create default themes for demonstration"""
        if not request.user.is_staff:
            return Response(
                {"error": "Only staff users can create default themes"},
                status=status.HTTP_403_FORBIDDEN,
            )

        created_themes = ThemeService.create_default_themes()
        serializer = PageThemeSerializer(created_themes, many=True)
        return Response(
            {
                "message": f"Created {len(created_themes)} default themes",
                "themes": serializer.data,
            }
        )

    @action(detail=False, methods=["get"])
    def html_elements_schema(self, request):
        """Get the schema for supported HTML elements and their CSS properties"""
        schema = {
            "supported_elements": [
                "h1",
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
                "p",
                "div",
                "span",
                "a",
                "a:hover",
                "a:focus",
                "a:active",
                "ul",
                "ol",
                "li",
                "blockquote",
                "code",
                "pre",
                "strong",
                "em",
                "small",
                "hr",
                "table",
                "th",
                "td",
                "tr",
            ],
            "common_properties": [
                "color",
                "background-color",
                "background",
                "font-size",
                "font-weight",
                "font-family",
                "font-style",
                "line-height",
                "letter-spacing",
                "margin",
                "margin-top",
                "margin-bottom",
                "margin-left",
                "margin-right",
                "padding",
                "padding-top",
                "padding-bottom",
                "padding-left",
                "padding-right",
                "border",
                "border-top",
                "border-bottom",
                "border-left",
                "border-right",
                "border-radius",
                "border-color",
                "border-width",
                "border-style",
                "text-align",
                "text-decoration",
                "text-transform",
                "display",
                "position",
                "width",
                "height",
                "max-width",
                "min-width",
                "transition",
                "transform",
                "opacity",
                "box-shadow",
            ],
            "css_variables": [
                "primary",
                "secondary",
                "accent",
                "text",
                "text-light",
                "text-dark",
                "background",
                "background-light",
                "background-dark",
                "border",
                "border-light",
                "border-dark",
                "success",
                "warning",
                "error",
                "info",
            ],
        }
        return Response(schema)

    @action(detail=False, methods=["get"])
    def default(self, request):
        """Get the current default theme for object content editors"""
        default_theme = PageTheme.get_default_theme()
        if default_theme:
            serializer = PageThemeSerializer(default_theme)
            return Response(serializer.data)
        else:
            return Response(
                {"message": "No default theme set"}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=["post"])
    def set_default(self, request, pk=None):
        """Set this theme as the default theme for object content editors"""
        theme = self.get_object()

        if not theme.is_active:
            return Response(
                {"error": "Cannot set inactive theme as default"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Clear any existing default themes and set this one
        PageTheme.objects.filter(is_default=True).update(is_default=False)
        theme.is_default = True
        theme.save()

        serializer = PageThemeSerializer(theme)
        return Response(
            {
                "message": f"'{theme.name}' is now the default theme",
                "theme": serializer.data,
            }
        )

    @action(detail=False, methods=["post"])
    def clear_default(self, request):
        """Clear the default theme setting"""
        PageTheme.objects.filter(is_default=True).update(is_default=False)
        return Response({"message": "Default theme cleared"})

    @action(detail=False, methods=["post"])
    def ensure_default(self, request):
        """Ensure a default theme exists, create one if necessary"""
        default_theme = PageTheme.get_default_theme()

        if default_theme:
            serializer = PageThemeSerializer(default_theme)
            return Response(
                {
                    "message": f"Default theme ensured: '{default_theme.name}'",
                    "theme": serializer.data,
                    "created": False,
                }
            )
        else:
            return Response(
                {"error": "Failed to create default theme"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def clone(self, request, pk=None):
        """Clone a theme with all its configuration"""
        theme = self.get_object()
        new_name = request.data.get("name")

        try:
            cloned_theme = theme.clone(new_name=new_name, created_by=request.user)
            serializer = PageThemeSerializer(cloned_theme)
            return Response(
                {
                    "message": f"Theme '{theme.name}' cloned as '{cloned_theme.name}'",
                    "theme": serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to clone theme: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"])
    def clear_cache(self, request, pk=None):
        """Manually clear CSS cache for this theme"""
        theme = self.get_object()
        generator = ThemeCSSGenerator()
        generator.invalidate_cache(theme.id)

        return Response(
            {
                "message": f"CSS cache cleared for theme '{theme.name}'",
                "status": "cache_cleared",
            }
        )
