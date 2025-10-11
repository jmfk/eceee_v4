"""
Common Path Patterns

This module defines a set of commonly-used path patterns for dynamic object publishing.
These patterns can be used by pages to capture URL variables for use in widgets.
"""

from ..path_pattern_registry import BasePathPattern, register_path_pattern


@register_path_pattern
class NewsSlugPattern(BasePathPattern):
    """Pattern for capturing a news article slug"""

    key = "news_slug"
    name = "News Article Slug"
    description = (
        "Captures a single news article slug from the URL. "
        "Use this for news detail pages that display a specific article."
    )
    regex_pattern = r"^(?P<slug>[\w-]+)/$"
    example_url = "my-article/"
    extracted_variables = [
        {
            "name": "slug",
            "type": "string",
            "description": "The URL-friendly slug of the news article",
            "example": "my-article",
        }
    ]


@register_path_pattern
class EventSlugPattern(BasePathPattern):
    """Pattern for capturing an event slug"""

    key = "event_slug"
    name = "Event Slug"
    description = (
        "Captures a single event slug from the URL. "
        "Use this for event detail pages that display a specific event."
    )
    regex_pattern = r"^(?P<slug>[\w-]+)/$"
    example_url = "summer-conference-2025/"
    extracted_variables = [
        {
            "name": "slug",
            "type": "string",
            "description": "The URL-friendly slug of the event",
            "example": "summer-conference-2025",
        }
    ]


@register_path_pattern
class LibraryItemSlugPattern(BasePathPattern):
    """Pattern for capturing a library item slug"""

    key = "library_slug"
    name = "Library Item Slug"
    description = (
        "Captures a single library item slug from the URL. "
        "Use this for library detail pages that display a specific publication or resource."
    )
    regex_pattern = r"^(?P<slug>[\w-]+)/$"
    example_url = "energy-efficiency-report-2025/"
    extracted_variables = [
        {
            "name": "slug",
            "type": "string",
            "description": "The URL-friendly slug of the library item",
            "example": "energy-efficiency-report-2025",
        }
    ]


@register_path_pattern
class MemberSlugPattern(BasePathPattern):
    """Pattern for capturing a member slug"""

    key = "member_slug"
    name = "Member Profile Slug"
    description = (
        "Captures a single member slug from the URL. "
        "Use this for member profile pages that display a specific member's information."
    )
    regex_pattern = r"^(?P<slug>[\w-]+)/$"
    example_url = "john-doe/"
    extracted_variables = [
        {
            "name": "slug",
            "type": "string",
            "description": "The URL-friendly slug of the member",
            "example": "john-doe",
        }
    ]


@register_path_pattern
class DateSlugPattern(BasePathPattern):
    """Pattern for capturing date-based article URLs"""

    key = "date_slug"
    name = "Date-based Article (YYYY/MM/slug)"
    description = (
        "Captures a date-based URL with year, month, and article slug. "
        "Common for blogs and news archives organized by publication date."
    )
    regex_pattern = r"^(?P<year>\d{4})/(?P<month>\d{2})/(?P<slug>[\w-]+)/$"
    example_url = "2025/10/my-article/"
    extracted_variables = [
        {
            "name": "year",
            "type": "string",
            "description": "Four-digit year",
            "example": "2025",
        },
        {
            "name": "month",
            "type": "string",
            "description": "Two-digit month (01-12)",
            "example": "10",
        },
        {
            "name": "slug",
            "type": "string",
            "description": "The URL-friendly slug of the article",
            "example": "my-article",
        },
    ]


@register_path_pattern
class YearSlugPattern(BasePathPattern):
    """Pattern for capturing year-based article URLs"""

    key = "year_slug"
    name = "Year-based Article (YYYY/slug)"
    description = (
        "Captures a year-based URL with year and article slug. "
        "Useful for annual reports, yearly conferences, etc."
    )
    regex_pattern = r"^(?P<year>\d{4})/(?P<slug>[\w-]+)/$"
    example_url = "2025/annual-report/"
    extracted_variables = [
        {
            "name": "year",
            "type": "string",
            "description": "Four-digit year",
            "example": "2025",
        },
        {
            "name": "slug",
            "type": "string",
            "description": "The URL-friendly slug of the item",
            "example": "annual-report",
        },
    ]


@register_path_pattern
class NumericIdPattern(BasePathPattern):
    """Pattern for capturing numeric IDs"""

    key = "numeric_id"
    name = "Numeric ID"
    description = (
        "Captures a numeric ID from the URL. "
        "Use this when your objects use numeric IDs rather than slugs."
    )
    regex_pattern = r"^(?P<id>\d+)/$"
    example_url = "12345/"
    extracted_variables = [
        {
            "name": "id",
            "type": "integer",
            "description": "The numeric ID of the object",
            "example": "12345",
        }
    ]


@register_path_pattern
class CategorySlugPattern(BasePathPattern):
    """Pattern for capturing category and slug"""

    key = "category_slug"
    name = "Category and Slug"
    description = (
        "Captures a category and item slug from the URL. "
        "Useful for items organized by category (e.g., /technology/my-article/)."
    )
    regex_pattern = r"^(?P<category>[\w-]+)/(?P<slug>[\w-]+)/$"
    example_url = "technology/energy-efficiency/"
    extracted_variables = [
        {
            "name": "category",
            "type": "string",
            "description": "The category slug",
            "example": "technology",
        },
        {
            "name": "slug",
            "type": "string",
            "description": "The item slug within the category",
            "example": "energy-efficiency",
        },
    ]
