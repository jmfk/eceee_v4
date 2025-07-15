"""
Custom template tags and filters for the webpages app
"""

from django import template
import json

register = template.Library()


@register.filter
def lookup(dictionary, key):
    """
    Template filter to look up a key in a dictionary.
    Usage: {{ dict|lookup:key }}
    """
    if isinstance(dictionary, dict):
        return dictionary.get(key, [])
    return []


@register.filter
def pprint(value):
    """
    Pretty print JSON data
    """
    try:
        return json.dumps(value, indent=2)
    except (TypeError, ValueError):
        return str(value)


@register.simple_tag
def get_widget_template(widget_type):
    """
    Get the template name for a widget type
    """
    return widget_type.template_name


@register.inclusion_tag("webpages/widgets/widget_wrapper.html")
def render_widget(widget, config=None, inherited_from=None, is_override=False):
    """
    Render a widget with its wrapper
    """
    return {
        "widget": widget,
        "config": config or widget.configuration,
        "inherited_from": inherited_from,
        "is_override": is_override,
    }


@register.simple_tag
def page_url(page):
    """
    Get the absolute URL for a page
    """
    return page.get_absolute_url() if page else "#"


@register.filter
def widget_config(widget, key):
    """
    Get a configuration value from a widget
    Usage: {{ widget|widget_config:"title" }}
    """
    if hasattr(widget, "configuration") and isinstance(widget.configuration, dict):
        return widget.configuration.get(key, "")
    return ""


@register.simple_tag(takes_context=True)
def page_hierarchy(context, root_only=True):
    """
    Get page hierarchy for navigation
    """
    from ..models import WebPage
    from django.utils import timezone
    from django.db.models import Q

    now = timezone.now()
    queryset = WebPage.objects.filter(
        publication_status="published", effective_date__lte=now
    ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))

    if root_only:
        queryset = queryset.filter(parent__isnull=True)

    return queryset.order_by("sort_order", "title")


@register.inclusion_tag("webpages/includes/breadcrumbs.html", takes_context=True)
def page_breadcrumbs(context, page):
    """
    Render breadcrumbs for a page
    """
    return {
        "breadcrumbs": page.get_breadcrumbs() if page else [],
        "request": context["request"],
    }


@register.inclusion_tag("webpages/includes/child_navigation.html")
def child_pages_nav(page, limit=None):
    """
    Render navigation for child pages
    """
    children = page.children.filter(publication_status="published").order_by(
        "sort_order", "title"
    )

    if limit:
        children = children[:limit]

    return {
        "children": children,
        "parent": page,
    }
