"""
Mustache template renderer for component styles, gallery styles, and carousel styles.
"""

import chevron


def render_mustache(template, context):
    """
    Render a Mustache template with the given context.

    Args:
        template: Mustache template string
        context: Dictionary of template variables

    Returns:
        Rendered HTML string
    """
    try:
        return chevron.render(template, context)
    except Exception as e:
        # Log error and return safe fallback
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Mustache render error: {e}")
        return f"<!-- Template render error: {str(e)} -->"


def prepare_gallery_context(images, config, style_vars=None):
    """
    Prepare context for gallery template rendering.

    Args:
        images: List of image dicts (url, width, height, alt, caption, etc.)
        config: Widget configuration
        style_vars: Style-specific variables

    Returns:
        Dictionary ready for Mustache rendering
    """
    # Add index to each image (make a copy to avoid mutating input)
    indexed_images = []
    for i, img in enumerate(images):
        img_copy = img.copy() if isinstance(img, dict) else {}
        img_copy["index"] = i
        indexed_images.append(img_copy)

    return {
        "images": indexed_images,
        "imageCount": len(images),
        "multipleImages": len(images) > 1,
        "showCaptions": config.get("show_captions", True),
        "enableLightbox": config.get("enable_lightbox", True),
        "columns": style_vars.get("columns", 3) if style_vars else 3,
        **(style_vars or {}),
    }


def prepare_carousel_context(images, config, style_vars=None):
    """
    Prepare context for carousel template rendering.

    Args:
        images: List of image dicts (url, width, height, alt, caption, etc.)
        config: Widget configuration
        style_vars: Style-specific variables

    Returns:
        Dictionary ready for Mustache rendering
    """
    # Add index to each image (make a copy to avoid mutating input)
    indexed_images = []
    for i, img in enumerate(images):
        img_copy = img.copy() if isinstance(img, dict) else {}
        img_copy["index"] = i
        indexed_images.append(img_copy)

    return {
        "images": indexed_images,
        "imageCount": len(images),
        "multipleImages": len(images) > 1,
        "showCaptions": config.get("show_captions", True),
        "autoPlay": config.get("auto_play", False),
        "autoPlayInterval": config.get("auto_play_interval", 3),
        **(style_vars or {}),
    }


def prepare_component_context(content, style_vars=None):
    """
    Prepare context for component style template rendering.

    Args:
        content: The content to render (HTML string or dict)
        style_vars: Style-specific variables

    Returns:
        Dictionary ready for Mustache rendering
    """
    return {
        "content": content,
        **(style_vars or {}),
    }
