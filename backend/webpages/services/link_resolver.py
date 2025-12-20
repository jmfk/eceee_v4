"""
Link Resolver Service

Resolves JSON link objects to URL strings for rendering.
Supports internal pages, external URLs, email, phone, and anchor links.
"""

import json
import logging
import re
from typing import Any, Dict, Optional, Union
from urllib.parse import quote, urlencode

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def is_link_object(value: Any) -> bool:
    """
    Check if a value is a link JSON object.

    Args:
        value: Any value to check

    Returns:
        True if value is a dict with a 'type' field matching known link types
    """
    if not isinstance(value, dict):
        return False

    link_type = value.get("type")
    return link_type in ("internal", "external", "email", "phone", "anchor", "media")


def parse_link_string(value: str) -> Optional[Dict[str, Any]]:
    """
    Try to parse a string as a JSON link object.

    Args:
        value: String that might be JSON

    Returns:
        Parsed dict if valid link object, None otherwise
    """
    if not value or not isinstance(value, str):
        return None

    # Quick check - link objects start with { (possibly URL-encoded)
    value = value.strip()

    # Handle URL-encoded JSON (starts with %7B)
    if value.startswith("%7B"):
        from urllib.parse import unquote

        try:
            decoded = unquote(value)
            parsed = json.loads(decoded)
            if is_link_object(parsed):
                return parsed
        except Exception:
            pass

    if not value.startswith("{"):
        return None

    try:
        parsed = json.loads(value)
        if is_link_object(parsed):
            return parsed
    except (json.JSONDecodeError, TypeError) as e:
        # Check if it might be double-encoded or escaped
        if "&quot;" in value or "&#34;" in value:
            try:
                import html

                unescaped = html.unescape(value)
                parsed = json.loads(unescaped)
                if is_link_object(parsed):
                    return parsed
            except Exception:
                pass
        pass

    return None


def resolve_link(link_value: Union[str, Dict[str, Any]], request=None) -> str:
    """
    Resolve a link value to a URL string.

    Args:
        link_value: Either a JSON link object dict, a JSON string, or a plain URL
        request: Optional Django request for building absolute URLs

    Returns:
        Resolved URL string
    """
    # Handle None or empty
    if not link_value:
        return "#"

    # If it's a string, try to parse as JSON link object
    if isinstance(link_value, str):
        parsed = parse_link_string(link_value)
        if parsed:
            link_value = parsed
        else:
            # It's a plain URL string, return as-is
            return link_value

    # Must be a dict at this point
    if not isinstance(link_value, dict):
        return "#"

    link_type = link_value.get("type")

    if link_type == "internal":
        return _resolve_internal_link(link_value, request)
    elif link_type == "external":
        return _resolve_external_link(link_value)
    elif link_type == "email":
        return _resolve_email_link(link_value)
    elif link_type == "phone":
        return _resolve_phone_link(link_value)
    elif link_type == "anchor":
        return _resolve_anchor_link(link_value)
    elif link_type == "media":
        return _resolve_media_link(link_value, request)
    else:
        logger.warning(f"Unknown link type: {link_type}")
        return "#"


def _resolve_internal_link(link_obj: Dict[str, Any], request=None) -> str:
    """Resolve internal page link to URL."""
    from webpages.models import WebPage

    # Support both camelCase and snake_case
    page_id = link_obj.get("pageId") or link_obj.get("page_id")
    if not page_id:
        logger.warning("Internal link missing pageId")
        return "#"

    try:
        page = WebPage.objects.get(id=page_id, is_deleted=False)
        url = page.get_absolute_url()

        # Add anchor if specified
        anchor = link_obj.get("anchor")
        if anchor:
            url = f"{url}#{anchor}"

        return url
    except WebPage.DoesNotExist:
        logger.warning(f"Internal link references non-existent page: {page_id}")
        return "#"


def _resolve_media_link(link_obj: Dict[str, Any], request=None) -> str:
    """Resolve media file link to URL."""
    from file_manager.models import MediaFile

    # Support both camelCase and snake_case
    media_id = link_obj.get("mediaId") or link_obj.get("media_id")
    if not media_id:
        logger.warning("Media link missing mediaId")
        return link_obj.get("url", "#")

    try:
        media_file = MediaFile.objects.get(id=media_id, is_deleted=False)
        return media_file.get_absolute_url()
    except MediaFile.DoesNotExist:
        logger.warning(f"Media link references non-existent file: {media_id}")
        return link_obj.get("url", "#")


def _resolve_external_link(link_obj: Dict[str, Any]) -> str:
    """Resolve external URL link."""
    url = link_obj.get("url", "")
    if not url:
        return "#"
    return url


def _resolve_email_link(link_obj: Dict[str, Any]) -> str:
    """Resolve email link to mailto: URL."""
    address = link_obj.get("address", "")
    if not address:
        return "#"

    # Build mailto URL with optional parameters
    params = {}
    if link_obj.get("subject"):
        params["subject"] = link_obj["subject"]
    if link_obj.get("body"):
        params["body"] = link_obj["body"]
    if link_obj.get("cc"):
        params["cc"] = link_obj["cc"]
    if link_obj.get("bcc"):
        params["bcc"] = link_obj["bcc"]

    if params:
        return f"mailto:{address}?{urlencode(params)}"
    return f"mailto:{address}"


