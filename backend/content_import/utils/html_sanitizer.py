"""HTML sanitization utilities for safe content import."""

import re
from bs4 import BeautifulSoup
from typing import List


# Allowed HTML tags for content widgets
ALLOWED_TAGS = {
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "br",
    "hr",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "blockquote",
    "code",
    "pre",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "div",
    "span",
}

# Allowed HTML attributes
ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title", "width", "height", "class"],
    "table": ["class", "border", "cellspacing", "cellpadding"],
    "td": ["colspan", "rowspan", "class"],
    "th": ["colspan", "rowspan", "class", "scope"],
    "div": ["class"],
    "span": ["class"],
    "p": ["class"],
    "h1": ["class"],
    "h2": ["class"],
    "h3": ["class"],
    "h4": ["class"],
    "h5": ["class"],
    "h6": ["class"],
}

# Dangerous event handlers to strip
EVENT_HANDLERS = [
    "onclick",
    "ondblclick",
    "onmousedown",
    "onmousemove",
    "onmouseover",
    "onmouseout",
    "onmouseup",
    "onkeydown",
    "onkeypress",
    "onkeyup",
    "onblur",
    "onchange",
    "onfocus",
    "onload",
    "onunload",
    "onerror",
    "onabort",
    "onreset",
    "onsubmit",
    "onscroll",
    "onresize",
]

# Protected div classes that should never be unwrapped
# These divs will be moved outside invalid parents instead
PROTECTED_DIV_CLASSES = {
    "media-insert",
}


def sanitize_html(
    html: str, allowed_tags: set = None, allowed_attrs: dict = None
) -> str:
    """
    Sanitize HTML by removing dangerous tags, attributes, and scripts.

    Args:
        html: The HTML string to sanitize
        allowed_tags: Set of allowed tag names (defaults to ALLOWED_TAGS)
        allowed_attrs: Dict of allowed attributes per tag (defaults to ALLOWED_ATTRIBUTES)

    Returns:
        Sanitized HTML string
    """
    if not html:
        return ""

    if allowed_tags is None:
        allowed_tags = ALLOWED_TAGS
    if allowed_attrs is None:
        allowed_attrs = ALLOWED_ATTRIBUTES

    # Parse HTML
    soup = BeautifulSoup(html, "html.parser")

    # Remove all script and style tags
    for tag in soup.find_all(["script", "style", "iframe", "object", "embed"]):
        tag.decompose()

    # Process all tags
    for tag in soup.find_all(True):
        # Remove tags not in allowed list
        if tag.name not in allowed_tags:
            tag.unwrap()  # Keep content but remove tag
            continue

        # Get allowed attributes for this tag
        tag_allowed_attrs = allowed_attrs.get(tag.name, [])

        # Remove disallowed attributes
        attrs_to_remove = []
        for attr_name in tag.attrs:
            # Remove event handlers
            if attr_name.lower() in EVENT_HANDLERS:
                attrs_to_remove.append(attr_name)
            # Remove disallowed attributes
            elif attr_name not in tag_allowed_attrs:
                attrs_to_remove.append(attr_name)
            # Check for javascript: in URLs
            elif attr_name in ["href", "src"]:
                if isinstance(tag[attr_name], str) and tag[
                    attr_name
                ].lower().startswith("javascript:"):
                    attrs_to_remove.append(attr_name)

        for attr in attrs_to_remove:
            del tag[attr]

    # Return cleaned HTML
    return str(soup)


def extract_text_content(html: str) -> str:
    """
    Extract plain text content from HTML.

    Args:
        html: The HTML string

    Returns:
        Plain text content
    """
    soup = BeautifulSoup(html, "html.parser")
    return soup.get_text(separator=" ", strip=True)


def strip_images(html: str) -> str:
    """
    Remove all img tags from HTML.

    Args:
        html: The HTML string

    Returns:
        HTML without images
    """
    soup = BeautifulSoup(html, "html.parser")
    for img in soup.find_all("img"):
        img.decompose()
    return str(soup)


def get_surrounding_text(element, max_chars: int = 200) -> str:
    """
    Get text surrounding an element for context.

    Args:
        element: BeautifulSoup element
        max_chars: Maximum characters to extract

    Returns:
        Surrounding text context
    """
    # Try to get parent text
    if element.parent:
        text = element.parent.get_text(separator=" ", strip=True)
        if len(text) > max_chars:
            # Truncate from middle
            half = max_chars // 2
            text = f"{text[:half]}...{text[-half:]}"
        return text
    return ""


def _is_protected_div(tag) -> bool:
    """
    Check if a tag is a protected div that should not be unwrapped.

    Checks for:
    - Divs with classes in PROTECTED_DIV_CLASSES
    - Divs with data-{classname}="true" attributes

    Args:
        tag: BeautifulSoup tag element

    Returns:
        True if the div should be protected, False otherwise
    """
    if tag.name != "div":
        return False

    # Check for class attribute
    tag_classes = tag.get("class", [])
    if isinstance(tag_classes, str):
        tag_classes = [tag_classes]

    for protected_class in PROTECTED_DIV_CLASSES:
        # Check if class is in the tag's classes
        if protected_class in tag_classes:
            return True
        # Check for data-{classname}="true" attribute
        data_attr = f"data-{protected_class}"
        if tag.get(data_attr) == "true":
            return True

    return False


