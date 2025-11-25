"""
News Detail Widget - Display a single news article from ObjectTypes
"""

from typing import Type, List, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class NewsDetailConfig(BaseModel):
    """Configuration for News Detail widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    slug_variable_name: str = Field(
        default="news_slug",
        description="Name of the context variable holding the slug",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "news_slug",
        },
    )

    object_types: List[int] = Field(
        default=[],
        description="Select ObjectType(s) to display",
        json_schema_extra={
            "component": "ObjectTypeSelectorInput",
            "multiple": True,
        },
    )

    show_metadata: bool = Field(
        default=True,
        description="Show publish date, author, and other metadata",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )

    show_featured_image: bool = Field(
        default=True,
        description="Show featured image",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )

    show_object_type: bool = Field(
        default=True,
        description="Show object type label",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )

    render_object_widgets: bool = Field(
        default=True,
        description="Render the object's configured widget slots",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "helpText": "If enabled, renders widgets from the object's own widget configuration",
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
class NewsDetailWidget(BaseWidget):
    """Display a single news article if slug exists in context and matches configured ObjectTypes"""

    name = "News Detail"
    description = (
        "Display a single news article based on slug in URL path (multi-type support)"
    )
    template_name = "easy_widgets/widgets/news_detail.html"

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NewsDetailConfig

    def prepare_template_context(self, config, context=None):
        """Prepare template context with news detail"""
        template_config = super().prepare_template_context(config, context)
        context = context or {}

        # Parse config using Pydantic model
        try:
            news_config = NewsDetailConfig(**config)
        except Exception as e:
            return {
                "error": f"Invalid configuration: {str(e)}",
                "news_object": None,
            }

        # Get slug from path variables
        path_variables = context.get("path_variables", {})
        slug = path_variables.get(news_config.slug_variable_name)

        if not slug:
            # No slug in path variables - don't render
            return {
                "news_object": None,
                "should_render": False,
            }

        # Try to find the object in configured ObjectTypes
        obj, published_version = self._get_news_object(slug, news_config.object_types)
        if not obj or not published_version:
            # Slug exists but doesn't match any of this widget's configured ObjectTypes
            # This is normal - another detail widget might handle it
            return {
                "news_object": None,
                "should_render": False,
            }

        # Prepare object data
        featured_image = None
        if news_config.show_featured_image:
            featured_image = published_version.data.get(
                "featured_image"
            ) or published_version.data.get("featuredImage")

        # Get content from published version
        content_html = (
            published_version.data.get("content")
            or published_version.data.get("body")
            or published_version.data.get("text")
            or ""
        )

        # Get metadata
        metadata = {}
        if news_config.show_metadata:
            metadata = {
                "author": published_version.data.get("author"),
                "publish_date": published_version.effective_date,
                "created_at": obj.created_at,
                "updated_at": obj.updated_at,
            }

        # Render object widgets if enabled
        rendered_widgets = None
        if news_config.render_object_widgets and published_version.widgets:
            rendered_widgets = self._render_object_widgets_from_version(
                published_version, context
            )

        template_config.update(
            {
                "news_object": obj,  # Pass the ObjectInstance
                "published_version": published_version,  # Pass the published version
                "should_render": True,
                "config": news_config,
                "featured_image": featured_image,
                "content_html": content_html,
                "metadata": metadata,
                "rendered_widgets": rendered_widgets,
            }
        )

        return template_config

    def _get_news_object(self, slug: str, object_type_ids: List[int]):
        """Get published news object by slug and object types using date-based logic"""
        from object_storage.models import ObjectInstance

        try:
            # Step 1: Get the object - don't filter by status, use date-based publishing
            obj = (
                ObjectInstance.objects.filter(
                    slug=slug, object_type_id__in=object_type_ids
                )
                .select_related("object_type")
                .first()
            )
            if not obj:
                return None, None

            # Step 2: Get the published version
            published_version = obj.get_current_published_version()
            if not published_version:
                return None, None

            # Step 3: Return both for rendering
            return obj, published_version

        except Exception:
            return None, None

    def _render_object_widgets_from_version(
        self, published_version, context: dict
    ) -> dict:
        """Render widgets from the published version's widget configuration"""
        if not published_version.widgets or not context.get("renderer"):
            return {}

        rendered_slots = {}
        renderer = context["renderer"]

        # published_version.widgets is a dict like: {"main": [...], "sidebar": [...]}
        for slot_name, widgets in published_version.widgets.items():
            rendered_widgets = []
            for widget_data in widgets:
                try:
                    # Filter out hidden widgets (check both config.isVisible and config.is_visible)
                    widget_config = widget_data.get("config", {})
                    is_visible = widget_config.get("isVisible", widget_config.get("is_visible", True))
                    if not is_visible:
                        continue  # Skip hidden widgets
                    
                    # Filter out inactive widgets (check both config.isActive and config.is_active)
                    is_active = widget_config.get("isActive", widget_config.get("is_active", True))
                    if not is_active:
                        continue  # Skip inactive widgets
                    
                    widget_html = renderer.render_widget_json(widget_data, context)
                    rendered_widgets.append(widget_html)
                except Exception:
                    # Skip widgets that fail to render
                    continue
            rendered_slots[slot_name] = rendered_widgets

        return rendered_slots
