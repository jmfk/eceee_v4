"""
Sidebar Top News Widget - Compact vertical list for sidebar placement
"""

from typing import Type, List
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from django.db.models import Case, When, Value, BooleanField, Q

from webpages.widget_registry import BaseWidget, register_widget_type


class SidebarTopNewsConfig(BaseModel):
    """Configuration for Sidebar Top News widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    object_types: List[str] = Field(
        default=["news"],
        description="Select ObjectType(s) to display",
        json_schema_extra={
            "component": "MultiSelectInput",
            "placeholder": "Select object types...",
        },
    )

    limit: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Maximum number of items to display",
        json_schema_extra={
            "component": "NumberInput",
        },
    )

    show_thumbnails: bool = Field(
        default=True,
        description="Show thumbnail images",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )

    show_dates: bool = Field(
        default=True,
        description="Show publish dates",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )

    show_object_type: bool = Field(
        default=False,
        description="Show object type badge",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )

    widget_title: str = Field(
        default="Top News",
        description="Title for the widget section",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "e.g., Top News, Latest Updates",
        },
    )
    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
        },
    )


@register_widget_type
class SidebarTopNewsWidget(BaseWidget):
    """Compact vertical list of top news for sidebar placement"""

    name = "Sidebar Top News"
    description = "Compact list of top/featured news for sidebars"
    template_name = "easy_widgets/widgets/sidebar_top_news.html"

    layout_parts = {
        "sidebar-top-news-widget": {
            "label": "Sidebar Top News widget container",
            "selector": ".sidebar-top-news-widget",
            "properties": [
                "width",
                "height",
                "padding",
                "margin",
                "backgroundColor",
                "color",
            ],
        },
    }

    widget_css = """
    .sidebar-top-news-widget {
        font-family: var(--body-font, inherit);
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        padding: 1.5rem;
    }
    
    .sidebar-top-news-widget .widget-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: #1f2937;
        margin: 0 0 1.25rem 0;
        padding-bottom: 0.75rem;
        border-bottom: 2px solid #3b82f6;
    }
    
    .sidebar-top-news-widget .news-list {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    
    .sidebar-top-news-widget .news-item {
        display: flex;
        gap: 1rem;
        padding: 1rem 0;
        border-bottom: 1px solid #e5e7eb;
        transition: background-color 0.2s ease;
    }
    
    .sidebar-top-news-widget .news-item:last-child {
        border-bottom: none;
        padding-bottom: 0;
    }
    
    .sidebar-top-news-widget .news-item:first-child {
        padding-top: 0;
    }
    
    .sidebar-top-news-widget .news-item:hover {
        background-color: #f9fafb;
        margin: 0 -0.5rem;
        padding-left: 0.5rem;
        padding-right: 0.5rem;
        border-radius: 0.375rem;
    }
    
    .sidebar-top-news-widget .news-item.pinned .news-title::before {
        content: "📌 ";
        font-size: 0.75rem;
    }
    
    .sidebar-top-news-widget .news-thumbnail {
        flex-shrink: 0;
        width: 80px;
        height: 80px;
        overflow: hidden;
        border-radius: 0.375rem;
        background: #f3f4f6;
    }
    
    .sidebar-top-news-widget .news-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .sidebar-top-news-widget .news-content {
        flex: 1;
        min-width: 0;
    }
    
    .sidebar-top-news-widget .news-meta {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.375rem;
        font-size: 0.75rem;
        flex-wrap: wrap;
    }
    
    .sidebar-top-news-widget .news-type-badge {
        padding: 0.125rem 0.5rem;
        background: #3b82f6;
        color: white;
        font-weight: 600;
        text-transform: uppercase;
        border-radius: 0.25rem;
        font-size: 0.625rem;
        line-height: 1.5;
    }
    
    .sidebar-top-news-widget .news-date {
        color: #6b7280;
        font-size: 0.75rem;
    }
    
    .sidebar-top-news-widget .news-title {
        font-size: 0.9375rem;
        font-weight: 600;
        color: #1f2937;
        margin: 0;
        line-height: 1.4;
    }
    
    .sidebar-top-news-widget .news-title a {
        color: inherit;
        text-decoration: none;
    }
    
    .sidebar-top-news-widget .news-title a:hover {
        color: #3b82f6;
    }
    
    .sidebar-top-news-widget .view-all-link {
        display: block;
        margin-top: 1.25rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        color: #3b82f6;
        font-weight: 600;
        font-size: 0.875rem;
        text-decoration: none;
    }
    
    .sidebar-top-news-widget .view-all-link:hover {
        text-decoration: underline;
    }
    
    /* Mobile adjustments */
    @media (max-width: 768px) {
        .sidebar-top-news-widget {
            padding: 1rem;
        }
        
        .sidebar-top-news-widget .news-thumbnail {
            width: 60px;
            height: 60px;
        }
        
        .sidebar-top-news-widget .news-title {
            font-size: 0.875rem;
        }
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return SidebarTopNewsConfig

    def prepare_template_context(self, config, context=None):
        """Prepare template context with sidebar news items"""
        template_config = super().prepare_template_context(config, context)
        context = context or {}

        # Parse config using Pydantic model
        try:
            news_config = SidebarTopNewsConfig(**config)
        except Exception as e:
            return {
                "error": f"Invalid configuration: {str(e)}",
                "news_items": [],
            }

        # Query news items
        news_items = self._get_sidebar_news_items(news_config)

        template_config.update(
            {
                "news_items": news_items,
                "config": news_config,
            }
        )

        return template_config

    def _get_sidebar_news_items(self, config: SidebarTopNewsConfig):
        """Query and return sidebar news items"""
        from object_storage.models import ObjectInstance

        try:
            # Build queryset
            queryset = ObjectInstance.objects.filter(
                object_type__name__in=config.object_types, status="published"
            ).select_related("object_type", "current_version")

            # Annotate with pinned/featured status
            queryset = queryset.annotate(
                is_pinned=Case(
                    When(
                        Q(metadata__pinned=True) | Q(metadata__featured=True),
                        then=Value(True),
                    ),
                    default=Value(False),
                    output_field=BooleanField(),
                )
            )

            # Sort: pinned first, then by publish_date descending
            queryset = queryset.order_by("-is_pinned", "-publish_date", "-created_at")

            # Limit results
            items = list(queryset[: config.limit])

            # Prepare items with thumbnails
            for item in items:
                # Get thumbnail from current version data
                if config.show_thumbnails and item.current_version:
                    item.thumbnail_url = (
                        item.data.get("thumbnail")
                        or item.data.get("featured_image")
                        or item.data.get("featuredImage")
                    )
                else:
                    item.thumbnail_url = None

            return items

        except Exception:
            return []
