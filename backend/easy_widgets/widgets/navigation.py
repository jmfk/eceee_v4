"""
Navigation widget implementation.
"""

from typing import Type, Optional, List, Literal, Union, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type


class NavigationItem(BaseModel):
    """Navigation menu item"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,  # Allow both snake_case and camelCase
    )

    label: str = Field(..., description="Menu item label")
    url: str = Field(..., description="Menu item URL")
    is_active: bool = Field(True, description="Whether this item is active")
    target_blank: bool = Field(
        False, description="Whether the link opens in a new window"
    )


# Update forward reference
NavigationItem.model_rebuild()


class PageSectionConfig(BaseModel):
    """Page Section configuration"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    slot_name: str = Field(
        "main",
        description="Slot to search for section widgets",
        json_schema_extra={
            "component": "SelectInput",
            "optionsFunction": "getLayoutSlots",  # Dynamic function to get slots
            "placeholder": "Select slot...",
        },
    )

    sections_preview: Optional[str] = Field(
        default=None,
        description="Preview of page sections (display only)",
        json_schema_extra={
            "component": "PageSectionsDisplayField",
            "label": "Page Sections",
            "description": "Widgets with anchors from the selected slot will appear as navigation sections",
        },
    )


class PageSubmenuConfig(BaseModel):
    """Page Submenu configuration"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    children_preview: Optional[str] = Field(
        default=None,
        description="Preview of child pages (display only)",
        json_schema_extra={
            "component": "PageChildrenDisplayField",
            "label": "Child Pages",
            "description": "These pages will appear in this navigation section",
        },
    )


class NavigationConfig(BaseModel):
    """Configuration for Navigation widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    menus: Dict[str, Any] = Field(
        default_factory=lambda: {"activeGroup": "none", "formData": {}},
        description="Menu configuration (stores active group and all form data)",
        json_schema_extra={
            "component": "ConditionalGroupField",
            "groups": {
                "pageSections": {
                    "label": "Page Section",
                    "configModel": "PageSectionConfig",
                },
                "pageSubmenu": {
                    "label": "Page Submenu",
                    "configModel": "PageSubmenuConfig",
                },
                "none": {
                    "label": "None",
                },
            },
        },
    )

    menu_items: List[NavigationItem] = Field(
        default_factory=list,
        description="Navigation menu items",
        json_schema_extra={
            "component": "ItemsListField",
            "addButtonText": "Add Menu Item",
            "emptyText": "No menu items added yet",
            "itemLabelTemplate": "label",  # Use the label field for item display
        },
    )

    navigation_style: Optional[str] = Field(
        None,
        description="Component style to use for rendering (from theme)",
        json_schema_extra={
            "component": "ComponentStyleSelect",
            "label": "Navigation Style",
            "description": "Select a component style from the theme",
        },
    )


@register_widget_type
class NavigationWidget(BaseWidget):
    """Navigation widget with background and text styling options"""

    name = "Navigation"
    description = "Navigation widget with background image/color and text color options"
    template_name = "easy_widgets/widgets/navigation.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NavigationConfig

    def prepare_template_context(self, config, context=None):
        """
        Prepare navigation menu items based on configuration.
        Handles dynamic menu generation from page sections and child pages.
        """
        from webpages.structure_helpers import get_structure_helpers

        # Start with base config
        template_config = super().prepare_template_context(config, context)
        context = context if context else {}

        # Initialize dynamic menu items
        dynamic_menu_items = []

        # Get menus configuration
        menus = config.get("menus", {})
        active_group = menus.get("active_group")
        form_data = menus.get("form_data", {})

        if active_group in ["page_sections", "pageSections"]:
            # Get widgets with anchors from selected slot
            page_sections_data = form_data.get("page_sections", {})
            slot_name = page_sections_data.get("slot_name", "main")

            # Get widgets from context (now available from _build_base_context)
            widgets_by_slot = context.get("widgets", {})
            slot_widgets = widgets_by_slot.get(slot_name, [])

            # Filter widgets with anchor
            for widget in slot_widgets:
                widget_config = widget.get("config", {})
                anchor = widget_config.get("anchor")
                if anchor and anchor.strip():
                    dynamic_menu_items.append(
                        {
                            "label": anchor,
                            "url": f"#{anchor}",
                            "is_active": True,
                            "target_blank": False,
                        }
                    )

        elif active_group in ["page_submenu", "pageSubmenu"]:
            # Get child pages using structure helpers
            current_page = context.get("page") or context.get("current_page")

            if current_page:
                helpers = get_structure_helpers()
                try:
                    children = helpers.get_active_children(
                        current_page.id, include_unpublished=False
                    )

                    for child_info in children:
                        # child_info is a ChildPageInfo dataclass
                        page_metadata = child_info.page
                        dynamic_menu_items.append(
                            {
                                "label": page_metadata.title,
                                "url": page_metadata.path,
                                "is_active": True,
                                "target_blank": False,
                            }
                        )
                except Exception as e:
                    # Silently fail if children can't be loaded
                    pass

        # Add dynamic menu items to config
        template_config["dynamic_menu_items"] = dynamic_menu_items

        return template_config

    def render_with_style(self, config, theme=None):
        """
        Render navigation using theme's component styles with Mustache templates.

        Args:
            config: Widget configuration (already prepared via prepare_template_context)
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) or None if no custom style
        """
        from webpages.utils.mustache_renderer import render_mustache

        # Support both snake_case and camelCase
        style_name = config.get("navigation_style") or config.get("navigationStyle")
        # Only render with custom style if a style is explicitly selected
        if not style_name or style_name == "default":
            return None

        # Get style from theme
        style = None
        if theme:
            styles = theme.component_styles or {}
            style = styles.get(style_name)

        # If style not found, return None to use default template
        if not style:
            return None

        # Prepare navigation items (combine dynamic and static)
        all_items = []

        # Add dynamic menu items
        dynamic_items = config.get("dynamic_menu_items", [])
        all_items.extend(dynamic_items)

        # Add static menu items
        static_items = config.get("menu_items", [])
        all_items.extend(static_items)

        if not all_items:
            return None

        # Prepare context for Mustache rendering
        context = {
            "items": all_items,
            "dynamic_items": dynamic_items,
            "static_items": static_items,
            "itemCount": len(all_items),
            "hasItems": len(all_items) > 0,
            **(style.get("variables") or {}),
        }

        # Render template
        html = render_mustache(style.get("template", ""), context)
        css = style.get("css", "")
        return html, css
