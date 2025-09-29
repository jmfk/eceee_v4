# ECEEE v4 Core Widgets

> **Built-in Widget Types for AI-Integrated Content Management System**  
> **Status**: Production Ready with Type-Safe Architecture  
> **Tech Stack**: Django + Pydantic + Auto-Discovery  
> **Last Updated**: December 2024

This Django app contains the built-in widget types for the eceee_v4 CMS, providing a comprehensive set of commonly used widgets with type-safe configuration validation.

## Purpose

The core widgets app provides a set of commonly used widget types that can be:
- **Enabled/Disabled**: Simply add/remove `core_widgets` from `INSTALLED_APPS` in settings.py
- **Extended**: Create new widgets in separate apps following the same pattern
- **Customized**: Override specific widget templates or implementations

## Included Widget Types

- **Text Block**: Rich text content with title and formatting options
- **Image**: Image display with caption and sizing options
- **Button**: Interactive buttons with various styles and CSS customization
- **Spacer**: Vertical spacing elements for layout control
- **HTML Block**: Custom HTML content blocks for advanced users
- **News**: News article widgets with metadata
- **Events**: Event display widgets with date/location details
- **Calendar**: Calendar widgets displaying events
- **Forms**: Contact or general purpose form widgets
- **Gallery**: Image gallery widgets with multiple display options
- **Default**: Fallback widget for unknown/legacy types

## Architecture

### Files
- `widgets.py`: Widget class implementations using the `@register_widget_type` decorator
- `widget_models.py`: Pydantic models for type-safe configuration validation
- `templates/webpages/widgets/`: Django templates for rendering each widget type

### Dependencies
- Depends on `webpages.widget_registry` for the base widget system
- Uses Pydantic for configuration validation
- Integrates with the CSS injection system for styling

## Creating Site-Specific Widgets

1. Create a new Django app for your custom widgets:
   ```bash
   python manage.py startapp my_site_widgets
   ```

2. Add it to `INSTALLED_APPS` in settings.py

3. Create a `widgets.py` file in your app:
   ```python
   from webpages.widget_registry import BaseWidget, register_widget_type
   from pydantic import BaseModel
   
   class MyWidgetConfig(BaseModel):
       title: str
       content: str
   
   @register_widget_type
   class MyCustomWidget(BaseWidget):
       name = "My Custom Widget"
       description = "A custom widget for my site"
       template_name = "my_site_widgets/my_widget.html"
       
       @property
       def configuration_model(self):
           return MyWidgetConfig
   ```

4. Create the template file in `my_site_widgets/templates/my_site_widgets/my_widget.html`

5. The widget will be automatically discovered and registered when Django starts

## Disabling Core Widgets

To use only custom widgets without the built-in types:

1. Remove `core_widgets` from `INSTALLED_APPS` in settings.py
2. The system will continue to work with only your custom widgets
3. Existing pages using core widgets will fall back to the default widget template

## Widget Registry Integration

All widgets are automatically registered with the global widget registry (`webpages.widget_registry.widget_type_registry`) through the autodiscovery system in `webpages.widget_autodiscovery.py`.

## 🔗 Related Documentation

- **[Code-Based Widget System](../docs/CODE_BASED_WIDGET_SYSTEM.md)** - Widget architecture and development guide
- **[Widget System Migration Guide](../../docs/WIDGET_SYSTEM_MIGRATION_GUIDE.md)** - Migration from legacy system
- **[Backend README](../README.md)** - Complete backend documentation
- **[Complete Documentation Index](../../DOCUMENTATION_INDEX.md)** - All project documentation

---

**ECEEE v4 Core Widgets**: Type-safe built-in widget library  
**Status**: Production Ready with Auto-Discovery  
**Integration**: Seamless widget registry integration  
**Documentation**: Comprehensive and Current