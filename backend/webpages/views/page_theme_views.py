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

    @action(detail=True, methods=["get", "post"], url_path="library_images")
    def library_images(self, request, pk=None):
        """
        GET: List all images in theme library with metadata
        POST: Upload single or multiple images to library
        """
        from file_manager.storage import S3MediaStorage
        import os
        import uuid
        import logging
        from datetime import datetime

        logger = logging.getLogger(__name__)
        theme = self.get_object()
        storage = S3MediaStorage()

        if request.method == "GET":
            # List all images in library
            library_path = f"theme_images/{theme.id}/library/"

            try:
                images = []

                # List files with metadata directly from S3
                response = storage.client.list_objects_v2(
                    Bucket=storage.bucket_name, Prefix=library_path
                )

                logger.info(f"Listing library path: {library_path}")

                for obj in response.get("Contents", []):
                    # Skip the directory itself
                    if obj["Key"] == library_path:
                        continue

                    # Only get direct children (not nested)
                    file_path = obj["Key"][len(library_path) :]
                    if "/" in file_path:
                        continue

                    filename = file_path
                    full_path = obj["Key"]

                    try:
                        # Get URLs
                        url = storage.url(full_path)
                        public_url = (
                            storage.get_public_url(full_path)
                            if hasattr(storage, "get_public_url")
                            else url
                        )

                        # Get metadata from the list response
                        size = obj.get("Size", 0)
                        modified = obj.get("LastModified", datetime.now())

                        # Get usage information
                        used_in = theme.get_image_usage(filename)

                        # Extract image dimensions
                        width = None
                        height = None
                        try:
                            file_content = storage.get_file_content(full_path)
                            # Detect content type from filename extension
                            import mimetypes
                            content_type, _ = mimetypes.guess_type(filename)
                            if content_type and content_type.startswith("image/"):
                                metadata = storage.extract_metadata(file_content, content_type)
                                width = metadata.get("width")
                                height = metadata.get("height")
                        except Exception as dim_error:
                            logger.warning(f"Failed to extract dimensions for {filename}: {str(dim_error)}")

                        images.append(
                            {
                                "filename": filename,
                                "url": url,
                                "publicUrl": public_url,
                                "size": size,
                                "width": width,
                                "height": height,
                                "uploadedAt": (
                                    modified.isoformat()
                                    if hasattr(modified, "isoformat")
                                    else str(modified)
                                ),
                                "usedIn": used_in,
                            }
                        )
                        logger.info(f"Added image to list: {filename}")
                    except Exception as e:
                        logger.warning(f"Failed to get info for {filename}: {str(e)}")

                logger.info(f"Returning {len(images)} images")
                return Response({"images": images})

            except Exception as e:
                logger.error(f"Failed to list library images: {str(e)}")
                return Response(
                    {"error": f"Failed to list images: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        elif request.method == "POST":
            # Upload images to library
            if not request.FILES:
                return Response(
                    {"error": "No image files provided"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            allowed_types = [
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
                "image/svg+xml",
            ]
            max_size = 10 * 1024 * 1024  # 10MB

            uploaded_images = []
            errors = []

            for key, image_file in request.FILES.items():
                try:
                    # Validate file type
                    if image_file.content_type not in allowed_types:
                        errors.append(
                            {
                                "filename": image_file.name,
                                "error": f"Invalid file type: {image_file.content_type}",
                            }
                        )
                        continue

                    # Validate file size
                    if image_file.size > max_size:
                        errors.append(
                            {
                                "filename": image_file.name,
                                "error": "File too large. Maximum size is 10MB",
                            }
                        )
                        continue

                    # Generate unique filename
                    file_extension = os.path.splitext(image_file.name)[1].lower()
                    base_name = os.path.splitext(image_file.name)[0]
                    unique_filename = (
                        f"{base_name}_{uuid.uuid4().hex[:8]}{file_extension}"
                    )

                    # Upload to library
                    file_path = f"theme_images/{theme.id}/library/{unique_filename}"
                    logger.info(f"Uploading to path: {file_path}")
                    saved_path = storage._save(
                        file_path, ContentFile(image_file.read())
                    )
                    logger.info(f"Saved to: {saved_path}")

                    # Verify file exists
                    exists = storage.exists(file_path)
                    logger.info(f"File exists after save: {exists}")

                    # Get URLs
                    url = storage.url(file_path)
                    public_url = (
                        storage.get_public_url(file_path)
                        if hasattr(storage, "get_public_url")
                        else url
                    )
                    logger.info(f"Generated URL: {url}")

                    uploaded_images.append(
                        {
                            "filename": unique_filename,
                            "originalFilename": image_file.name,
                            "url": url,
                            "publicUrl": public_url,
                            "size": image_file.size,
                        }
                    )

                except Exception as e:
                    logger.error(f"Failed to upload {image_file.name}: {str(e)}")
                    errors.append({"filename": image_file.name, "error": str(e)})

            return Response(
                {
                    "uploaded": uploaded_images,
                    "errors": errors,
                    "success": len(uploaded_images),
                    "failed": len(errors),
                },
                status=(
                    status.HTTP_201_CREATED
                    if uploaded_images
                    else status.HTTP_400_BAD_REQUEST
                ),
            )

    @action(
        detail=True, methods=["delete"], url_path="library_images/(?P<filename>[^/]+)"
    )
    def delete_library_image(self, request, pk=None, filename=None):
        """
        Delete a specific image from theme library
        """
        from file_manager.storage import S3MediaStorage
        import logging

        logger = logging.getLogger(__name__)
        theme = self.get_object()
        storage = S3MediaStorage()

        if not filename:
            return Response(
                {"error": "Filename is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            file_path = f"theme_images/{theme.id}/library/{filename}"

            if not storage.exists(file_path):
                return Response(
                    {"error": "Image not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Check usage before deleting
            used_in = theme.get_image_usage(filename)
            if used_in and request.query_params.get("force") != "true":
                return Response(
                    {
                        "error": "Image is in use",
                        "usedIn": used_in,
                        "message": "Add ?force=true to delete anyway",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # Delete the file
            storage.delete(file_path)

            # If forced, clean up references
            if used_in:
                theme.delete_library_image(filename)

            return Response(
                {"message": f"Image '{filename}' deleted successfully"},
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Failed to delete library image: {str(e)}")
            return Response(
                {"error": f"Failed to delete image: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"], url_path="library_images/bulk_delete")
    def bulk_delete_library_images(self, request, pk=None):
        """
        Delete multiple images from theme library
        """
        from file_manager.storage import S3MediaStorage
        import logging

        logger = logging.getLogger(__name__)
        theme = self.get_object()
        storage = S3MediaStorage()

        filenames = request.data.get("filenames", [])
        force = request.data.get("force", False)

        if not filenames:
            return Response(
                {"error": "No filenames provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted = []
        errors = []
        in_use = []

        for filename in filenames:
            try:
                file_path = f"theme_images/{theme.id}/library/{filename}"

                if not storage.exists(file_path):
                    errors.append({"filename": filename, "error": "Image not found"})
                    continue

                # Check usage
                used_in = theme.get_image_usage(filename)
                if used_in and not force:
                    in_use.append({"filename": filename, "usedIn": used_in})
                    continue

                # Delete the file
                storage.delete(file_path)

                # Clean up references if forced
                if used_in:
                    theme.delete_library_image(filename)

                deleted.append(filename)

            except Exception as e:
                logger.error(f"Failed to delete {filename}: {str(e)}")
                errors.append({"filename": filename, "error": str(e)})

        return Response(
            {
                "deleted": deleted,
                "errors": errors,
                "inUse": in_use,
                "success": len(deleted),
                "failed": len(errors) + len(in_use),
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="library_images/(?P<filename>[^/]+)/usage",
    )
    def library_image_usage(self, request, pk=None, filename=None):
        """
        Get usage information for a specific library image
        """
        theme = self.get_object()

        if not filename:
            return Response(
                {"error": "Filename is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            used_in = theme.get_image_usage(filename)
            return Response(
                {"filename": filename, "usedIn": used_in, "isUsed": len(used_in) > 0}
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to get usage: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="library_images/(?P<filename>[^/]+)/rename",
    )
    def rename_library_image(self, request, pk=None, filename=None):
        """
        Rename a library image and update all references
        """
        from file_manager.storage import S3MediaStorage
        import logging
        import os

        logger = logging.getLogger(__name__)
        theme = self.get_object()
        storage = S3MediaStorage()

        if not filename:
            return Response(
                {"error": "Filename is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_filename = request.data.get("new_filename")
        if not new_filename:
            return Response(
                {"error": "new_filename is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            old_path = f"theme_images/{theme.id}/library/{filename}"
            new_path = f"theme_images/{theme.id}/library/{new_filename}"

            # Check if old file exists
            if not storage.exists(old_path):
                return Response(
                    {"error": "Image not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Check if new filename already exists
            if storage.exists(new_path):
                return Response(
                    {"error": "A file with the new name already exists"},
                    status=status.HTTP_409_CONFLICT,
                )

            # Copy file to new location
            file_content = storage.open(old_path, "rb").read()
            storage.save(new_path, ContentFile(file_content))

            # Delete old file
            storage.delete(old_path)

            # Update references in design_groups
            if theme.design_groups:
                updated = False
                for group in theme.design_groups:
                    if "image" in group and group["image"]:
                        if filename in group["image"]:
                            group["image"] = group["image"].replace(
                                filename, new_filename
                            )
                            updated = True
                if updated:
                    theme.save(update_fields=["design_groups"])

            # Update theme preview image if it matches
            if theme.image and filename in theme.image.name:
                # Note: This might need manual handling as it's an ImageField
                logger.warning(
                    f"Theme preview image contains old filename: {theme.image.name}"
                )

            return Response(
                {
                    "message": "Image renamed successfully",
                    "old_filename": filename,
                    "new_filename": new_filename,
                    "url": storage.get_public_url(new_path),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Failed to rename library image: {str(e)}")
            return Response(
                {"error": f"Failed to rename image: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="library_images/(?P<filename>[^/]+)/replace",
    )
    def replace_library_image(self, request, pk=None, filename=None):
        """
        Replace a library image with a new file (keeping the same filename)
        """
        from file_manager.storage import S3MediaStorage
        import logging
        import uuid

        logger = logging.getLogger(__name__)
        theme = self.get_object()
        storage = S3MediaStorage()

        if not filename:
            return Response(
                {"error": "Filename is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "image" not in request.FILES:
            return Response(
                {"error": "No image file provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            file = request.FILES["image"]

            # Validate file type
            allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif"]
            if file.content_type not in allowed_types:
                return Response(
                    {"error": f"Invalid file type: {file.content_type}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate file size (max 10MB)
            max_size = 10 * 1024 * 1024
            if file.size > max_size:
                return Response(
                    {"error": "File too large (max 10MB)"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            file_path = f"theme_images/{theme.id}/library/{filename}"

            # Check if file exists
            if not storage.exists(file_path):
                return Response(
                    {"error": "Image not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Delete old file
            storage.delete(file_path)

            # Save new file with same filename
            saved_path = storage.save(file_path, file)
            public_url = storage.get_public_url(saved_path)

            return Response(
                {
                    "message": "Image replaced successfully",
                    "filename": filename,
                    "url": saved_path,
                    "publicUrl": public_url,
                    "size": file.size,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Failed to replace library image: {str(e)}")
            return Response(
                {"error": f"Failed to replace image: {str(e)}"},
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

            # Add library images
            library_images = theme.list_library_images()
            if library_images:
                from file_manager.storage import S3MediaStorage
                import logging

                logger = logging.getLogger(__name__)
                storage = S3MediaStorage()

                for filename in library_images:
                    try:
                        path = f"theme_images/{theme.id}/library/{filename}"

                        # Read file from storage
                        if storage.exists(path):
                            file_obj = storage._open(path, "rb")
                            file_content = file_obj.read()
                            file_obj.close()

                            # Add to zip at: library_images/{filename}
                            zip_file.writestr(
                                f"library_images/{filename}", file_content
                            )
                        else:
                            logger.warning(f"Library image not found: {path}")

                    except Exception as e:
                        logger.warning(
                            f"Failed to add library image to export: {str(e)}"
                        )

            # Also include legacy design_group_images for backward compatibility
            design_group_images = theme.get_design_group_image_urls()
            if design_group_images:
                logger.info(
                    f"Found {len(design_group_images)} design group images (legacy)"
                )
                for url, metadata in design_group_images:
                    try:
                        # Extract path from URL
                        path = theme._extract_path_from_url(url)
                        if not path:
                            continue

                        # Extract filename
                        filename = path.split("/")[-1]

                        # Skip if already in library
                        if filename in library_images:
                            continue

                        # Read file from storage
                        if storage.exists(path):
                            file_obj = storage._open(path, "rb")
                            file_content = file_obj.read()
                            file_obj.close()

                            # Add to zip at: library_images/{filename} (migrate to library)
                            zip_file.writestr(
                                f"library_images/{filename}", file_content
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

                # Handle library images (new format)
                library_images = [
                    f for f in zf.namelist() if f.startswith("library_images/")
                ]

                # Also check for legacy design_group_images
                legacy_images = [
                    f for f in zf.namelist() if f.startswith("design_group_images/")
                ]

                # Combine both lists
                all_images = library_images + legacy_images

                if all_images:
                    from file_manager.storage import S3MediaStorage
                    import logging

                    logger = logging.getLogger(__name__)
                    storage = S3MediaStorage()
                    url_mapping = {}  # filename -> new_url

                    for image_file in all_images:
                        try:
                            image_name = image_file.split("/")[-1]
                            image_content = zf.read(image_file)

                            # Upload to new theme's library directory
                            new_path = (
                                f"theme_images/{new_theme.id}/library/{image_name}"
                            )
                            storage._save(new_path, ContentFile(image_content))
                            new_url = storage.url(new_path)

                            # Build mapping of filenames to new URLs
                            url_mapping[image_name] = new_url

                        except Exception as e:
                            logger.warning(
                                f"Failed to import image {image_file}: {str(e)}"
                            )

                    # Update image URLs in design_groups JSON
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