def _resolve_phone_link(link_obj: Dict[str, Any]) -> str:
    """Resolve phone link to tel: URL."""
    number = link_obj.get("number", "")
    if not number:
        return "#"

    # Clean number for tel: protocol (remove spaces, keep + and digits)
    clean_number = re.sub(r"[^\d+]", "", number)
    return f"tel:{clean_number}"


def _resolve_anchor_link(link_obj: Dict[str, Any]) -> str:
    """Resolve same-page anchor link."""
    anchor = link_obj.get("anchor", "")
    if not anchor:
        return "#"

    # Ensure anchor doesn't start with #
    anchor = anchor.lstrip("#")
    return f"#{anchor}"


def resolve_links_in_html(html_content: str, request=None) -> str:
    """
    Process HTML content and resolve all link objects in href attributes.

    Args:
        html_content: HTML string to process
        request: Optional Django request

    Returns:
        HTML string with resolved links
    """
    if not html_content:
        return html_content

    soup = BeautifulSoup(html_content, "html.parser")
    modified = False

    for a_tag in soup.find_all("a", href=True):
        href = a_tag.get("href", "")

        # Check if href is a JSON link object
        parsed = parse_link_string(href)
        if parsed:
            resolved_url = resolve_link(parsed, request)
            a_tag["href"] = resolved_url

            # Handle targetBlank from link object
            if parsed.get("targetBlank"):
                a_tag["target"] = "_blank"
                a_tag["rel"] = "noopener noreferrer"

            modified = True

    if modified:
        return str(soup)
    return html_content


def resolve_links_in_config(
    config: Dict[str, Any], request=None, url_fields: tuple = ("url", "href", "link")
) -> Dict[str, Any]:
    """
    Process a widget config dict and resolve link objects in URL fields.

    Args:
        config: Widget configuration dictionary
        request: Optional Django request
        url_fields: Tuple of field names that may contain links

    Returns:
        Config dict with resolved links
    """
    if not config or not isinstance(config, dict):
        return config

    # If this dict itself is a link object, we only resolve it if it's NOT a nested call
    # searching for fields. But resolve_links_in_config is usually called on the root config.
    # To be safe, we only resolve the root if it's explicitly a link object.
    # But wait, we want recursion to work for lists of items.

    result = dict(config)

    for key, value in config.items():
        # Check direct URL fields
        if key in url_fields:
            if is_link_object(value) or (
                isinstance(value, str) and parse_link_string(value)
            ):
                result[key] = resolve_link(value, request)

        # Recursively process nested dicts - BUT don't automatically resolve them
        # to strings unless they are in url_fields.
        elif isinstance(value, dict):
            # If the nested dict is a link object but NOT in url_fields,
            # we keep it as a dict but resolve any URL fields WITHIN it (if any).
            # This prevents replacing 'link_data' objects with strings.
            if is_link_object(value):
                # It's a link object in a non-url field.
                # We might want to resolve its internal URL fields if it has any,
                # but standard link objects don't have nested link objects.
                # So we leave it as-is.
                pass
            else:
                result[key] = resolve_links_in_config(value, request, url_fields)

        # Process lists (e.g., menu_items)
        elif isinstance(value, list):
            result[key] = [
                (
                    resolve_links_in_config(item, request, url_fields)
                    if isinstance(item, dict)
                    else item
                )
                for item in value
            ]

    return result


def get_link_display_info(link_value: Union[str, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Get display information for a link (for frontend preview).

    Args:
        link_value: Link object or string

    Returns:
        Dict with display info: type, label, resolved_url, page_title (for internal)
    """
    if not link_value:
        return {"type": "empty", "label": "No link", "resolvedUrl": "#"}

    # Parse string if needed
    if isinstance(link_value, str):
        parsed = parse_link_string(link_value)
        if parsed:
            link_value = parsed
        else:
            # Plain URL
            return {"type": "legacy", "label": link_value, "resolvedUrl": link_value}

    if not isinstance(link_value, dict):
        return {"type": "unknown", "label": str(link_value), "resolvedUrl": "#"}

    link_type = link_value.get("type", "unknown")
    resolved_url = resolve_link(link_value)

    info = {"type": link_type, "resolvedUrl": resolved_url}

    if link_type == "internal":
        from webpages.models import WebPage

        page_id = link_value.get("pageId")
        try:
            page = WebPage.objects.get(id=page_id, is_deleted=False)
            info["label"] = page.title
            info["pageTitle"] = page.title
            info["pagePath"] = page.cached_path or page.get_absolute_url()
            if link_value.get("anchor"):
                info["label"] = f"{page.title} #{link_value['anchor']}"
        except WebPage.DoesNotExist:
            info["label"] = f"[Deleted page: {page_id}]"
            info["error"] = "Page not found"

    elif link_type == "external":
        info["label"] = link_value.get("url", "External link")

    elif link_type == "email":
        info["label"] = link_value.get("address", "Email")

    elif link_type == "phone":
        info["label"] = link_value.get("number", "Phone")

    elif link_type == "anchor":
        info["label"] = f"#{link_value.get('anchor', '')}"

    elif link_type == "media":
        from file_manager.models import MediaFile

        media_id = link_value.get("mediaId")
        try:
            media_file = MediaFile.objects.get(id=media_id, is_deleted=False)
            info["label"] = media_file.title
            info["fileName"] = media_file.original_filename
        except MediaFile.DoesNotExist:
            info["label"] = link_value.get("title", f"[Deleted file: {media_id}]")
            info["error"] = "File not found"

    else:
        info["label"] = "Unknown link"

    return info
