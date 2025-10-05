"""
Django template tags for imgproxy image processing.

Provides flexible template tags for generating imgproxy URLs with support for:
- Image objects from widget config
- Settings dictionaries for config-driven display
- Explicit template parameters
- Automatic URL extraction and metadata handling
"""

from django import template
from file_manager.imgproxy import imgproxy_service
import logging

register = template.Library()
logger = logging.getLogger(__name__)


@register.simple_tag
def imgproxy(
    image_obj,
    settings=None,
    # Common parameters (explicit for clarity and documentation)
    width=None,
    height=None,
    resize_type=None,
    gravity=None,
    quality=None,
    format=None,
    preset=None,
    # Advanced parameters via kwargs (blur, sharpen, brightness, etc.)
    **kwargs,
):
    """
    Generate imgproxy URL from image object with flexible configuration.

    Priority order for parameters:
    1. Explicit template parameters (highest priority)
    2. Settings dict from widget config
    3. System defaults

    Args:
        image_obj: Image object/dict/string from widget config.
                   Can be a dict with 'imgproxy_base_url' or 'file_url',
                   a plain URL string, or a MediaFile model instance.
        settings: Optional dict of imgproxy parameters from widget config.
                  Widget can define any structure (e.g., config.image_display).
        width: Target width in pixels
        height: Target height in pixels
        resize_type: Resize type - 'fit' (default), 'fill', 'crop', 'force'
        gravity: Gravity for cropping - 'sm' (smart), 'face', 'ce', 'no', 'so',
                 'ea', 'we', 'fp:x:y' (focal point)
        quality: JPEG/WebP quality (1-100, default: 85)
        format: Output format - 'jpg', 'png', 'webp', 'avif', 'gif'
        preset: Predefined preset - 'thumbnail', 'small', 'medium', 'large', 'hero', 'avatar'
        **kwargs: Additional imgproxy options (blur, sharpen, brightness, contrast, etc.)

    Returns:
        imgproxy URL string, or original URL if imgproxy fails

    Examples:
        {% imgproxy config.image width=800 height=600 %}
        {% imgproxy config.image settings=config.image_display %}
        {% imgproxy config.image settings=config.display width=1920 %}
        {% imgproxy config.image width=400 height=400 gravity='face' %}
        {% imgproxy config.image preset='hero' %}
        {% imgproxy config.image width=800 blur=5 sharpen=0.3 %}
    """
    try:
        # Extract URL from image object
        source_url = _extract_url_from_image(image_obj)
        if not source_url:
            logger.warning("imgproxy tag: No valid URL found in image object")
            return ""

        # Build params from explicit parameters
        explicit_params = {
            "width": width,
            "height": height,
            "resize_type": resize_type,
            "gravity": gravity,
            "quality": quality,
            "format": format,
            "preset": preset,
        }
        # Remove None values
        explicit_params = {k: v for k, v in explicit_params.items() if v is not None}

        # Merge parameters with priority: settings < explicit_params < kwargs
        params = {}
        if settings and isinstance(settings, dict):
            params.update(settings)
        params.update(explicit_params)
        params.update(kwargs)  # kwargs has highest priority

        # Generate imgproxy URL
        return imgproxy_service.generate_url(source_url=source_url, **params)

    except Exception as e:
        logger.error(f"imgproxy tag error: {e}")
        # Fallback to original URL
        fallback_url = _extract_url_from_image(image_obj)
        return fallback_url or ""


@register.inclusion_tag("imgproxy/img_tag.html")
def imgproxy_img(
    image_obj,
    settings=None,
    alt=None,
    class_name=None,
    lazy=True,
    include_dimensions=True,  # Whether to include width/height HTML attributes
    # Common imgproxy parameters
    width=None,
    height=None,
    resize_type=None,
    gravity=None,
    quality=None,
    format=None,
    preset=None,
    # Advanced parameters
    **kwargs,
):
    """
    Generate complete <img> tag with imgproxy URL.

    Auto-generates alt text from image metadata if not provided.
    Returns a rendered <img> element with all appropriate attributes.

    Args:
        image_obj: Image object from widget config
        settings: Optional dict of imgproxy parameters from widget config
        alt: Alt text (auto-generated from image title/description if not provided)
        class_name: CSS classes for the img tag
        lazy: Enable lazy loading (default: True)
        include_dimensions: Include width/height HTML attributes (default: True).
                          Set to False for object-fit: cover to work properly.
        width, height, resize_type, gravity, quality, format, preset: imgproxy parameters
        **kwargs: Additional imgproxy options

    Returns:
        Context dict for img_tag.html template containing:
        - src: imgproxy URL
        - alt: alt text
        - class: CSS classes
        - width, height: dimensions (None if include_dimensions=False)
        - lazy: lazy loading flag
        - original_width, original_height: original image dimensions

    Examples:
        {% imgproxy_img config.image settings=config.image_display %}
        {% imgproxy_img config.image width=800 height=600 class_name='hero' %}
        {% imgproxy_img config.image width=400 gravity='face' alt='Profile' %}
        {% imgproxy_img config.image preset='hero' class_name='banner-image' %}
        {% imgproxy_img config.image width=1280 height=132 include_dimensions=False %}
    """
    try:
        print("imgproxy_img")
        # Extract URL and metadata
        source_url = _extract_url_from_image(image_obj)
        metadata = _extract_metadata(image_obj)

        if not source_url:
            logger.warning("imgproxy_img tag: No valid URL found in image object")
            return {
                "src": "",
                "alt": alt or "",
                "class": class_name,
                "width": width,
                "height": height,
                "lazy": lazy,
            }

        # Build params from explicit parameters
        explicit_params = {
            "width": width,
            "height": height,
            "resize_type": resize_type,
            "gravity": gravity,
            "quality": quality,
            "format": format,
            "preset": preset,
        }
        # Remove None values
        explicit_params = {k: v for k, v in explicit_params.items() if v is not None}

        # Merge parameters
        params = {}
        if settings and isinstance(settings, dict):
            params.update(settings)
        params.update(explicit_params)
        params.update(kwargs)

        # Generate imgproxy URL
        imgproxy_url = imgproxy_service.generate_url(source_url=source_url, **params)

        # Auto-generate alt text if not provided
        if not alt:
            alt = metadata.get("title") or metadata.get("description") or ""

        return {
            "src": imgproxy_url,
            "alt": alt,
            "class": class_name,
            "width": params.get("width") if include_dimensions else None,
            "height": params.get("height") if include_dimensions else None,
            "lazy": lazy,
            "original_width": metadata.get("width"),
            "original_height": metadata.get("height"),
        }

    except Exception as e:
        logger.error(f"imgproxy_img tag error: {e}")
        return {
            "src": "",
            "alt": alt or "",
            "class": class_name,
            "width": width,
            "height": height,
            "lazy": lazy,
        }


