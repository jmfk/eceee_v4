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


def prepare_gallery_context(images, config, style_vars=None, imgproxy_config=None):
    """
    Prepare context for gallery template rendering.

    Args:
        images: List of image dicts (url, width, height, alt, caption, etc.)
        config: Widget configuration
        style_vars: Style-specific variables
        imgproxy_config: Imgproxy configuration from style (can be overridden by widget config)

    Returns:
        Dictionary ready for Mustache rendering
    """
    from file_manager.imgproxy import imgproxy_service

    # Merge style imgproxy config with widget overrides
    final_imgproxy_config = {**(imgproxy_config or {})}
    if config.get("imgproxy_override"):
        final_imgproxy_config.update(config["imgproxy_override"])

    # Add index to each image and process with imgproxy (make a copy to avoid mutating input)
    indexed_images = []
    for i, img in enumerate(images):
        img_copy = img.copy() if isinstance(img, dict) else {}
        img_copy["index"] = i

        # Generate imgproxy URL if config provided and image has URL
        if final_imgproxy_config and img_copy.get("url"):
            try:
                imgproxy_url = imgproxy_service.generate_url(
                    source_url=img_copy["url"], **final_imgproxy_config
                )
                # Replace the original URL with the imgproxy URL
                img_copy["url"] = imgproxy_url
            except Exception as e:
                # Log error but continue with original URL
                import logging

                logger = logging.getLogger(__name__)
                logger.warning(
                    f"Failed to generate imgproxy URL for gallery image: {e}"
                )

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


def prepare_carousel_context(images, config, style_vars=None, imgproxy_config=None):
    """
    Prepare context for carousel template rendering.

    Args:
        images: List of image dicts (url, width, height, alt, caption, etc.)
        config: Widget configuration
        style_vars: Style-specific variables
        imgproxy_config: Imgproxy configuration from style (can be overridden by widget config)

    Returns:
        Dictionary ready for Mustache rendering
    """
    from file_manager.imgproxy import imgproxy_service

    # Merge style imgproxy config with widget overrides
    final_imgproxy_config = {**(imgproxy_config or {})}
    if config.get("imgproxy_override"):
        final_imgproxy_config.update(config["imgproxy_override"])

    # Add index to each image and process with imgproxy (make a copy to avoid mutating input)
    indexed_images = []
    for i, img in enumerate(images):
        img_copy = img.copy() if isinstance(img, dict) else {}
        img_copy["index"] = i

        # Generate imgproxy URL if config provided and image has URL
        if final_imgproxy_config and img_copy.get("url"):
            try:
                imgproxy_url = imgproxy_service.generate_url(
                    source_url=img_copy["url"], **final_imgproxy_config
                )
                # Replace the original URL with the imgproxy URL
                img_copy["url"] = imgproxy_url
            except Exception as e:
                # Log error but continue with original URL
                import logging

                logger = logging.getLogger(__name__)
                logger.warning(
                    f"Failed to generate imgproxy URL for carousel image: {e}"
                )

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


def prepare_component_context(content, anchor="", style_vars=None):
    """
    Prepare context for component style template rendering.

    Args:
        content: The content to render (HTML string or dict)
        anchor: Optional anchor/heading text
        style_vars: Style-specific variables

    Returns:
        Dictionary ready for Mustache rendering
    """
    return {
        "content": content,
        "anchor": anchor,
        **(style_vars or {}),
    }
