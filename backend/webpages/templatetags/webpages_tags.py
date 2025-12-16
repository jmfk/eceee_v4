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
    Get page hierarchy for navigation using date-based publishing via PageVersion.
    """
    from ..models import WebPage, PageVersion
    from django.db import models
    from django.utils import timezone
    from django.core.cache import cache

    now = timezone.now()

    # Cache key for published page IDs (cache for 5 minutes)
    cache_key = f"published_page_ids_{now.strftime('%Y%m%d_%H%M')}"
    published_page_ids = cache.get(cache_key)

    if published_page_ids is None:
        published_page_ids = list(
            PageVersion.objects.filter(effective_date__lte=now)
            .filter(models.Q(expiry_date__isnull=True) | models.Q(expiry_date__gt=now))
            .values_list("page_id", flat=True)
            .distinct()
        )
        cache.set(cache_key, published_page_ids, 300)  # 5 minutes

    queryset = WebPage.objects.filter(id__in=published_page_ids).select_related(
        "parent"
    )
    if root_only:
        queryset = queryset.filter(parent__isnull=True)

    return queryset.order_by("sort_order", "id")


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
    Render navigation for child pages using date-based publishing via PageVersion.
    """
    from ..models import PageVersion
    from django.db import models
    from django.utils import timezone
    from django.db import models

    now = timezone.now()
    published_page_ids = (
        PageVersion.objects.filter(effective_date__lte=now)
        .filter(models.Q(expiry_date__isnull=True) | models.Q(expiry_date__gt=now))
        .values_list("page_id", flat=True)
        .distinct()
    )

    children = page.children.filter(id__in=published_page_ids).order_by(
        "sort_order", "id"
    )

    if limit:
        children = children[:limit]

    return {
        "children": children,
        "parent": page,
    }


@register.simple_tag(takes_context=True)
def render_slot(context, slot_name):
    """
    Render widgets for the specified slot wrapped in a slot container
    Usage: {% render_slot "slot_name" %}
    """
    from django.utils.safestring import mark_safe
    from django.template.loader import render_to_string

    # Get widgets_by_slot from context - this is how page_detail.html provides widget data
    widgets_by_slot = context.get("widgets_by_slot", {})

    # Get widgets for this specific slot
    slot_widgets = widgets_by_slot.get(slot_name, [])
    if not slot_widgets:
        # No widgets for this slot - return empty slot container
        return mark_safe(
            f'<div class="layout-slot slot-{slot_name.lower()}" data-slot-name="{slot_name}"></div>'
        )

    # Check if we have new-style rendered widgets (from WebPageRenderer)
    if slot_widgets and isinstance(slot_widgets[0], dict) and "html" in slot_widgets[0]:
        # New format from WebPageRenderer
        rendered_widgets = [widget_info["html"] for widget_info in slot_widgets]
        widgets_html = "".join(rendered_widgets)
    else:
        # Legacy format - render widgets manually
        rendered_widgets = []
        for widget_data in slot_widgets:
            try:
                widget_html = render_to_string(
                    "webpages/widgets/widget_wrapper.html",
                    {
                        "widget": widget_data.widget,
                        "config": widget_data.widget.configuration,
                        "inherited_from": widget_data.inherited_from,
                        "is_override": widget_data.is_override,
                        "slot_name": slot_name,
                    },
                    request=context.get("request"),
                )
                rendered_widgets.append(widget_html)
            except Exception as e:
                # Log error and continue with other widgets
                continue
        widgets_html = "".join(rendered_widgets)

    # Wrap in slot container with slot class
    return mark_safe(
        f'<div class="layout-slot slot-{slot_name.lower()}" data-slot-name="{slot_name}">'
        f'{widgets_html}'
        f'</div>'
    )


@register.simple_tag(takes_context=True)
def render_page_backend(context, page, version=None):
    """
    Render a complete WebPage using the backend renderer.
    Usage: {% render_page_backend page %}
    """
    from django.utils.safestring import mark_safe
    from ..renderers import WebPageRenderer

    try:
        renderer = WebPageRenderer(request=context.get("request"))
        result = renderer.render(page, version=version, context=context)
        return mark_safe(result["html"])
    except Exception as e:
        # Return error message in development, empty in production
        from django.conf import settings

        if settings.DEBUG:
            return mark_safe(f"<!-- Error rendering page: {e} -->")
        return mark_safe("")


@register.filter
def mul(value, arg):
    """
    Multiply a number by another number.
    Usage: {{ value|mul:arg }}
    """
    try:
        return int(value) * int(arg)
    except (ValueError, TypeError):
        return 0


@register.filter
def sub(value, arg):
    """
    Subtract a number from another number.
    Usage: {{ value|sub:arg }}
    """
    try:
        return int(value) - int(arg)
    except (ValueError, TypeError):
        return 0


@register.simple_tag(takes_context=True)
def render_page_with_css(context, page, version=None):
    """
    Render a complete WebPage with CSS using the backend renderer.
    Returns a dict with 'html' and 'css' keys.
    Usage: {% render_page_with_css page as page_data %}{{ page_data.html }}
    """
    from ..renderers import WebPageRenderer

    try:
        renderer = WebPageRenderer(request=context.get("request"))
        return renderer.render(page, version=version, context=context)
    except Exception as e:
        # Return error message in development, empty in production
        from django.conf import settings

        if settings.DEBUG:
            return {
                "html": f"<!-- Error rendering page: {e} -->",
                "css": "",
                "meta": "",
                "debug_info": {"error": str(e)},
            }
        return {"html": "", "css": "", "meta": "", "debug_info": {}}