def deep_clean_html(html: str, url_mapping: dict = None) -> str:
    """
    Deep clean imported HTML content:
    - Remove nested block tags (p in p, h1 in p, etc)
    - Remove span and font tags (keep content)
    - Strip ALL attributes except essential ones (href, src, alt)
    - Replace file link hrefs with uploaded file URLs
    - Move protected divs outside invalid parent tags

    Args:
        html: The HTML string to clean
        url_mapping: Dict mapping original file URLs to uploaded URLs

    Returns:
        Deeply cleaned HTML string
    """
    import logging

    logger = logging.getLogger(__name__)

    if not html:
        return ""

    url_mapping = url_mapping or {}

    soup = BeautifulSoup(html, "html.parser")

    # Show first 10 block elements
    block_tags = soup.find_all(
        [
            "p",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "div",
            "blockquote",
            "ul",
            "ol",
            "table",
        ]
    )[:10]
    for i, tag in enumerate(block_tags, 1):
        tag_str = str(tag)[:150].replace("\n", " ")

    # STEP 1: Remove span and font tags (unwrap - keep content)
    for tag in soup.find_all(["span", "font"]):
        tag.unwrap()

    # STEP 2: Fix nested block tags
    # Only fix INVALID nesting (e.g., p inside p, h1 inside p)
    # Valid nesting like div>p, div>h1, blockquote>p is OK

    # Tags that should NOT contain other block elements
    invalid_parent_tags = {"p", "h1", "h2", "h3", "h4", "h5", "h6"}

    # Any block tag found inside these should be unwrapped or moved
    block_tags = {
        "p",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "div",
        "blockquote",
        "ul",
        "ol",
    }

    for parent_tag in soup.find_all(invalid_parent_tags):
        # Collect children to process (to avoid modifying during iteration)
        children_to_process = list(parent_tag.find_all(block_tags))

        for child_tag in children_to_process:
            # Check if this is a protected div
            if _is_protected_div(child_tag):
                # Move protected div outside its invalid parent
                # Extract the child and insert it after the parent
                extracted = child_tag.extract()
                parent_tag.insert_after(extracted)
            else:
                # Unwrap the invalid nested block tag
                child_tag.unwrap()

    # STEP 3: Strip ALL attributes except essential ones
    for tag in soup.find_all(True):
        # Define what attributes to keep per tag
        attrs_to_keep = []

        if tag.name == "a":
            attrs_to_keep = ["href", "target", "name"]
        elif tag.name == "img":
            attrs_to_keep = ["src", "alt"]
        elif tag.name == "div":
            # Preserve ALL attributes for protected divs (e.g., media-insert containers)
            if _is_protected_div(tag):
                attrs_to_keep = list(tag.attrs.keys())
            # Otherwise remove all div attributes
        elif tag.name in ["ul", "ol"]:
            # Keep nothing, but preserve the tag
            pass
        elif tag.name in ["th", "td"]:
            # Keep colspan/rowspan for table structure
            attrs_to_keep = ["colspan", "rowspan"]

        # Remove all attributes not in keep list
        attrs_to_remove = [attr for attr in tag.attrs if attr not in attrs_to_keep]
        for attr in attrs_to_remove:
            del tag[attr]

    # STEP 4: Replace file link hrefs with uploaded URLs
    if url_mapping:
        for link in soup.find_all("a", href=True):
            original_href = link["href"]
            if original_href in url_mapping:
                link["href"] = url_mapping[original_href]

    # STEP 5: Remove empty elements
    # Keep trying until no more empty elements are found (some become empty after others are removed)
    self_closing = {"br", "hr", "img"}
    total_removed = 0
    iterations = 0
    max_iterations = 5

    while iterations < max_iterations:
        removed_count = 0
        # Find all tags (from bottom up to handle nested empty tags)
        all_tags = list(soup.find_all(True))
        all_tags.reverse()  # Process from innermost to outermost

        for tag in all_tags:
            # Never remove self-closing tags or protected divs
            if tag.name in self_closing:
                continue
            if _is_protected_div(tag):
                continue

            # Check if tag is empty
            text_content = tag.get_text(strip=True)
            has_images = bool(tag.find_all(self_closing))
            has_protected_divs = bool(tag.find_all(_is_protected_div))

            if not text_content and not has_images and not has_protected_divs:
                tag.decompose()
                removed_count += 1

        total_removed += removed_count
        iterations += 1

        if removed_count == 0:
            break  # No more empty tags found

    # Show first 10 block elements after cleaning
    block_tags_after = soup.find_all(
        [
            "p",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "div",
            "blockquote",
            "ul",
            "ol",
            "table",
        ]
    )[:10]
    for i, tag in enumerate(block_tags_after, 1):
        tag_str = str(tag)[:150].replace("\n", " ")

    result = str(soup)

    return result
