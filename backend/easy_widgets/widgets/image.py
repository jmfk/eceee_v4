"""
Image widget implementation.
"""

from typing import Type, Optional, List, Literal, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type

import logging

logger = logging.getLogger(__name__)


class ImageMediaItem(BaseModel):
    """Individual media item for Image widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    id: Optional[str] = Field(None, description="Media file ID")
    url: str = Field(..., description="Media URL (image or video)")
    type: Literal["image", "video"] = Field("image", description="Media type")
    altText: str = Field(
        ..., min_length=1, description="Alternative text for accessibility"
    )
    caption: Optional[str] = Field(None, description="Optional caption")
    title: Optional[str] = Field(None, description="Image title")
    photographer: Optional[str] = Field(None, description="Photographer or source")
    source: Optional[str] = Field(None, description="Image source")
    thumbnailUrl: Optional[str] = Field(None, description="Thumbnail URL for videos")
    width: Optional[int] = Field(None, description="Image width")
    height: Optional[int] = Field(None, description="Image height")


class ImageConfig(BaseModel):
    """Configuration for Image widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    anchor: str = Field(
        "",
        description="Anchor Title",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "section-name",
        },
    )
    mediaItems: List[ImageMediaItem] = Field(
        default_factory=list,
        description="List of images/videos to display",
        json_schema_extra={
            "hidden": True,  # Hidden from UI - managed by MediaSpecialEditor
        },
    )
    displayType: Literal["gallery", "carousel"] = Field(
        "gallery",
        description="How to display multiple items (single image display is automatic)",
        json_schema_extra={
            "component": "SegmentedControlInput",
            "variant": "default",
            "order": 1,
            "group": "Display Options",
            "options": [
                {"value": "gallery", "label": "Gallery", "icon": "Grid"},
                {"value": "carousel", "label": "Carousel", "icon": "Play"},
            ],
        },
    )
    imageStyle: Optional[str] = Field(
        None,
        description="Named image style from the current theme (gallery or carousel styles based on displayType)",
        json_schema_extra={
            "component": "ImageStyleSelect",
            "order": 2,
            "group": "Display Options",
            "placeholder": "Default",
            "dependsOn": ["displayType"],
        },
    )
    enableLightbox: bool = Field(
        True,
        description="Enable lightbox for full-size viewing",
        json_schema_extra={
            "component": "BooleanInput",
            "group": "Display Options",
            "order": 3,
            "variant": "toggle",
        },
    )
    showCaptions: bool = Field(
        True,
        description="Display captions",
        json_schema_extra={
            "component": "BooleanInput",
            "group": "Display Options",
            "order": 4,
            "variant": "toggle",
        },
    )
    lightboxStyle: Optional[str] = Field(
        None,
        description="Named lightbox style from theme (defaults to 'default')",
        json_schema_extra={
            "component": "LightboxStyleSelect",
            "order": 8,
            "group": "Display Options",
            "placeholder": "Default",
        },
    )
    lightboxGroup: Optional[str] = Field(
        None,
        description="Group key to navigate between images in lightbox",
        json_schema_extra={
            "component": "TextInput",
            "order": 9,
            "group": "Display Options",
            "placeholder": "widget-{{id}}",
        },
    )
    autoPlay: bool = Field(
        False,
        description="Auto-play videos (if applicable)",
        json_schema_extra={
            "component": "BooleanInput",
            "order": 5,
            "group": "Advanced Settings",
            "variant": "toggle",
        },
    )
    autoPlayInterval: int = Field(
        3,
        ge=1,
        le=30,
        description="Auto-play interval in seconds for carousel",
        json_schema_extra={
            "component": "SliderInput",
            "order": 6,
            "group": "Advanced Settings",
            "min": 1,
            "max": 30,
            "step": 1,
            "unit": "seconds",
            "showValue": True,
        },
    )
    randomize: bool = Field(
        False,
        description="Randomize image order on each page load",
        json_schema_extra={
            "component": "BooleanInput",
            "order": 7,
            "group": "Advanced Settings",
            "variant": "toggle",
        },
    )

    # Imgproxy override settings (optional widget-level override of style defaults)
    imgproxyOverride: Optional[Dict[str, Any]] = Field(
        None,
        description="Override imgproxy settings from style (width, height, resize_type, gravity)",
        json_schema_extra={
            "hidden": True,  # Hidden from auto-generated UI for now
        },
    )

    # Collection support (managed by MediaSpecialEditor)
    collectionId: Optional[str] = Field(
        None,
        description="ID of selected media collection",
        json_schema_extra={
            "hidden": True,  # Hidden from UI - managed by MediaSpecialEditor
        },
    )
    collectionConfig: Optional[dict] = Field(
        None,
        description="Collection display configuration",
        json_schema_extra={
            "hidden": True,  # Hidden from UI - managed by MediaSpecialEditor
        },
    )


