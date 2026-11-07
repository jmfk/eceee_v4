"""CMS discovery/validation adapter; News Flash rendering and selection use TypeScript."""

from typing import List, Literal, Union

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget


class NewsFlashConfig(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    object_types: List[Union[str, int]] = Field(
        default=["article"],
        description="Published news object types",
        json_schema_extra={"component": "ObjectTypeSelectorInput", "multiple": True, "group": "Content"},
    )
    classification_ids: List[str] = Field(
        default_factory=list,
        description="Filter by classification",
        json_schema_extra={"component": "ClassificationSelectorInput"},
    )
    include_descendants: bool = Field(default=True, description="Include descendant classifications")
    current_columnist: bool = Field(
        default=False,
        description="Only columns by the URL-selected columnist",
        json_schema_extra={"component": "BooleanInput", "variant": "toggle"},
    )
    news_page_path: str = Field(default="/news/", description="Path to the news detail page")
    image_shape: Literal["square", "landscape"] = Field(
        default="landscape", title="Image shape", json_schema_extra={"group": "Layout"}
    )
    show_excerpts: bool = Field(default=True, description="Show short summaries")
    full_width_count: int = Field(default=1, ge=0, title="Full-width stories", json_schema_extra={"group": "Layout"})
    half_width_count: int = Field(default=2, ge=0, title="Half-width stories", json_schema_extra={"group": "Layout"})
    third_width_count: int = Field(default=0, ge=0, title="Third-width stories", json_schema_extra={"group": "Layout"})


@register_widget_type
@catalog_widget
class NewsFlashWidget(BaseWidget):
    description = "Published news in configurable full, half and third-width layouts"
    css_scope = "widget"
    template_name = "easy_widgets/widgets/news_flash.html"

    @property
    def configuration_model(self):
        return NewsFlashConfig
