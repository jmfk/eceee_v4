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
        default="slug",
        description="Name of the context variable holding the slug",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "slug",
        },
    )

    object_types: List[str] = Field(
        default=["news"],
        description="Select ObjectType(s) this widget should handle",
        json_schema_extra={
            "component": "MultiSelectInput",
            "placeholder": "Select object types...",
            "helpText": "This widget only renders if the slug matches one of these ObjectTypes",
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


@register_widget_type
class NewsDetailWidget(BaseWidget):
    """Display a single news article if slug exists in context and matches configured ObjectTypes"""

    name = "News Detail"
    description = (
        "Display a single news article based on slug in URL path (multi-type support)"
    )
    template_name = "eceee_widgets/widgets/news_detail.html"

    widget_css = """
    .news-detail-widget {
        font-family: var(--body-font, inherit);
        max-width: 800px;
        margin: 0 auto;
    }
    
    .news-detail-widget .news-header {
        margin-bottom: 2rem;
    }
    
    .news-detail-widget .news-type-badge {
        display: inline-block;
        padding: 0.375rem 0.875rem;
        background: #3b82f6;
        color: white;
        font-size: 0.875rem;
        font-weight: 600;
        text-transform: uppercase;
        border-radius: 0.25rem;
        margin-bottom: 1rem;
    }
    
    .news-detail-widget .news-title {
        font-size: 2.5rem;
        font-weight: 800;
        color: #1f2937;
        margin: 0 0 1rem 0;
        line-height: 1.2;
    }
    
    .news-detail-widget .news-metadata {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
        padding: 1rem 0;
        border-top: 1px solid #e5e7eb;
        border-bottom: 1px solid #e5e7eb;
        font-size: 0.875rem;
        color: #6b7280;
        margin-bottom: 2rem;
    }
    
    .news-detail-widget .news-metadata-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .news-detail-widget .news-metadata-label {
        font-weight: 600;
        color: #4b5563;
    }
    
    .news-detail-widget .news-featured-image {
        width: 100%;
        margin-bottom: 2rem;
        border-radius: 0.5rem;
        overflow: hidden;
    }
    
    .news-detail-widget .news-featured-image img {
        width: 100%;
        height: auto;
        display: block;
    }
    
    .news-detail-widget .news-content {
        font-size: 1.125rem;
        line-height: 1.75;
        color: #374151;
    }
    
    .news-detail-widget .news-content h1,
    .news-detail-widget .news-content h2,
    .news-detail-widget .news-content h3 {
        margin-top: 2rem;
        margin-bottom: 1rem;
        font-weight: 700;
        color: #1f2937;
    }
    
    .news-detail-widget .news-content h1 { font-size: 2rem; }
    .news-detail-widget .news-content h2 { font-size: 1.75rem; }
    .news-detail-widget .news-content h3 { font-size: 1.5rem; }
    
    .news-detail-widget .news-content p {
        margin-bottom: 1.25rem;
    }
    
    .news-detail-widget .news-content ul,
    .news-detail-widget .news-content ol {
        margin-bottom: 1.25rem;
        padding-left: 2rem;
    }
    
    .news-detail-widget .news-content li {
        margin-bottom: 0.5rem;
    }
    
    .news-detail-widget .news-content blockquote {
        border-left: 4px solid #3b82f6;
        padding-left: 1.5rem;
        margin: 1.5rem 0;
        font-style: italic;
        color: #4b5563;
    }
    
    .news-detail-widget .news-object-widgets {
        margin-top: 3rem;
        padding-top: 3rem;
        border-top: 2px solid #e5e7eb;
    }
    
    .news-detail-widget .not-found-message {
        padding: 3rem 1.5rem;
        text-align: center;
        background: #f9fafb;
        border-radius: 0.5rem;
        border: 2px dashed #e5e7eb;
        color: #6b7280;
    }
    
    /* Mobile responsiveness */
    @media (max-width: 768px) {
        .news-detail-widget .news-title {
            font-size: 1.875rem;
        }
        
        .news-detail-widget .news-content {
            font-size: 1rem;
        }
        
        .news-detail-widget .news-metadata {
            flex-direction: column;
            gap: 0.75rem;
        }
    }
    """

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
        news_object = self._get_news_object(slug, news_config.object_types)

        if not news_object:
            # Slug exists but doesn't match any of this widget's configured ObjectTypes
            # This is normal - another detail widget might handle it
            return {
                "news_object": None,
                "should_render": False,
            }

        # Prepare object data
        featured_image = None
        if news_config.show_featured_image and news_object.current_version:
            featured_image = news_object.data.get(
                "featured_image"
            ) or news_object.data.get("featuredImage")

        # Get content
        content_html = ""
        if news_object.current_version:
            content_html = (
                news_object.data.get("content")
                or news_object.data.get("body")
                or news_object.data.get("text")
                or ""
            )

        # Get metadata
        metadata = {}
        if news_config.show_metadata and news_object.current_version:
            data = news_object.data
            metadata = {
                "author": data.get("author"),
                "publish_date": news_object.publish_date,
                "created_at": news_object.created_at,
                "updated_at": news_object.updated_at,
            }

        # Render object widgets if enabled
        rendered_widgets = None
        if news_config.render_object_widgets and news_object.widgets:
            rendered_widgets = self._render_object_widgets(news_object, context)

        template_config.update(
            {
                "news_object": news_object,
                "should_render": True,
                "config": news_config,
                "featured_image": featured_image,
                "content_html": content_html,
                "metadata": metadata,
                "rendered_widgets": rendered_widgets,
            }
        )

        return template_config

    def _get_news_object(self, slug: str, object_types: List[str]):
        """Get news object by slug and object types"""
        from object_storage.models import ObjectInstance

        try:
            obj = (
                ObjectInstance.objects.filter(
                    slug=slug, object_type__name__in=object_types, status="published"
                )
                .select_related("object_type", "current_version")
                .first()
            )

            return obj
        except Exception:
            return None

    def _render_object_widgets(self, obj, context: dict) -> dict:
        """Render widgets from the object's widget configuration"""
        if not obj.widgets or not context.get("renderer"):
            return {}

        rendered_slots = {}
        renderer = context["renderer"]

        # obj.widgets is a dict like: {"main": [...], "sidebar": [...]}
        for slot_name, widgets in obj.widgets.items():
            rendered_widgets = []
            for widget_data in widgets:
                try:
                    widget_html = renderer.render_widget_json(widget_data, context)
                    rendered_widgets.append(widget_html)
                except Exception:
                    # Skip widgets that fail to render
                    continue
            rendered_slots[slot_name] = rendered_widgets

        return rendered_slots