@register.simple_tag(takes_context=True)
def render_page_seo(context, page=None, version=None, page_data=None):
    """
    Generate SEO meta tags (title, description, OG tags, Twitter cards) from page/version data.
    Usage: {% render_page_seo page=current_page version=content page_data=page_data %}
    """
    from django.utils.safestring import mark_safe
    from django.utils.html import escape

    meta_tags = []

    # Get page from context if not provided
    if page is None:
        page = context.get("current_page") or context.get("page")

    # Get page_data from context if not provided
    if page_data is None:
        page_data = context.get("page_data", {})

    if not page:
        return mark_safe("")

    # Get meta title and description
    meta_title = None
    meta_description = None

    # Priority: page_data > version > page
    if page_data:
        meta_title = page_data.get("meta_title") or page_data.get("metaTitle")
        meta_description = page_data.get("meta_description") or page_data.get(
            "metaDescription"
        )

    if not meta_title and version and hasattr(version, "meta_title"):
        meta_title = version.meta_title

    if not meta_description and version and hasattr(version, "meta_description"):
        meta_description = version.meta_description

    # Fallback to page title
    if not meta_title:
        meta_title = page.title

    if not meta_description and hasattr(page, "description"):
        meta_description = page.description

    # Escape for HTML safety
    meta_title = escape(meta_title) if meta_title else ""
    meta_description = escape(meta_description) if meta_description else ""

    # Meta description
    if meta_description:
        meta_tags.append(f'<meta name="description" content="{meta_description}">')

    # Open Graph tags
    if meta_title:
        meta_tags.append(f'<meta property="og:title" content="{meta_title}">')

    if meta_description:
        meta_tags.append(
            f'<meta property="og:description" content="{meta_description}">'
        )

    meta_tags.append('<meta property="og:type" content="website">')

    # Get full URL for og:url
    request = context.get("request")
    if request:
        full_url = request.build_absolute_uri()
        meta_tags.append(f'<meta property="og:url" content="{escape(full_url)}">')

    # Twitter Card tags
    meta_tags.append('<meta name="twitter:card" content="summary">')
    if meta_title:
        meta_tags.append(f'<meta name="twitter:title" content="{meta_title}">')
    if meta_description:
        meta_tags.append(
            f'<meta name="twitter:description" content="{meta_description}">'
        )

    return mark_safe("\n    ".join(meta_tags))


@register.simple_tag(takes_context=True)
def render_mustache(context, template_name, config):
    """
    Render a Mustache template with config data.
    Usage: {% render_mustache widget_type.mustache_template_name config %}
    """
    from django.utils.safestring import mark_safe
    from webpages.utils.mustache_renderer import load_mustache_template, render_mustache as render_mustache_util

    try:
        # Load the Mustache template
        template_str = load_mustache_template(template_name)
        
        # Render the template with config as context
        rendered = render_mustache_util(template_str, config)
        return mark_safe(rendered)
    except Exception as e:
        # Return error message in development, empty in production
        from django.conf import settings

        if settings.DEBUG:
            return mark_safe(f"<!-- Error rendering Mustache template {template_name}: {e} -->")
        return mark_safe("")


@register.simple_tag
def render_site_icons(root_page=None):
    """
    Generate favicon and app icon tags using imgproxy to resize site_icon.
    Usage: {% render_site_icons root_page=root_page %}
    """
    from django.utils.safestring import mark_safe
    from file_manager.imgproxy import imgproxy_service

    if not root_page or not root_page.site_icon:
        return mark_safe("")

    icon_tags = []

    try:
        # Get the source URL
        source_url = root_page.site_icon.url

        # Generate multiple icon sizes
        icon_sizes = [
            # Standard favicons
            {"size": 16, "format": "png", "rel": "icon", "type": "image/png"},
            {"size": 32, "format": "png", "rel": "icon", "type": "image/png"},
            {"size": 48, "format": "png", "rel": "icon", "type": "image/png"},
            # Apple touch icons
            {"size": 180, "format": "png", "rel": "apple-touch-icon"},
            {"size": 152, "format": "png", "rel": "apple-touch-icon"},
            {"size": 120, "format": "png", "rel": "apple-touch-icon"},
            # Android/Chrome
            {"size": 192, "format": "png", "rel": "icon", "type": "image/png"},
            {"size": 512, "format": "png", "rel": "icon", "type": "image/png"},
        ]

        for icon_spec in icon_sizes:
            size = icon_spec["size"]
            icon_url = imgproxy_service.generate_url(
                source_url=source_url,
                width=size,
                height=size,
                resize_type="fill",
                gravity="sm",
                format=icon_spec["format"],
            )

            if icon_spec["rel"] == "apple-touch-icon":
                icon_tags.append(
                    f'<link rel="apple-touch-icon" sizes="{size}x{size}" href="{icon_url}">'
                )
            else:
                type_attr = (
                    f' type="{icon_spec["type"]}"' if "type" in icon_spec else ""
                )
                icon_tags.append(
                    f'<link rel="icon"{type_attr} sizes="{size}x{size}" href="{icon_url}">'
                )

        # Add favicon.ico (32x32)
        favicon_url = imgproxy_service.generate_url(
            source_url=source_url,
            width=32,
            height=32,
            resize_type="fill",
            gravity="sm",
            format="ico",
        )
        icon_tags.append(f'<link rel="shortcut icon" href="{favicon_url}">')

    except Exception as e:
        # Silently fail in production
        from django.conf import settings

        if settings.DEBUG:
            return mark_safe(f"<!-- Error generating icon tags: {e} -->")

    return mark_safe("\n    ".join(icon_tags))