@register.filter
def imgproxy_url(image_obj, size=None):
    """
    Simple filter for quick imgproxy URL generation.

    Args:
        image_obj: Image object or URL string
        size: Optional size string in format "WIDTHxHEIGHT" (e.g., "800x600")

    Returns:
        imgproxy URL string

    Examples:
        {{ config.image|imgproxy_url }}
        {{ config.image|imgproxy_url:"800x600" }}
        {{ config.image|imgproxy_url:"1920x1080" }}
    """
    if not image_obj:
        return ""

    source_url = _extract_url_from_image(image_obj)
    if not source_url:
        return ""

    # Parse size if provided
    width, height = None, None
    if size and isinstance(size, str) and "x" in size:
        try:
            w, h = size.split("x", 1)
            width = int(w.strip())
            height = int(h.strip())
        except (ValueError, AttributeError):
            logger.warning(
                f"imgproxy_url filter: Invalid size format '{size}', expected 'WIDTHxHEIGHT'"
            )

    try:
        return imgproxy_service.generate_url(
            source_url=source_url, width=width, height=height
        )
    except Exception as e:
        logger.error(f"imgproxy_url filter error: {e}")
        return source_url


@register.filter
def has_image(image_obj):
    """
    Check if image object has a valid URL.

    Useful for conditional rendering in templates.

    Args:
        image_obj: Image object or URL string

    Returns:
        Boolean indicating if image has valid URL

    Example:
        {% if config.image|has_image %}
            <img src="{% imgproxy config.image width=800 %}">
        {% endif %}
    """
    return bool(_extract_url_from_image(image_obj))


# Helper functions


def _extract_url_from_image(image_obj):
    """
    Extract URL from image object (dict, string, or model instance).

    Priority order:
    1. imgproxy_base_url (direct S3/MinIO URL - best for imgproxy)
    2. file_url (Django API endpoint - fallback)
    3. Plain string (use as-is)
    4. Model instance attributes

    Args:
        image_obj: Image object in various formats

    Returns:
        URL string or empty string if not found
    """
    if not image_obj:
        return ""

    # Case 1: Dictionary (from serializer in widget config)
    if isinstance(image_obj, dict):
        # Priority: imgproxy_base_url > file_url
        return image_obj.get("imgproxy_base_url") or image_obj.get("file_url") or ""

    # Case 2: Plain string URL
    if isinstance(image_obj, str):
        return image_obj

    # Case 3: Model instance (MediaFile)
    if hasattr(image_obj, "imgproxy_base_url"):
        url = getattr(image_obj, "imgproxy_base_url", "")
        if url:
            return url

    if hasattr(image_obj, "file_url"):
        url = getattr(image_obj, "file_url", "")
        if url:
            return url

    # Fallback: try to convert to string
    try:
        url_str = str(image_obj) if image_obj else ""
        # Basic validation - should look like a URL
        if url_str and ("http" in url_str or "/" in url_str):
            return url_str
    except Exception:
        pass

    return ""


def _extract_metadata(image_obj):
    """
    Extract metadata from image object for auto-generating attributes.

    Extracts useful information like dimensions, title, and description
    that can be used for alt text and other attributes.

    Args:
        image_obj: Image object (dict or model instance)

    Returns:
        Dictionary with metadata fields (width, height, title, description, etc.)
    """
    if isinstance(image_obj, dict):
        return {
            "width": image_obj.get("width"),
            "height": image_obj.get("height"),
            "title": image_obj.get("title"),
            "description": image_obj.get("description"),
            "alt_text": image_obj.get("alt_text"),
        }

    # Model instance
    if hasattr(image_obj, "__dict__"):
        return {
            "width": getattr(image_obj, "width", None),
            "height": getattr(image_obj, "height", None),
            "title": getattr(image_obj, "title", None),
            "description": getattr(image_obj, "description", None),
            "alt_text": getattr(image_obj, "alt_text", None),
        }

    return {}
