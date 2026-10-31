"""
Top News Plug Widget - Display top news in various grid layouts
"""

from typing import List, Type

from django.db.models import BooleanField, Case, Q, Value, When
from django.utils import timezone
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
        current_page = context.get("current_page") or context.get("page")
        news_items = self._get_top_news_items(news_config, items_count, getattr(current_page, "tenant", None))

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

    def _get_top_news_items(self, config: TopNewsPlugConfig, limit: int, tenant=None):
        """Query and return top news items"""
        from object_storage.models import ObjectInstance, ObjectTypeDefinition

        if tenant is None:
            return []

        try:
            now = timezone.now()
            type_ids = (
                ObjectTypeDefinition.objects.filter(name__in=config.object_types, is_active=True, is_deleted=False)
                .filter(Q(namespace__tenant=tenant) | Q(namespace__isnull=True))
                .values_list("id", flat=True)
            )
            type_ids = list(type_ids)
            if not type_ids:
                return []
            queryset = ObjectInstance.get_published_objects(
                object_type_ids=type_ids, sort_order="-publish_date", now=now, tenant=tenant
            )

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

            queryset = queryset.order_by("-is_pinned", "-live_effective_date", "-created_at")

            # Limit results
            items = list(queryset[:limit])

            # Prepare items with excerpts and images
            for item in items:
                live_version = item.get_current_published_version(now)
                if not live_version:
                    continue
                item.title = live_version.content_title
                item.publish_date = live_version.effective_date
                live_data = live_version.data
                if config.show_excerpts:
                    item.excerpt_text = self._get_excerpt(live_data, config.excerpt_length)
                else:
                    item.excerpt_text = None

                item.featured_image_url = live_data.get("featured_image") or live_data.get("featuredImage")

            return items

        except Exception:
            return []

    def _get_excerpt(self, data, max_length: int) -> str:
        """Extract excerpt from object data"""

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
