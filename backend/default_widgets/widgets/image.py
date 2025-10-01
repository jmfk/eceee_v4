"""
Image widget implementation.
"""

from typing import Type
from pydantic import BaseModel

from webpages.widget_registry import BaseWidget, register_widget_type
from ..widget_models import ImageConfig


@register_widget_type
class ImageWidget(BaseWidget):
    """Image widget that contains image, image gallery, or video"""

    name = "Image"
    description = "Image widget that contains image, image gallery, or video"
    template_name = "default_widgets/widgets/image.html"

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

            # Get all files in the collection
            collection_files = collection.files.filter(
                status="approved"  # Only get approved files
            ).order_by("created_at")

            # Convert to the format expected by the template (snake_case)
            media_items = []
            for media_file in collection_files:
                media_items.append(
                    {
                        "id": str(media_file.id),
                        "url": media_file.imgproxy_base_url or media_file.file_url,
                        "type": "image",  # Assume image for now, could be enhanced
                        "alt_text": media_file.alt_text or media_file.title or "",
                        "caption": media_file.description or "",
                        "title": media_file.title or "",
                        "photographer": media_file.photographer or "",
                        "source": media_file.source or "",
                        "width": media_file.width,
                        "height": media_file.height,
                        "thumbnail_url": media_file.imgproxy_base_url
                        or media_file.file_url,
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
                    # Apply randomization if requested
                    if collection_config.get("randomize", False):
                        import random

                        template_config["media_items"] = random.sample(
                            template_config["media_items"],
                            len(template_config["media_items"]),
                        )

                    # Apply max items limit
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
        template_config["gallery_columns"] = template_config.get(
            "galleryColumns", template_config.get("gallery_columns", 3)
        )
        template_config["enable_lightbox"] = template_config.get(
            "enableLightbox", template_config.get("enable_lightbox", True)
        )
        template_config["auto_play"] = template_config.get(
            "autoPlay", template_config.get("auto_play", False)
        )
        template_config["show_captions"] = template_config.get(
            "showCaptions", template_config.get("show_captions", True)
        )

        return template_config
