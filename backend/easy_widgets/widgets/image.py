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

    mediaItems: List[ImageMediaItem] = Field(
        default_factory=list,
        description="List of images/videos to display",
        json_schema_extra={
            "hidden": True,  # Hidden from UI - managed by MediaSpecialEditor
        },
    )
    imageStyle: Optional[str] = Field(
        None,
        description="Named image style from the current theme (includes both gallery and carousel types)",
        json_schema_extra={
            "component": "ImageStyleSelect",
            "order": 1,
            "group": "Display Options",
            "placeholder": "Default",
        },
    )
    showCaptions: Optional[bool] = Field(
        None,
        description="Override style default: Display captions",
        json_schema_extra={
            "component": "BooleanInput",
            "group": "Override Settings",
            "order": 2,
            "variant": "toggle",
            "isOverride": True,
        },
    )
    lightboxGroup: Optional[str] = Field(
        None,
        description="Override style default: Group key to navigate between images in lightbox",
        json_schema_extra={
            "component": "TextInput",
            "order": 3,
            "group": "Override Settings",
            "placeholder": "widget-{{id}}",
            "isOverride": True,
        },
    )
    randomize: Optional[bool] = Field(
        None,
        description="Override style default: Randomize image order on each page load",
        json_schema_extra={
            "component": "BooleanInput",
            "order": 4,
            "group": "Override Settings",
            "variant": "toggle",
            "isOverride": True,
        },
    )
    autoPlay: Optional[bool] = Field(
        None,
        description="Override style default: Auto-play carousel (only for carousel-type image styles)",
        json_schema_extra={
            "component": "BooleanInput",
            "order": 5,
            "group": "Override Settings",
            "variant": "toggle",
            "conditionalOn": {"imageStyle": "carousel"},
            "isOverride": True,
        },
    )
    autoPlayInterval: Optional[int] = Field(
        None,
        ge=1,
        le=30,
        description="Override style default: Auto-play interval in seconds for carousel",
        json_schema_extra={
            "component": "SliderInput",
            "order": 6,
            "group": "Override Settings",
            "min": 1,
            "max": 30,
            "step": 1,
            "unit": "seconds",
            "showValue": True,
            "conditionalOn": {"imageStyle": "carousel"},
            "isOverride": True,
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
    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
            "order": 0,
            "group": "Display Options",
        },
    )
    useContentMargins: bool = Field(
        False,
        description="Use content margins (extra left/right padding on larger screens)",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "order": 1,
            "group": "Display Options",
        },
    )
    anchor: str = Field(
        "",
        description="Anchor ID for linking to this section",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "section-name",
            "order": 9999,
            "group": "Advanced",
        },
    )
    anchor_title: str = Field(
        "",
        description="Anchor title (for navigation menus)",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "Display name for navigation",
            "helpText": "Displayed in navigation menus when linking to this image",
            "order": 10000,
            "group": "Advanced",
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
        margin-bottom: 30px;
    }
    .image-widget:last-child {
        image-widget: 0;
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

        # Get theme and style for applying defaults (context may contain theme)
        theme = context.get("theme")
        style = None
        style_name = config.get("image_style")

        if theme and style_name:
            image_styles = theme.image_styles or {}
            style = image_styles.get(style_name)
            if not style:
                # Fallback to legacy
                gallery_styles = theme.gallery_styles or {}
                carousel_styles = theme.carousel_styles or {}
                style = gallery_styles.get(style_name) or carousel_styles.get(
                    style_name
                )

        # Check if we have a collection to resolve
        collection_id = config.get("collection_id")
        if collection_id:
            # Resolve collection images
            collection_images = self.resolve_collection_images(collection_id)

            # Add resolved images to media_items
            if collection_images:
                template_config["media_items"] = collection_images

                # Apply collection configuration if present
                collection_config = config.get("collection_config", {})
                if collection_config:
                    # Apply max items limit first (before randomization)
                    max_items = collection_config.get("max_items", 0)
                    if max_items > 0:
                        template_config["media_items"] = template_config["media_items"][
                            :max_items
                        ]

        # Ensure we have media_items
        if "media_items" not in template_config:
            camel_case_items = template_config.get("media_items", [])
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

        # Apply style defaults with widget overrides
        # enableLightbox now comes from style only
        template_config["enable_lightbox"] = (
            style.get("enableLightbox", True) if style else True
        )

        # Apply widget overrides or style defaults for other settings
        # showCaptions
        show_captions_override = template_config.get(
            "showCaptions"
        ) or template_config.get("show_captions")
        if show_captions_override is not None:
            template_config["show_captions"] = show_captions_override
        elif style and "defaultShowCaptions" in style:
            template_config["show_captions"] = style["defaultShowCaptions"]
        else:
            template_config["show_captions"] = True

        # lightboxGroup
        lightbox_group_override = template_config.get(
            "lightboxGroup"
        ) or template_config.get("lightbox_group")
        if lightbox_group_override is not None:
            template_config["lightbox_group"] = lightbox_group_override
        elif style and "defaultLightboxGroup" in style:
            template_config["lightbox_group"] = style["defaultLightboxGroup"]
        else:
            template_config["lightbox_group"] = None

        # autoPlay (carousel only)
        auto_play_override = template_config.get("auto_play")
        if auto_play_override is not None:
            template_config["auto_play"] = auto_play_override
        elif style and "defaultAutoPlay" in style:
            template_config["auto_play"] = style["defaultAutoPlay"]
        else:
            template_config["auto_play"] = False

        # autoPlayInterval (carousel only)
        auto_play_interval_override = template_config.get("auto_play_interval")
        if auto_play_interval_override is not None:
            template_config["auto_play_interval"] = auto_play_interval_override
        elif style and "defaultAutoPlayInterval" in style:
            template_config["auto_play_interval"] = style["defaultAutoPlayInterval"]
        else:
            template_config["auto_play_interval"] = 3

        template_config["lightbox_style"] = template_config.get("lightbox_style")
        template_config["imgproxy_override"] = template_config.get("imgproxy_override")
        template_config["use_content_margins"] = config.get("use_content_margins", False)

        # Apply randomization if enabled (widget override, then style default, then collection config)
        randomize_override = config.get("randomize")
        if randomize_override is not None:
            should_randomize = randomize_override
        elif style and "defaultRandomize" in style:
            should_randomize = style["defaultRandomize"]
        else:
            # Check collection config as fallback
            collection_config = config.get("collection_config") or config.get(
                "collectionConfig", {}
            )
            should_randomize = (
                collection_config.get("randomize", False)
                if collection_config
                else False
            )
        if should_randomize and template_config.get("media_items"):
            import random

            template_config["media_items"] = random.sample(
                template_config["media_items"],
                len(template_config["media_items"]),
            )

        return template_config

    def render_with_component_style(self, config, theme):
        """
        Render image widget with custom component style from theme.

        Args:
            config: Widget configuration
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) or None for default rendering
        """
        from webpages.utils.mustache_renderer import (
            render_mustache,
            prepare_component_context,
        )
        from django.template.loader import render_to_string

        style_name = config.get("component_style", "default")
        if not style_name or style_name == "default":
            return None

        styles = theme.component_styles or {}
        style = styles.get(style_name)
        if not style:
            return None

        template_str = style.get("template", "")
        css = style.get("css", "")

        # Check for passthru marker (must be only content in template after trimming)
        if template_str.strip() == "{{passthru}}":
            # Passthru mode: use default rendering but inject CSS
            return None, css

        # Prepare template context first
        prepared_config = self.prepare_template_context(config, {"theme": theme})

        # Render the widget HTML using the default template first
        widget_html = render_to_string(self.template_name, {"config": prepared_config})

        # Prepare context with rendered widget as content
        context = prepare_component_context(
            content=widget_html,
            anchor=prepared_config.get("anchor", ""),
            style_vars=style.get("variables", {}),
            config=prepared_config,  # Pass processed config for granular control
        )

        # Render with style template
        html = render_mustache(template_str, context)
        return html, css

    def render_with_style(self, config, theme=None):
        """
        Render images using theme's image style with Mustache templates.

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

        # Check for component_style first (takes precedence over image_style)
        component_style_name = config.get("component_style") or config.get(
            "componentStyle"
        )
        if component_style_name and component_style_name != "default" and theme:
            result = self.render_with_component_style(config, theme)
            if result is not None:
                return result

        # Get style name
        style_name = config.get("image_style")

        # Only render with custom style if a style is explicitly selected
        if not style_name or style_name == "default":
            return None

        # Get style from theme's unified image_styles
        style = None
        if theme:
            # Use unified image_styles with fallback to legacy fields
            image_styles = theme.image_styles or {}
            style = image_styles.get(style_name)

            # Fallback to legacy gallery_styles and carousel_styles if not found
            if not style:
                gallery_styles = theme.gallery_styles or {}
                carousel_styles = theme.carousel_styles or {}
                style = gallery_styles.get(style_name) or carousel_styles.get(
                    style_name
                )

        # If style not found, return None to use default template
        if not style:
            return None

        # Get styleType from the style (defaults to 'gallery' for backward compatibility)
        style_type = style.get("styleType", "gallery")

        # Prepare context for Mustache rendering
        images = config.get("media_items", [])
        if not images:
            return None

        # Get imgproxy config from style (can be overridden by widget config)
        imgproxy_config = style.get("imgproxy_config")
        lightbox_config = style.get("lightbox_config")

        # Extract style defaults for overrides
        style_defaults = {
            "enableLightbox": style.get("enableLightbox", True),
            "lightboxTemplate": style.get("lightboxTemplate", ""),
            "defaultShowCaptions": style.get("defaultShowCaptions", True),
            "defaultLightboxGroup": style.get("defaultLightboxGroup", ""),
            "defaultRandomize": style.get("defaultRandomize", False),
        }

        # Add carousel-specific defaults if carousel type
        if style_type == "carousel":
            style_defaults["defaultAutoPlay"] = style.get("defaultAutoPlay", False)
            style_defaults["defaultAutoPlayInterval"] = style.get(
                "defaultAutoPlayInterval", 3
            )

        # Use styleType to determine which context to prepare
        if style_type == "carousel":
            context = prepare_carousel_context(
                images, config, style.get("variables"), imgproxy_config, style_defaults
            )
        else:
            context = prepare_gallery_context(
                images,
                config,
                style.get("variables"),
                imgproxy_config,
                lightbox_config,
                style_defaults,
            )

        # Render template
        html = render_mustache(style.get("template", ""), context)
        css = style.get("css", "")

        # Ensure we return valid HTML (not empty string) when using custom style
        if not html or html.strip() == "":
            return None

        return html, css