@register_widget_type
class ImageWidget(BaseWidget):
    """Image widget that contains image, image gallery, or video"""

    name = "Image"
    description = "Image widget that contains image, image gallery, or video"
    template_name = "easy_widgets/widgets/image.html"

    widget_css = """
    .image-widget {
        display: block;
        text-align: var(--image-alignment, center);
    }
    
    .image-widget img {
        max-width: 100%;
        height: auto;
        border-radius: var(--image-radius, 0);
        box-shadow: var(--image-shadow, none);
        border: var(--image-border, none);
    }
    
    .image-widget video {
        max-width: 100%;
        height: auto;
        border-radius: var(--video-radius, 0.5rem);
        box-shadow: var(--video-shadow, 0 4px 6px rgba(0, 0, 0, 0.1));
    }
    
    .image-widget .caption {
        margin-top: var(--caption-margin-top, 0.5rem);
        font-size: var(--caption-font-size, 0.875rem);
        color: var(--caption-color, #6b7280);
        font-style: var(--caption-style, italic);
        text-align: var(--caption-alignment, center);
    }
    
    .image-widget .gallery {
        display: grid;
        grid-template-columns: repeat(var(--gallery-columns, 3), 1fr);
        gap: var(--gallery-gap, 1rem);
        margin: var(--gallery-margin, 1rem 0);
    }
    
    .image-widget .gallery img {
        width: 100%;
        height: var(--gallery-item-height, 200px);
        object-fit: cover;
        cursor: pointer;
        transition: transform 0.2s ease-in-out;
    }
    
    .image-widget .gallery img:hover {
        transform: scale(1.05);
    }
    
    .image-widget.size-small img,
    .image-widget.size-small video {
        max-width: var(--size-small, 300px);
    }
    
    .image-widget.size-medium img,
    .image-widget.size-medium video {
        max-width: var(--size-medium, 600px);
    }
    
    .image-widget.size-large img,
    .image-widget.size-large video {
        max-width: var(--size-large, 900px);
    }
    
    .image-widget.size-full img,
    .image-widget.size-full video {
        max-width: 100%;
        width: 100%;
    }
    """

    css_variables = {
        "image-alignment": "center",
        "image-radius": "0",
        "image-shadow": "none",
        "image-border": "none",
        "video-radius": "0.5rem",
        "video-shadow": "0 4px 6px rgba(0, 0, 0, 0.1)",
        "caption-margin-top": "0.5rem",
        "caption-font-size": "0.875rem",
        "caption-color": "#6b7280",
        "caption-style": "italic",
        "caption-alignment": "center",
        "gallery-columns": "3",
        "gallery-gap": "1rem",
        "gallery-margin": "1rem 0",
        "gallery-item-height": "200px",
        "size-small": "300px",
        "size-medium": "600px",
        "size-large": "900px",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ImageConfig

    def resolve_collection_images(self, collection_id, namespace=None):
        """
        Resolve collection ID to actual media items for rendering.

        Args:
            collection_id: ID of the collection to resolve
            namespace: Optional namespace for the collection

        Returns:
            List of media items in the format expected by the template
        """
        if not collection_id:
            return []

        try:
            from file_manager.models import MediaCollection, MediaFile

            # Get the collection
            collection = MediaCollection.objects.get(id=collection_id)

            # Get all files in the collection (using reverse relationship mediafile_set)
            collection_files = collection.mediafile_set.filter(
                is_deleted=False  # Only get non-deleted files
            ).order_by("created_at")

            # Convert to the format expected by the template (snake_case)
            media_items = []
            for media_file in collection_files:
                # Determine media type
                media_type = "video" if media_file.file_type == "video" else "image"

                # Get URL - use get_file_url() method to generate URL from file_path
                file_url = (
                    media_file.get_file_url()
                    if hasattr(media_file, "get_file_url")
                    else (media_file.file_url or "")
                )

                if media_file.file_type == "image" and hasattr(
                    media_file, "get_imgproxy_url"
                ):
                    # Use imgproxy for thumbnail (e.g., 800px wide)
                    thumbnail_url = media_file.get_imgproxy_url(width=800)
                    full_url = file_url
                else:
                    thumbnail_url = file_url
                    full_url = file_url

                media_items.append(
                    {
                        "id": str(media_file.id),
                        "url": full_url or "",
                        "type": media_type,
                        "alt_text": media_file.title or "",  # Use title as alt text
                        "caption": media_file.description or "",
                        "title": media_file.title or "",
                        "photographer": "",  # Not available in MediaFile model
                        "source": "",  # Not available in MediaFile model
                        "width": media_file.width,
                        "height": media_file.height,
                        "thumbnail_url": thumbnail_url or full_url or "",
                    }
                )

            return media_items

        except Exception as e:
            # Log error and return empty list to prevent template crashes
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Failed to resolve collection {collection_id}: {e}")
            return []

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with resolved collection images if needed.

        This method is called before template rendering to allow widgets
        to modify their configuration or add additional context.
        """
        # Start with the base configuration
        template_config = config.copy() if config else {}
        context = context if context else {}

        # Check if we have a collection to resolve
        collection_id = config.get("collection_id") or config.get("collectionId")
        if collection_id:
            # Resolve collection images
            collection_images = self.resolve_collection_images(collection_id)

            # Add resolved images to media_items (converting from camelCase to snake_case for template)
            if collection_images:
                template_config["media_items"] = collection_images

                # Apply collection configuration if present
                collection_config = config.get("collection_config") or config.get(
                    "collectionConfig", {}
                )
                if collection_config:
                    # Apply max items limit first (before randomization)
                    max_items = collection_config.get(
                        "max_items"
                    ) or collection_config.get("maxItems", 0)
                    if max_items > 0:
                        template_config["media_items"] = template_config["media_items"][
                            :max_items
                        ]

        # Ensure we have media_items and convert from camelCase if needed
        if "media_items" not in template_config:
            camel_case_items = template_config.get("mediaItems", [])
            # Convert camelCase fields to snake_case for template compatibility
            snake_case_items = []
            for item in camel_case_items:
                if isinstance(item, dict):
                    snake_case_item = {
                        "id": item.get("id"),
                        "url": item.get("url"),
                        "type": item.get("type", "image"),
                        "alt_text": item.get("altText", ""),
                        "caption": item.get("caption", ""),
                        "title": item.get("title", ""),
                        "photographer": item.get("photographer", ""),
                        "source": item.get("source", ""),
                        "width": item.get("width"),
                        "height": item.get("height"),
                        "thumbnail_url": item.get("thumbnailUrl"),
                    }
                    snake_case_items.append(snake_case_item)
                else:
                    snake_case_items.append(item)
            template_config["media_items"] = snake_case_items

        # Convert other camelCase config fields to snake_case for template
        template_config["display_type"] = template_config.get(
            "displayType", template_config.get("display_type", "single")
        )
        template_config["image_style"] = template_config.get(
            "imageStyle", template_config.get("image_style", None)
        )
        template_config["gallery_columns"] = template_config.get(
            "galleryColumns", template_config.get("gallery_columns", 3)
        )
        template_config["enable_lightbox"] = template_config.get(
            "enableLightbox", template_config.get("enable_lightbox", True)
        )
        template_config["lightbox_style"] = template_config.get(
            "lightboxStyle", template_config.get("lightbox_style", None)
        )
        template_config["lightbox_group"] = template_config.get(
            "lightboxGroup", template_config.get("lightbox_group", None)
        )
        template_config["auto_play"] = template_config.get(
            "autoPlay", template_config.get("auto_play", False)
        )
        template_config["show_captions"] = template_config.get(
            "showCaptions", template_config.get("show_captions", True)
        )
        template_config["imgproxy_override"] = template_config.get(
            "imgproxyOverride", template_config.get("imgproxy_override", None)
        )

        # Apply randomization if enabled (check widget-level first, then collection config)
        collection_config = config.get("collection_config") or config.get(
            "collectionConfig", {}
        )
        should_randomize = config.get("randomize", False) or (
            collection_config and collection_config.get("randomize", False)
        )
        if should_randomize and template_config.get("media_items"):
            import random

            template_config["media_items"] = random.sample(
                template_config["media_items"],
                len(template_config["media_items"]),
            )

        return template_config

    def render_with_style(self, config, theme=None):
        """
        Render images using theme's gallery or carousel style with Mustache templates.

        Args:
            config: Widget configuration (already prepared via prepare_template_context)
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) or None if no custom style
        """
        from webpages.utils.mustache_renderer import (
            render_mustache,
            prepare_gallery_context,
            prepare_carousel_context,
        )

        # Support both snake_case and camelCase (config might not be converted yet)
        display_type = config.get("display_type") or config.get(
            "displayType", "gallery"
        )
        style_name = config.get("image_style") or config.get("imageStyle")

        # Only render with custom style if a style is explicitly selected
        if not style_name or style_name == "default":
            return None

        # Get style from theme
        style = None
        if theme:
            if display_type == "carousel":
                styles = theme.carousel_styles or {}
            else:
                styles = theme.gallery_styles or {}

            style = styles.get(style_name)

        # If style not found, return None to use default template
        if not style:
            return None

        # Prepare context for Mustache rendering
        images = config.get("media_items", [])
        if not images:
            return None

        # Get imgproxy config from style (can be overridden by widget config)
        imgproxy_config = style.get("imgproxy_config")
        lightbox_config = style.get("lightbox_config")

        if display_type == "carousel":
            context = prepare_carousel_context(
                images, config, style.get("variables"), imgproxy_config
            )
        else:
            context = prepare_gallery_context(
                images, config, style.get("variables"), imgproxy_config, lightbox_config
            )

        # Render template
        html = render_mustache(style.get("template", ""), context)
        css = style.get("css", "")

        # Ensure we return valid HTML (not empty string) when using custom style
        if not html or html.strip() == "":
            return None

        return html, css
