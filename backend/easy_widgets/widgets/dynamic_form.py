"""
Dynamic Forms widget implementation.
Links to forms created in the Form Manager.
"""

from typing import Type, Optional, List, Literal, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class DynamicFormConfig(BaseModel):
    """Configuration for Dynamic Form widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    form_name: str = Field(
        ...,
        description="The identifier of the form to display",
        json_schema_extra={
            "component": "FormSelector", # Custom component to pick from available forms
        },
    )
    
    show_title: bool = Field(
        True,
        description="Display form title",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )
    
    show_description: bool = Field(
        True,
        description="Display form description",
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
    
    anchor: str = Field(
        "",
        description="Anchor ID for linking",
        json_schema_extra={
            "component": "TextInput",
            "group": "Advanced",
        },
    )


@register_widget_type
class DynamicFormWidget(BaseWidget):
    """Dynamic Form widget that renders forms from the forms app"""

    name = "Dynamic Form"
    description = "Embed a form created in the Form Manager"
    template_name = "easy_widgets/widgets/dynamic_form.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return DynamicFormConfig

    def get_context(self, config, request=None):
        """Add the actual form definition to the context"""
        from forms.models import Form
        context = super().get_context(config, request)
        
        form_name = config.get("form_name")
        if form_name:
            try:
                form_obj = Form.objects.get(name=form_name, is_active=True)
                context["form_definition"] = form_obj
            except Form.DoesNotExist:
                context["form_error"] = f"Form '{form_name}' not found."
        
        return context

