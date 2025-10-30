"""
Top News Plug Widget - Display top news in various grid layouts
"""

from typing import Type, List
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from django.db.models import Case, When, Value, BooleanField, Q

from webpages.widget_registry import BaseWidget, register_widget_type


class TopNewsPlugConfig(BaseModel):
    """Configuration for Top News Plug widget"""

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

    layout: str = Field(
        default="1x3",
        description="Select layout configuration",
        json_schema_extra={
            "component": "RadioInput",
            "options": [
                {
                    "value": "1x3",
                    "label": "1 Row × 3 Columns",
                    "description": "Three items in a single row",
                },
                {
                    "value": "1x2",
                    "label": "1 Row × 2 Columns",
                    "description": "Two items in a single row",
                },
                {
                    "value": "2x3_2",
                    "label": "2 Rows (3+2)",
                    "description": "First row: 3 items, Second row: 2 items",
                },
                {
                    "value": "2x1",
                    "label": "2 Rows × 1 Column",
                    "description": "Two items stacked vertically",
                },
                {
                    "value": "2x2",
                    "label": "2 Rows × 2 Columns",
                    "description": "Four items in a 2×2 grid",
                },
            ],
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
        default=100,
        ge=50,
        le=300,
        description="Maximum length of excerpt text",
        json_schema_extra={
            "component": "NumberInput",
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

    show_object_type: bool = Field(
        default=True,
        description="Show object type badge",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )


@register_widget_type
class TopNewsPlugWidget(BaseWidget):
    """Display top news in various grid layouts for homepage/landing pages"""

    name = "Top News Plug"
    description = "Display top/featured news in configurable grid layouts"
    template_name = "easy_widgets/widgets/top_news_plug.html"

    widget_css = """
    .top-news-plug-widget {
        font-family: var(--body-font, inherit);
        margin: 2rem 0;
    }
    
    /* Layout: 1x3 - Three columns */
    .top-news-plug-widget.layout-1x3 .news-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2rem;
    }
    
    /* Layout: 1x2 - Two columns */
    .top-news-plug-widget.layout-1x2 .news-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 2rem;
    }
    
    /* Layout: 2x3_2 - First row 3 cols, second row 2 cols */
    .top-news-plug-widget.layout-2x3_2 .news-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 2rem;
    }
    
    .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(1),
    .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(2),
    .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(3) {
        grid-column: span 2;
    }
    
    .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(4),
    .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(5) {
        grid-column: span 3;
    }
    
    /* Layout: 2x1 - Two rows, one column */
    .top-news-plug-widget.layout-2x1 .news-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2rem;
        max-width: 800px;
        margin: 0 auto;
    }
    
    /* Layout: 2x2 - Four items in 2x2 grid */
    .top-news-plug-widget.layout-2x2 .news-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 2rem;
    }
    
    /* News card styling */
    .top-news-plug-widget .news-card {
        position: relative;
        border-radius: 0.75rem;
        overflow: hidden;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
    }
    
    .top-news-plug-widget .news-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
    }
    
    .top-news-plug-widget .news-card.pinned::before {
        content: "📌";
        position: absolute;
        top: 1rem;
        right: 1rem;
        z-index: 10;
        background: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.875rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .top-news-plug-widget .news-image {
        width: 100%;
        height: 200px;
        overflow: hidden;
        background: #f3f4f6;
    }
    
    .top-news-plug-widget .news-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
    }
    
    .top-news-plug-widget .news-card:hover .news-image img {
        transform: scale(1.05);
    }
    
    .top-news-plug-widget .news-body {
        padding: 1.5rem;
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    
    .top-news-plug-widget .news-meta {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
        font-size: 0.75rem;
        align-items: center;
    }
    
    .top-news-plug-widget .news-type-badge {
        padding: 0.25rem 0.625rem;
        background: #3b82f6;
        color: white;
        font-weight: 600;
        text-transform: uppercase;
        border-radius: 0.25rem;
        letter-spacing: 0.025em;
    }
    
    .top-news-plug-widget .news-date {
        color: #6b7280;
        font-size: 0.875rem;
    }
    
    .top-news-plug-widget .news-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: #1f2937;
        margin: 0 0 0.75rem 0;
        line-height: 1.3;
    }
    
    .top-news-plug-widget .news-title a {
        color: inherit;
        text-decoration: none;
    }
    
    .top-news-plug-widget .news-title a:hover {
        color: #3b82f6;
    }
    
    .top-news-plug-widget .news-excerpt {
        color: #4b5563;
        line-height: 1.6;
        font-size: 0.9375rem;
        flex: 1;
    }
    
    .top-news-plug-widget .news-footer {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
    }
    
    .top-news-plug-widget .read-more {
        color: #3b82f6;
        font-weight: 600;
        font-size: 0.875rem;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
    }
    
    .top-news-plug-widget .read-more:hover {
        text-decoration: underline;
    }
    
    /* Tablet responsiveness */
    @media (max-width: 1024px) {
        .top-news-plug-widget.layout-1x3 .news-grid {
            grid-template-columns: repeat(2, 1fr);
        }
        
        .top-news-plug-widget.layout-2x3_2 .news-grid {
            grid-template-columns: repeat(2, 1fr);
        }
        
        .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(1),
        .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(2),
        .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(3),
        .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(4),
        .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(5) {
            grid-column: span 1;
        }
    }
    
    /* Mobile responsiveness - all layouts become single column */
    @media (max-width: 768px) {
        .top-news-plug-widget .news-grid {
            grid-template-columns: 1fr !important;
            gap: 1.5rem;
        }
        
        .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(1),
        .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(2),
        .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(3),
        .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(4),
        .top-news-plug-widget.layout-2x3_2 .news-card:nth-child(5) {
            grid-column: span 1 !important;
        }
        
        .top-news-plug-widget .news-title {
            font-size: 1.125rem;
        }
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return TopNewsPlugConfig

    def prepare_template_context(self, config, context=None):
        """Prepare template context with top news items"""
        template_config = super().prepare_template_context(config, context)
        context = context or {}

        # Parse config using Pydantic model
        try:
            news_config = TopNewsPlugConfig(**config)
        except Exception as e:
            return {
                "error": f"Invalid configuration: {str(e)}",
                "news_items": [],
            }

        # Determine number of items based on layout
        items_count = self._get_items_count_for_layout(news_config.layout)

        # Query news items
        news_items = self._get_top_news_items(news_config, items_count)

        template_config.update(
            {
                "news_items": news_items,
                "config": news_config,
                "layout_class": f"layout-{news_config.layout}",
            }
        )

        return template_config

    def _get_items_count_for_layout(self, layout: str) -> int:
        """Get the number of items to fetch based on layout"""
        layout_counts = {
            "1x3": 3,
            "1x2": 2,
            "2x3_2": 5,
            "2x1": 2,
            "2x2": 4,
        }
        return layout_counts.get(layout, 3)

    def _get_top_news_items(self, config: TopNewsPlugConfig, limit: int):
        """Query and return top news items"""
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
            items = list(queryset[:limit])

            # Prepare items with excerpts and images
            for item in items:
                if config.show_excerpts:
                    item.excerpt_text = self._get_excerpt(item, config.excerpt_length)
                else:
                    item.excerpt_text = None

                # Get featured image from current version data
                if item.current_version:
                    item.featured_image_url = item.data.get(
                        "featured_image"
                    ) or item.data.get("featuredImage")
                else:
                    item.featured_image_url = None

            return items

        except Exception:
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
