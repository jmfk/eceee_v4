"""
Forms widget implementation.
"""

from typing import Type
from pydantic import BaseModel

from webpages.widget_registry import BaseWidget, register_widget_type
from ..widget_models import FormsConfig


@register_widget_type
class FormsWidget(BaseWidget):
    """Forms widget with schema support"""

    app_label = "core_widgets"
    name = "Forms"
    description = "Forms widget with schema support for building custom forms"
    template_name = "default_widgets/widgets/forms.html"

    widget_css = """
    .forms-widget {
        background-color: var(--form-bg-color, #ffffff);
        padding: var(--form-padding, 2rem);
        border-radius: var(--form-radius, 0.5rem);
        border: var(--form-border, 1px solid #e5e7eb);
        max-width: var(--form-max-width, 600px);
        margin: var(--form-margin, 0 auto);
    }
    
    .forms-widget .form-title {
        font-size: var(--form-title-size, 1.5rem);
        font-weight: var(--form-title-weight, 600);
        color: var(--form-title-color, #1f2937);
        margin-bottom: var(--form-title-margin, 1rem);
        text-align: var(--form-title-align, center);
    }
    
    .forms-widget .form-description {
        color: var(--form-description-color, #6b7280);
        margin-bottom: var(--form-description-margin, 2rem);
        text-align: var(--form-description-align, center);
        line-height: var(--form-description-line-height, 1.6);
    }
    
    .forms-widget .form-group {
        margin-bottom: var(--form-group-margin, 1.5rem);
    }
    
    .forms-widget label {
        display: block;
        font-weight: var(--form-label-weight, 500);
        color: var(--form-label-color, #374151);
        margin-bottom: var(--form-label-margin, 0.5rem);
        font-size: var(--form-label-size, 0.875rem);
    }
    
    .forms-widget .required {
        color: var(--form-required-color, #dc2626);
    }
    
    .forms-widget input[type="text"],
    .forms-widget input[type="email"],
    .forms-widget input[type="tel"],
    .forms-widget input[type="number"],
    .forms-widget textarea,
    .forms-widget select {
        width: 100%;
        padding: var(--form-input-padding, 0.75rem);
        border: var(--form-input-border, 1px solid #d1d5db);
        border-radius: var(--form-input-radius, 0.375rem);
        font-size: var(--form-input-font-size, 1rem);
        background-color: var(--form-input-bg, #ffffff);
        color: var(--form-input-color, #1f2937);
        transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
    }
    
    .forms-widget input:focus,
    .forms-widget textarea:focus,
    .forms-widget select:focus {
        outline: none;
        border-color: var(--form-input-focus-border, #3b82f6);
        box-shadow: var(--form-input-focus-shadow, 0 0 0 3px rgba(59, 130, 246, 0.1));
    }
    
    .forms-widget textarea {
        min-height: var(--form-textarea-height, 120px);
        resize: vertical;
    }
    
    .forms-widget .checkbox-group,
    .forms-widget .radio-group {
        display: flex;
        flex-direction: column;
        gap: var(--form-option-gap, 0.5rem);
    }
    
    .forms-widget .checkbox-item,
    .forms-widget .radio-item {
        display: flex;
        align-items: center;
        gap: var(--form-option-item-gap, 0.5rem);
    }
    
    .forms-widget input[type="checkbox"],
    .forms-widget input[type="radio"] {
        width: auto;
        margin: 0;
    }
    
    .forms-widget .submit-button {
        background-color: var(--form-submit-bg, #3b82f6);
        color: var(--form-submit-color, #ffffff);
        padding: var(--form-submit-padding, 0.75rem 2rem);
        border: none;
        border-radius: var(--form-submit-radius, 0.375rem);
        font-size: var(--form-submit-font-size, 1rem);
        font-weight: var(--form-submit-font-weight, 500);
        cursor: pointer;
        transition: background-color 0.2s ease-in-out;
        width: var(--form-submit-width, auto);
        margin: var(--form-submit-margin, 1rem auto 0);
        display: block;
    }
    
    .forms-widget .submit-button:hover {
        background-color: var(--form-submit-hover-bg, #2563eb);
    }
    
    .forms-widget .submit-button:disabled {
        background-color: var(--form-submit-disabled-bg, #9ca3af);
        cursor: not-allowed;
    }
    
    .forms-widget .form-error {
        color: var(--form-error-color, #dc2626);
        font-size: var(--form-error-size, 0.875rem);
        margin-top: var(--form-error-margin, 0.25rem);
    }
    
    .forms-widget .form-success {
        background-color: var(--form-success-bg, #dcfce7);
        color: var(--form-success-color, #166534);
        padding: var(--form-success-padding, 1rem);
        border-radius: var(--form-success-radius, 0.375rem);
        border: var(--form-success-border, 1px solid #bbf7d0);
        text-align: center;
    }
    """

    css_variables = {
        "form-bg-color": "#ffffff",
        "form-padding": "2rem",
        "form-radius": "0.5rem",
        "form-border": "1px solid #e5e7eb",
        "form-max-width": "600px",
        "form-margin": "0 auto",
        "form-title-size": "1.5rem",
        "form-title-weight": "600",
        "form-title-color": "#1f2937",
        "form-title-margin": "1rem",
        "form-title-align": "center",
        "form-description-color": "#6b7280",
        "form-description-margin": "2rem",
        "form-description-align": "center",
        "form-description-line-height": "1.6",
        "form-group-margin": "1.5rem",
        "form-label-weight": "500",
        "form-label-color": "#374151",
        "form-label-margin": "0.5rem",
        "form-label-size": "0.875rem",
        "form-required-color": "#dc2626",
        "form-input-padding": "0.75rem",
        "form-input-border": "1px solid #d1d5db",
        "form-input-radius": "0.375rem",
        "form-input-font-size": "1rem",
        "form-input-bg": "#ffffff",
        "form-input-color": "#1f2937",
        "form-input-focus-border": "#3b82f6",
        "form-input-focus-shadow": "0 0 0 3px rgba(59, 130, 246, 0.1)",
        "form-textarea-height": "120px",
        "form-option-gap": "0.5rem",
        "form-option-item-gap": "0.5rem",
        "form-submit-bg": "#3b82f6",
        "form-submit-color": "#ffffff",
        "form-submit-padding": "0.75rem 2rem",
        "form-submit-radius": "0.375rem",
        "form-submit-font-size": "1rem",
        "form-submit-font-weight": "500",
        "form-submit-width": "auto",
        "form-submit-margin": "1rem auto 0",
        "form-submit-hover-bg": "#2563eb",
        "form-submit-disabled-bg": "#9ca3af",
        "form-error-color": "#dc2626",
        "form-error-size": "0.875rem",
        "form-error-margin": "0.25rem",
        "form-success-bg": "#dcfce7",
        "form-success-color": "#166534",
        "form-success-padding": "1rem",
        "form-success-radius": "0.375rem",
        "form-success-border": "1px solid #bbf7d0",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return FormsConfig
