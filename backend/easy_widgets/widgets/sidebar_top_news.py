"""
Sidebar Top News Widget - Compact vertical list for sidebar placement
"""

from typing import List, Type

from django.db.models import BooleanField, Case, Q, Value, When
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget


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
            "group": "Content",
        },
    )

    limit: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Maximum number of items to display",
        json_schema_extra={
            "component": "NumberInput",
            "group": "Content",
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

    show_excerpts: bool = Field(
        default=False,
        description="Show a compact article summary",
        json_schema_extra={"component": "BooleanInput", "variant": "toggle"},
    )

    excerpt_length: int = Field(
        default=120,
        ge=40,
        le=300,
        description="Maximum excerpt length",
        json_schema_extra={"component": "NumberInput"},
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
            "group": "Content",
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
class SidebarTopNewsWidget(BaseWidget):
    """Compact vertical list of top news for sidebar placement"""

    description = "Compact list of top/featured news for sidebars"
    template_name = "easy_widgets/widgets/sidebar_top_news.html"

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
                        item.data.get("thumbnail") or item.data.get("featured_image") or item.data.get("featuredImage")
                    )
                else:
                    item.thumbnail_url = None
                item.excerpt_text = (
                    self._get_excerpt(item.data, config.excerpt_length)
                    if config.show_excerpts and item.current_version
                    else ""
                )

            return items

        except Exception:
            return []

    @staticmethod
    def _get_excerpt(data, max_length):
        import re

        excerpt = data.get("summary") or data.get("excerpt") or data.get("description") or ""
        excerpt = re.sub(r"<[^>]+>", "", excerpt) if isinstance(excerpt, str) else ""
        if len(excerpt) > max_length:
            excerpt = excerpt[:max_length].rsplit(" ", 1)[0] + "..."
        return excerpt
