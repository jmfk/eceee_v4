"""
PageTheme ViewSet for managing page themes.
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.http import HttpResponse
from django.core.files.base import ContentFile
import json
import zipfile
import io
from datetime import datetime

from ..models import PageTheme
from ..serializers import PageThemeSerializer
from ..theme_service import ThemeService
from ..services import ThemeCSSGenerator
from ..services.style_ai_helper import StyleAIHelper


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
            "design_groups",
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
            "design_groups",
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

    @action(detail=True, methods=["post"])
    def upload_design_group_image(self, request, pk=None):
        """
        Upload an image for design group layoutProperties.
        Stores in: theme_images/{theme_id}/design_groups/{filename}
        Returns: { "url": "s3://bucket/path", "public_url": "https://..." }
        """
        from file_manager.storage import S3MediaStorage
        import os
        import uuid
        import logging

        logger = logging.getLogger(__name__)
        theme = self.get_object()

        if "image" not in request.FILES:
            return Response(
                {"error": "No image file provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        image_file = request.FILES["image"]

        # Validate file type
        allowed_types = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/svg+xml",
        ]
        if image_file.content_type not in allowed_types:
            return Response(
                {
                    "error": f'Invalid file type. Allowed types: {", ".join(allowed_types)}'
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file size (10MB max)
        max_size = 10 * 1024 * 1024  # 10MB
        if image_file.size > max_size:
            return Response(
                {"error": "File too large. Maximum size is 10MB"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Generate unique filename
            file_extension = os.path.splitext(image_file.name)[1].lower()
            unique_filename = f"{uuid.uuid4()}{file_extension}"

            # Upload to object storage
            storage = S3MediaStorage()
            file_path = f"theme_images/{theme.id}/design_groups/{unique_filename}"

            # Save the file
            storage._save(file_path, ContentFile(image_file.read()))

            # Get URLs
            s3_url = storage.url(file_path)  # s3:// protocol for imgproxy
            public_url = storage.get_public_url(file_path)  # https:// for direct access

            return Response(
                {
                    "url": s3_url,
                    "public_url": public_url,
                    "filename": image_file.name,
                    "size": image_file.size,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            logger.error(f"Failed to upload design group image: {str(e)}")
            return Response(
                {"error": f"Failed to upload image: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="ai-style-helper")
    def ai_style_helper(self, request, pk=None):
        """
        AI helper for generating/modifying theme styles.

        Request body:
        {
            "style_type": "gallery" | "carousel" | "component",
            "user_prompt": "Generate a masonry gallery layout",
            "current_style": {
                "name": "...",
                "description": "...",
                "template": "...",
                "css": "..."
            },
            "context_log": [
                {"role": "user", "content": "..."},
                {"role": "assistant", "content": "..."}
            ]
        }

        Response:
        {
            "type": "question" | "result",
            "question": "..." (if type=question),
            "template": "..." (if type=result),
            "css": "..." (if type=result),
            "usage": {
                "input_tokens": int,
                "output_tokens": int,
                "total_cost": Decimal
            }
        }
        """
        # Validate request data
        style_type = request.data.get("style_type")
        user_prompt = request.data.get("user_prompt")
        current_style = request.data.get("current_style", {})
        context_log = request.data.get("context_log", [])

        if not style_type:
            return Response(
                {"error": "style_type is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user_prompt:
            return Response(
                {"error": "user_prompt is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if style_type not in StyleAIHelper.STYLE_TYPES:
            return Response(
                {
                    "error": f"Invalid style_type. Must be one of: {StyleAIHelper.STYLE_TYPES}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create AI helper
        helper = StyleAIHelper(
            user=request.user,
            provider=request.data.get("provider", "openai"),
            model=request.data.get("model", "gpt-4o-mini"),
        )

        try:
            # Generate style
            result = helper.generate_style(
                style_type=style_type,
                user_prompt=user_prompt,
                current_style=current_style,
                context_log=context_log,
            )

            return Response(result)

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"AI generation failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["get"])
    def export_theme(self, request, pk=None):
        """
        Export a theme as a zip file containing:
        - theme.json (theme data)
        - metadata.json (name, description, creation date, author, version)
        - image file (if exists)
        """
        theme = self.get_object()

        # Create in-memory zip file
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            # Prepare theme data (exclude image field, we'll handle it separately)
            theme_data = {
                "fonts": theme.fonts,
                "colors": theme.colors,
                "design_groups": theme.design_groups,
                "component_styles": theme.component_styles,
                "image_styles": theme.image_styles,
                "gallery_styles": theme.gallery_styles,
                "carousel_styles": theme.carousel_styles,
                "table_templates": theme.table_templates,
                "breakpoints": theme.breakpoints,
                "css_variables": theme.css_variables,
                "html_elements": theme.html_elements,
                "custom_css": theme.custom_css,
                "is_active": theme.is_active,
            }

            # Write theme data
            zip_file.writestr(
                "theme.json", json.dumps(theme_data, indent=2, ensure_ascii=False)
            )

            # Prepare metadata
            metadata = {
                "name": theme.name,
                "description": theme.description,
                "created_at": theme.created_at.isoformat(),
                "updated_at": theme.updated_at.isoformat(),
                "created_by": (theme.created_by.username if theme.created_by else None),
                "version": "1.0",
                "export_date": datetime.now().isoformat(),
            }

            # Write metadata
            zip_file.writestr(
                "metadata.json", json.dumps(metadata, indent=2, ensure_ascii=False)
            )

            # Add image if exists
            if theme.image:
                try:
                    image_name = theme.image.name.split("/")[-1]
                    zip_file.writestr(f"image/{image_name}", theme.image.read())
                except Exception as e:
                    # Log error but continue
                    logger.warning(f"Failed to add image to export: {str(e)}")

            # Add design group images if they exist
            design_group_images = theme.get_design_group_image_urls()
            if design_group_images:
                from file_manager.storage import S3MediaStorage
                import logging

                logger = logging.getLogger(__name__)
                storage = S3MediaStorage()

                for url, metadata in design_group_images:
                    try:
                        # Extract path from URL
                        path = theme._extract_path_from_url(url)
                        if not path:
                            continue

                        # Extract filename
                        filename = path.split("/")[-1]

                        # Read file from storage
                        if storage.exists(path):
                            file_obj = storage._open(path, "rb")
                            file_content = file_obj.read()
                            file_obj.close()

                            # Add to zip at: design_group_images/{filename}
                            zip_file.writestr(
                                f"design_group_images/{filename}", file_content
                            )
                        else:
                            logger.warning(f"Design group image not found: {path}")

                    except Exception as e:
                        logger.warning(
                            f"Failed to add design group image to export: {str(e)}"
                        )

        # Prepare response
        zip_buffer.seek(0)
        response = HttpResponse(zip_buffer.read(), content_type="application/zip")
        response["Content-Disposition"] = (
            f'attachment; filename="theme_{theme.name.replace(" ", "_")}.zip"'
        )

        return response

    @action(detail=False, methods=["post"])
    def import_theme(self, request):
        """
        Import a theme from a zip file.
        Expects multipart/form-data with 'theme_zip' file.
        """
        if "theme_zip" not in request.FILES:
            return Response(
                {"error": "No theme_zip file provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        zip_file = request.FILES["theme_zip"]

        try:
            # Read zip file
            with zipfile.ZipFile(zip_file, "r") as zf:
                # Read theme data
                if "theme.json" not in zf.namelist():
                    return Response(
                        {"error": "Invalid theme zip: missing theme.json"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                theme_data = json.loads(zf.read("theme.json").decode("utf-8"))

                # Read metadata
                metadata = {}
                if "metadata.json" in zf.namelist():
                    metadata = json.loads(zf.read("metadata.json").decode("utf-8"))

                # Generate unique name if name already exists
                base_name = metadata.get("name", "Imported Theme")
                name = base_name
                counter = 1
                while PageTheme.objects.filter(name=name).exists():
                    counter += 1
                    name = f"{base_name} ({counter})"

                # Create theme
                new_theme = PageTheme.objects.create(
                    name=name,
                    description=metadata.get(
                        "description", "Imported from theme package"
                    ),
                    fonts=theme_data.get("fonts", {}),
                    colors=theme_data.get("colors", {}),
                    design_groups=theme_data.get("design_groups", {}),
                    component_styles=theme_data.get("component_styles", {}),
                    image_styles=theme_data.get("image_styles", {}),
                    gallery_styles=theme_data.get("gallery_styles", {}),
                    carousel_styles=theme_data.get("carousel_styles", {}),
                    table_templates=theme_data.get("table_templates", {}),
                    breakpoints=theme_data.get("breakpoints", {}),
                    css_variables=theme_data.get("css_variables", {}),
                    html_elements=theme_data.get("html_elements", {}),
                    custom_css=theme_data.get("custom_css", ""),
                    is_active=theme_data.get("is_active", True),
                    is_default=False,  # Imported themes are never default
                    created_by=request.user,
                )

                # Handle image if exists
                image_files = [f for f in zf.namelist() if f.startswith("image/")]
                if image_files:
                    image_file = image_files[0]
                    image_name = image_file.split("/")[-1]
                    image_content = zf.read(image_file)
                    new_theme.image.save(
                        image_name, ContentFile(image_content), save=True
                    )

                # Handle design group images
                design_group_images = [
                    f for f in zf.namelist() if f.startswith("design_group_images/")
                ]
                if design_group_images:
                    from file_manager.storage import S3MediaStorage
                    import logging

                    logger = logging.getLogger(__name__)
                    storage = S3MediaStorage()
                    url_mapping = {}  # old_url -> new_url

                    for image_file in design_group_images:
                        try:
                            image_name = image_file.split("/")[-1]
                            image_content = zf.read(image_file)

                            # Upload to new theme's directory
                            new_path = f"theme_images/{new_theme.id}/design_groups/{image_name}"
                            storage._save(new_path, ContentFile(image_content))
                            new_url = storage.url(new_path)

                            # Build mapping of filenames to new URLs
                            # We'll use filename as the key since we don't have old URLs
                            url_mapping[image_name] = new_url

                        except Exception as e:
                            logger.warning(
                                f"Failed to import design group image {image_file}: {str(e)}"
                            )

                    # Update image URLs in design_groups JSON
                    # Need to match by filename and update URLs
                    if url_mapping and new_theme.design_groups:
                        updated_groups = new_theme.design_groups.copy()
                        if "groups" in updated_groups:
                            for group in updated_groups["groups"]:
                                if "layoutProperties" in group:
                                    for part, breakpoints in group[
                                        "layoutProperties"
                                    ].items():
                                        for bp, props in breakpoints.items():
                                            if "images" in props and isinstance(
                                                props["images"], dict
                                            ):
                                                for (
                                                    image_key,
                                                    image_data,
                                                ) in props["images"].items():
                                                    if isinstance(image_data, dict):
                                                        # Try to match by filename
                                                        old_url = image_data.get(
                                                            "url"
                                                        ) or image_data.get("fileUrl")
                                                        if old_url:
                                                            # Extract filename from old URL
                                                            old_filename = (
                                                                old_url.split("/")[-1]
                                                            )
                                                            if (
                                                                old_filename
                                                                in url_mapping
                                                            ):
                                                                image_data["url"] = (
                                                                    url_mapping[
                                                                        old_filename
                                                                    ]
                                                                )
                                                                # Remove fileUrl if present
                                                                if (
                                                                    "fileUrl"
                                                                    in image_data
                                                                ):
                                                                    del image_data[
                                                                        "fileUrl"
                                                                    ]

                        new_theme.design_groups = updated_groups
                        new_theme.save()

            serializer = PageThemeSerializer(new_theme, context={"request": request})
            return Response(
                {
                    "message": f"Theme imported successfully as '{name}'",
                    "theme": serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )

        except zipfile.BadZipFile:
            return Response(
                {"error": "Invalid zip file"}, status=status.HTTP_400_BAD_REQUEST
            )
        except json.JSONDecodeError as e:
            return Response(
                {"error": f"Invalid JSON in theme package: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to import theme: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
