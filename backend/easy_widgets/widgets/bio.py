"""
Bio widget implementation.
"""

from typing import Type, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type

import logging

logger = logging.getLogger(__name__)


class BioMediaItem(BaseModel):
    """Media item for Bio widget image"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    id: Optional[str] = Field(None, description="Media file ID")
    url: str = Field(..., description="Media URL")
    altText: str = Field(
        ..., min_length=1, description="Alternative text for accessibility"
    )
    caption: Optional[str] = Field(None, description="Optional caption")
    title: Optional[str] = Field(None, description="Image title")
    width: Optional[int] = Field(None, description="Image width")
    height: Optional[int] = Field(None, description="Image height")


class BioConfig(BaseModel):
    """Configuration for Bio widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    image: Optional[BioMediaItem] = Field(
        None,
        description="Image for bio",
        json_schema_extra={
            "component": "ImageInput",
            "mediaTypes": ["image"],
            "order": 0,
            "group": "Content",
        },
    )
    bioText: str = Field(
        "",
        description="Biography text content (HTML)",
        json_schema_extra={
            "component": "HtmlSource",
            "rows": 6,
            "order": 1,
            "group": "Content",
        },
    )
    caption: str = Field(
        "",
        description="Caption text for the bio",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "Enter caption text",
            "order": 2,
            "group": "Content",
        },
    )
    textLayout: Literal["column", "flow"] = Field(
        "column",
        description="Text layout mode: column (side-by-side) or flow (text wraps around image)",
        json_schema_extra={
            "component": "SelectInput",
            "options": [
                {"value": "column", "label": "Column (side-by-side)"},
                {"value": "flow", "label": "Flow (text wraps around)"},
            ],
            "order": 3,
            "group": "Layout",
        },
    )
    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
            "order": 0,
            "group": "Display Options",
        },
    )
    useContentMargins: bool = Field(
        False,
        description="Use content margins (extra left/right padding on larger screens)",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "order": 1,
            "group": "Display Options",
        },
    )
    anchor: str = Field(
        "",
        description="Anchor ID for linking to this section",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "section-name",
            "order": 9999,
            "group": "Advanced",
        },
    )
    anchor_title: str = Field(
        "",
        description="Anchor title (for navigation menus)",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "Display name for navigation",
            "helpText": "Displayed in navigation menus when linking to this bio",
            "order": 10000,
            "group": "Advanced",
        },
    )


@register_widget_type
class BioWidget(BaseWidget):
    """Bio widget with image and text content"""

    name = "Bio"
    description = "Biography widget with image and text"
    template_name = "easy_widgets/widgets/bio.html"

    widget_css = """
    .bio-widget {
        display: block;
        width: 100%;
        height: auto;
        margin-bottom: 30px;
    }
    
    .bio-widget__container {
        width: 100%;
    }
    
    /* Column layout - side by side */
    .bio-widget--column .bio-widget__container {
        display: flex;
        gap: 30px;
        align-items: flex-start;
    }
    
    .bio-widget--column .bio-widget__image {
        flex: 0 0 33.33%;
        max-width: 33.33%;
    }
    
    .bio-widget--column .bio-widget__text {
        flex: 1;
        min-width: 0;
    }
    
    /* Flow layout - text wraps around image */
    .bio-widget--flow .bio-widget__container {
        display: block;
    }
    
    .bio-widget--flow .bio-widget__image {
        float: left;
        width: 33.33%;
        max-width: 400px;
        margin: 0 30px 30px 0;
    }
    
    .bio-widget--flow .bio-widget__text {
        display: block;
    }
    
    /* Clear float after flow layout */
    .bio-widget--flow .bio-widget__container::after {
        content: "";
        display: table;
        clear: both;
    }
    
    /* Image styling */
    .bio-widget__image img {
        width: 100%;
        height: auto;
    }   
   
    /* Responsive - stack on mobile */
    @media (max-width: 768px) {
        .bio-widget--column .bio-widget__container {
            flex-direction: column;
        }
        
        .bio-widget--column .bio-widget__image {
            flex: 0 0 auto;
            max-width: 100%;
            margin-bottom: 40px;
        }
        
        .bio-widget--flow .bio-widget__image {
            float: none;
            width: 100%;
            max-width: 100%;
            margin: 0 0 30px 0;
        }
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return BioConfig

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with processed media and text.
        """
        template_config = super().prepare_template_context(config, context)
        context = context if context else {}

        # Convert camelCase to snake_case for template
        template_config["bio_text"] = config.get("bioText", config.get("bio_text", ""))
        template_config["text_layout"] = config.get(
            "textLayout", config.get("text_layout", "column")
        )
        template_config["use_content_margins"] = (
            config.get("useContentMargins")
            if "useContentMargins" in config
            else config.get("use_content_margins", False)
        )

        # Handle image - pass through directly to preserve imgproxy_base_url
        template_config["image"] = config.get("image")

        # Add caption
        template_config["caption"] = config.get("caption", "")

        return template_config
