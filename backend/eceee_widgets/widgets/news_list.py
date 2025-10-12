"""
News List Widget - Display a list of news from selected ObjectTypes
"""

from typing import Type, List
from pydantic import BaseModel, Field, ConfigDict, field_validator
from pydantic.alias_generators import to_camel
from django.db.models import Q, F, Value, Case, When, BooleanField
from django.db.models.functions import Coalesce

from webpages.widget_registry import BaseWidget, register_widget_type


class NewsListConfig(BaseModel):
    """Configuration for News List widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    object_types: List[int] = Field(
        default=[],
        description="Select ObjectType(s) to display",
        json_schema_extra={
            "component": "ObjectTypeSelectorInput",
            "multiple": True,
        },
    )

    limit: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of items to display",
        json_schema_extra={
            "component": "NumberInput",
        },
    )

    hide_on_detail_view: bool = Field(
        default=False,
        description="Hide this widget when rendering on a detail page",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )

    show_excerpts: bool = Field(
        default=True,
        description="Show excerpt text for each item",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )

    excerpt_length: int = Field(
        default=150,
        ge=50,
        le=500,
        description="Maximum length of excerpt text",
        json_schema_extra={
            "component": "NumberInput",
        },
    )

    show_featured_image: bool = Field(
        default=True,
        description="Show featured image for each item",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )

    show_publish_date: bool = Field(
        default=True,
        description="Show publish date",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )


@register_widget_type
class NewsListWidget(BaseWidget):
    """Display a list of news from selected ObjectTypes"""

    name = "News List"
    description = "Display a list of news articles from selected ObjectTypes"
    template_name = "eceee_widgets/widgets/news_list.html"

    widget_css = """
    .news-list-widget {
        font-family: var(--body-font, inherit);
    }
    
    .news-list-widget .news-item {
        display: flex;
        gap: 1.5rem;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        background: #ffffff;
        transition: all 0.2s ease;
    }
    
    .news-list-widget .news-item:hover {
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }
    
    .news-list-widget .news-item.pinned {
        border-left: 4px solid #3b82f6;
        background: #eff6ff;
    }
    
    .news-list-widget .news-featured-image {
        flex-shrink: 0;
        width: 200px;
        height: 150px;
        overflow: hidden;
        border-radius: 0.5rem;
    }
    
    .news-list-widget .news-featured-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .news-list-widget .news-content {
        flex: 1;
        min-width: 0;
    }
    
    .news-list-widget .news-meta {
        display: flex;
        gap: 1rem;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        color: #6b7280;
    }
    
    .news-list-widget .news-type {
        font-weight: 500;
        text-transform: uppercase;
        color: #3b82f6;
    }
    
    .news-list-widget .pinned-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.125rem 0.5rem;
        background: #3b82f6;
        color: white;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        border-radius: 0.25rem;
    }
    
    .news-list-widget .news-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1f2937;
        margin: 0 0 0.75rem 0;
        line-height: 1.3;
    }
    
    .news-list-widget .news-title a {
        color: inherit;
        text-decoration: none;
    }
    
    .news-list-widget .news-title a:hover {
        color: #3b82f6;
    }
    
    .news-list-widget .news-excerpt {
        color: #4b5563;
        line-height: 1.6;
        margin-bottom: 0.75rem;
    }
    
    .news-list-widget .news-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
    }
    
    .news-list-widget .news-date {
        font-size: 0.875rem;
        color: #6b7280;
    }
    
    .news-list-widget .read-more {
        font-size: 0.875rem;
        color: #3b82f6;
        font-weight: 600;
        text-decoration: none;
    }
    
    .news-list-widget .read-more:hover {
        text-decoration: underline;
    }
    
    /* Future HTMX filtering support */
    .news-list-widget .news-filters {
        margin-bottom: 1.5rem;
        padding: 1rem;
        background: #f9fafb;
        border-radius: 0.5rem;
    }
    
    /* Mobile responsiveness */
    @media (max-width: 768px) {
        .news-list-widget .news-item {
            flex-direction: column;
            gap: 1rem;
        }
        
        .news-list-widget .news-featured-image {
            width: 100%;
            height: 200px;
        }
        
        .news-list-widget .news-title {
            font-size: 1.25rem;
        }
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NewsListConfig

    def prepare_template_context(self, config, context=None):
        """Prepare template context with news items"""
        template_config = super().prepare_template_context(config, context)
        context = context or {}

        # Parse config using Pydantic model
        try:
            news_config = NewsListConfig(**config)
        except Exception as e:
            return {
                "error": f"Invalid configuration: {str(e)}",
                "news_items": [],
            }

        # Check if we should hide on detail view
        path_variables = context.get("path_variables", {})
        if news_config.hide_on_detail_view and path_variables:
            # If there are path variables, we're likely on a detail page
            return {
                "hidden": True,
                "news_items": [],
            }

        # Query news items
        news_items = self._get_news_items(news_config)

        template_config.update(
            {
                "news_items": news_items,
                "config": news_config,
            }
        )

        return template_config

    def _get_news_items(self, config: NewsListConfig):
        """Query and return news items based on configuration"""
        from object_storage.models import ObjectInstance

        try:
            # Build queryset
            queryset = ObjectInstance.objects.filter(
                object_type_id__in=config.object_types, status="published"
            ).select_related("object_type", "current_version")

            # Annotate with pinned/featured status from metadata
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

            # Prepare items with excerpts
            for item in items:
                if config.show_excerpts:
                    item.excerpt_text = self._get_excerpt(item, config.excerpt_length)
                else:
                    item.excerpt_text = None

                # Get featured image from current version data
                if config.show_featured_image and item.current_version:
                    item.featured_image_url = item.data.get(
                        "featured_image"
                    ) or item.data.get("featuredImage")
                else:
                    item.featured_image_url = None

            return items

        except Exception as e:
            # Log error in production
            return []

    def _get_excerpt(self, obj, max_length: int) -> str:
        """Extract excerpt from object data"""
        if not obj.current_version:
            return ""

        data = obj.data

        # Try to find excerpt field
        excerpt = (
            data.get("excerpt")
            or data.get("summary")
            or data.get("description")
            or data.get("content", "")
        )

        # Clean and truncate
        if isinstance(excerpt, str):
            # Remove HTML tags if present
            import re

            excerpt = re.sub(r"<[^>]+>", "", excerpt)

            # Truncate to max length
            if len(excerpt) > max_length:
                excerpt = excerpt[:max_length].rsplit(" ", 1)[0] + "..."

            return excerpt

        return ""
