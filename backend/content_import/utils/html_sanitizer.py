"""HTML sanitization utilities for safe content import."""

import re
from bs4 import BeautifulSoup
from typing import List


# Allowed HTML tags for content widgets
ALLOWED_TAGS = {
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'a', 'img',
    'strong', 'em', 'b', 'i', 'u',
    'blockquote', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span',
}

# Allowed HTML attributes
ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height', 'class'],
    'table': ['class', 'border', 'cellspacing', 'cellpadding'],
    'td': ['colspan', 'rowspan', 'class'],
    'th': ['colspan', 'rowspan', 'class', 'scope'],
    'div': ['class'],
    'span': ['class'],
    'p': ['class'],
    'h1': ['class'], 'h2': ['class'], 'h3': ['class'],
    'h4': ['class'], 'h5': ['class'], 'h6': ['class'],
}

# Dangerous event handlers to strip
EVENT_HANDLERS = [
    'onclick', 'ondblclick', 'onmousedown', 'onmousemove', 'onmouseover',
    'onmouseout', 'onmouseup', 'onkeydown', 'onkeypress', 'onkeyup',
    'onblur', 'onchange', 'onfocus', 'onload', 'onunload', 'onerror',
    'onabort', 'onreset', 'onsubmit', 'onscroll', 'onresize',
]


def sanitize_html(html: str, allowed_tags: set = None, allowed_attrs: dict = None) -> str:
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
    soup = BeautifulSoup(html, 'html.parser')
    
    # Remove all script and style tags
    for tag in soup.find_all(['script', 'style', 'iframe', 'object', 'embed']):
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
            elif attr_name in ['href', 'src']:
                if isinstance(tag[attr_name], str) and tag[attr_name].lower().startswith('javascript:'):
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
    soup = BeautifulSoup(html, 'html.parser')
    return soup.get_text(separator=' ', strip=True)


def strip_images(html: str) -> str:
    """
    Remove all img tags from HTML.
    
    Args:
        html: The HTML string
    
    Returns:
        HTML without images
    """
    soup = BeautifulSoup(html, 'html.parser')
    for img in soup.find_all('img'):
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
        text = element.parent.get_text(separator=' ', strip=True)
        if len(text) > max_chars:
            # Truncate from middle
            half = max_chars // 2
            text = f"{text[:half]}...{text[-half:]}"
        return text
    return ""

