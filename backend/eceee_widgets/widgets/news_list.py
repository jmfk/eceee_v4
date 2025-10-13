"""
News List Widget - Display a list of news from selected ObjectTypes
"""

from typing import Type, List
from pydantic import BaseModel, Field, ConfigDict, field_validator
from pydantic.alias_generators import to_camel

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

    sort_order: str = Field(
        default="-publish_date",
        description="Sort order for news items",
        json_schema_extra={
            "component": "SelectInput",
            "choices": [
                {"value": "-publish_date", "label": "Newest First (Publish Date)"},
                {"value": "publish_date", "label": "Oldest First (Publish Date)"},
                {"value": "-created_at", "label": "Newest First (Created)"},
                {"value": "created_at", "label": "Oldest First (Created)"},
                {"value": "title", "label": "Title (A-Z)"},
                {"value": "-title", "label": "Title (Z-A)"},
            ],
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
            # Use the model method to get published news items
            items = list(
                ObjectInstance.get_published_objects(
                    object_type_ids=config.object_types,
                    limit=config.limit,
                    sort_order=config.sort_order,
                    prioritize_featured=True,
                )
            )

            # Prepare items with excerpts and featured images
            prepared_items = []
            for item in items:
                # Get the published version for each item
                published_version = item.get_current_published_version()
                if not published_version:
                    continue  # Skip items without a published version

                # Add published_version to the item for template access
                item.published_version = published_version

                if config.show_excerpts:
                    item.excerpt_text = self._get_excerpt(
                        published_version.data, config.excerpt_length
                    )
                else:
                    item.excerpt_text = None

                # Get featured image from published version data
                if config.show_featured_image:
                    item.featured_image_url = published_version.data.get(
                        "featured_image"
                    ) or published_version.data.get("featuredImage")
                else:
                    item.featured_image_url = None

                prepared_items.append(item)

            return prepared_items

        except Exception as e:
            # Log error in production
            print(f"Error in _get_news_items: {e}")
            return []

    def _get_excerpt(self, data: dict, max_length: int) -> str:
        """Extract excerpt from published version data"""
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
