"""
Security-focused template filters for HTML sanitization
"""

from django import template
from django.utils.safestring import mark_safe
import bleach

register = template.Library()


# Allowed HTML tags for sanitized content
ALLOWED_TAGS = [
    "a",
    "abbr",
    "article",
    "aside",
    "b",
    "blockquote",
    "br",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "section",
    "span",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul",
    "figure",
    "figcaption",
    "caption",
    "dl",
    "dt",
    "dd",
    "sub",
    "sup",
    "small",
    "mark",
    "del",
    "ins",
    "cite",
    "q",
    "kbd",
    "samp",
    "var",
    "time",
    "address",
]

# Allowed HTML attributes
ALLOWED_ATTRIBUTES = {
    "*": ["class", "id", "title", "data-*"],
    "a": ["href", "title", "rel", "target"],
    "img": ["src", "alt", "title", "width", "height", "loading"],
    "table": ["border", "cellpadding", "cellspacing"],
    "td": ["colspan", "rowspan", "align", "valign"],
    "th": ["colspan", "rowspan", "align", "valign", "scope"],
    "ol": ["start", "type"],
    "ul": ["type"],
    "li": ["value"],
    "blockquote": ["cite"],
    "q": ["cite"],
    "time": ["datetime"],
}

# Allowed protocols for URLs
ALLOWED_PROTOCOLS = ["http", "https", "mailto", "tel"]


@register.filter(name="sanitize_html")
def sanitize_html(value, allow_scripts=False):
    """
    Sanitize HTML content to prevent XSS attacks.

    Args:
        value: HTML string to sanitize
        allow_scripts: If True or 'True', skip sanitization (for trusted content only)

    Returns:
        Sanitized HTML string (marked safe)

    Usage in templates:
        {{ content_html|sanitize_html }}
        {{ content_html|sanitize_html:config.allow_scripts }}
    """
    if not value:
        return ""

    # Convert allow_scripts to boolean if it's a string
    if isinstance(allow_scripts, str):
        allow_scripts = allow_scripts.lower() in ("true", "1", "yes")

    # If allow_scripts is True, return the content without sanitization
    # This should only be used for trusted admin content
    if allow_scripts:
        return mark_safe(value)

    # Sanitize the HTML using bleach
    cleaned = bleach.clean(
        value,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,  # Strip disallowed tags instead of escaping them
    )

    # Additional security: ensure no javascript: URLs slipped through
    # (defense in depth)
    if "javascript:" in cleaned.lower():
        cleaned = cleaned.replace("javascript:", "")
        cleaned = cleaned.replace("JavaScript:", "")
        cleaned = cleaned.replace("JAVASCRIPT:", "")

    return mark_safe(cleaned)


@register.filter(name="strip_scripts")
def strip_scripts(value):
    """
    Legacy filter that strips all script tags and dangerous content.
    This is an alias for sanitize_html with allow_scripts=False.

    Usage in templates:
        {{ content_html|strip_scripts }}
    """
    return sanitize_html(value, allow_scripts=False)
