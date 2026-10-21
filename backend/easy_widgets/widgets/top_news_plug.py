"""
Top News Plug Widget - Display top news in various grid layouts
"""

from typing import List, Type

from django.db.models import BooleanField, Case, Q, Value, When
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget


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
            "group": "Content",
        },
    )

    layout: str = Field(
        default="1x3",
        description="Select layout configuration",
        json_schema_extra={
            "component": "RadioInput",
            "group": "Layout",
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
    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
        },
    )


@register_widget_type
@catalog_widget
class TopNewsPlugWidget(BaseWidget):
    """Display top news in various grid layouts for homepage/landing pages"""

    description = "Display top/featured news in configurable grid layouts"
    template_name = "easy_widgets/widgets/top_news_plug.html"

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
                    item.featured_image_url = item.data.get("featured_image") or item.data.get("featuredImage")
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
        excerpt = data.get("summary") or data.get("excerpt") or data.get("description") or data.get("content", "")

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
