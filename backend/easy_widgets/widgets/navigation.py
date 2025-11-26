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
        Also prepares enhanced page context for Component Style templates.
        """
        from webpages.structure_helpers import get_structure_helpers
        from dataclasses import asdict
        import logging

        logger = logging.getLogger(__name__)

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
                    # Use anchor_title if available, fallback to title/header, then anchor
                    label = (widget_config.get("anchor_title") or 
                            widget_config.get("title") or 
                            widget_config.get("header") or 
                            anchor)
                    dynamic_menu_items.append(
                        {
                            "label": label,
                            "url": f"#{anchor}",
                            "isActive": True,
                            "targetBlank": False,
                        }
                    )

        elif active_group in ["page_submenu", "pageSubmenu"]:
            # NOTE: pageSubmenu will be generated AFTER owner_page is determined
            # Skip for now, will be generated below
            pass

        # Add dynamic menu items to config (will be updated later if pageSubmenu)
        template_config["dynamic_menu_items"] = dynamic_menu_items

        # Enhanced page context for Component Style templates
        helpers = get_structure_helpers()
        current_page_obj = context.get("page") or context.get("current_page")
        parent_page_obj = context.get("parent")

        # Determine if widget is inherited and owner page
        widget_inherited_from = context.get("widget_inherited_from")
        is_inherited = widget_inherited_from is not None
        owner_page_obj = current_page_obj  # Default to current page

        # If widget is inherited, fetch the actual owner page
        if is_inherited and widget_inherited_from:
            try:
                from webpages.models import WebPage

                # Handle different formats of inherited_from
                if isinstance(widget_inherited_from, dict):
                    # It's a dict with {id, title, slug}
                    owner_page_id = widget_inherited_from.get("id")
                    owner_page_obj = WebPage.objects.get(id=owner_page_id)
                elif isinstance(widget_inherited_from, str):
                    # It's a slug string - fetch page by slug
                    owner_page_obj = WebPage.objects.get(slug=widget_inherited_from)
                elif isinstance(widget_inherited_from, WebPage):
                    # It's already a WebPage object
                    owner_page_obj = widget_inherited_from
            except Exception as e:
                # Fallback to current page if owner not found
                logger.error(f"[NAV] Error fetching owner page: {e}")
                pass

        # Convert pages to metadata dicts for template context
        def page_to_dict(page):
            """Convert WebPage model or PageMetadata to dict"""
            if page is None:
                return None
            if hasattr(page, "id"):
                # It's a WebPage model, convert to metadata
                metadata = helpers._page_to_metadata(page)
                return asdict(metadata)
            elif hasattr(page, "__dict__"):
                # It's already a PageMetadata dataclass
                return asdict(page)
            return None

        # Get current page metadata
        current_page_meta = None
        current_children = []
        if current_page_obj:
            if hasattr(current_page_obj, "id"):
                current_page_meta = asdict(helpers._page_to_metadata(current_page_obj))
                try:
                    children_info = helpers.get_active_children(
                        current_page_obj.id, include_unpublished=False
                    )
                    current_children = [
                        {
                            "id": child.page.id,
                            "title": child.page.title,
                            "slug": child.page.slug,
                            "path": child.page.path,
                            "description": child.page.description,
                        }
                        for child in children_info
                    ]
                except Exception:
                    pass
            else:
                current_page_meta = page_to_dict(current_page_obj)

        # Get owner page metadata and children (the page where this widget was defined)
        owner_page_meta = None
        owner_children = []
        if owner_page_obj:
            if hasattr(owner_page_obj, "id"):
                owner_page_meta = asdict(helpers._page_to_metadata(owner_page_obj))
                try:
                    children_info = helpers.get_active_children(
                        owner_page_obj.id, include_unpublished=False
                    )
                    owner_children = [
                        {
                            "id": child.page.id,
                            "title": child.page.title,
                            "slug": child.page.slug,
                            "path": child.page.path,
                            "description": child.page.description,
                        }
                        for child in children_info
                    ]
                except Exception:
                    pass
            else:
                owner_page_meta = page_to_dict(owner_page_obj)

        # NOW generate pageSubmenu if needed (after owner_page_obj is determined)
        if active_group in ["page_submenu", "pageSubmenu"]:
            # Use OWNER PAGE for inherited widgets, not current page
            page_for_submenu = owner_page_obj if owner_page_obj else current_page_obj

            if page_for_submenu and hasattr(page_for_submenu, "id"):
                try:
                    children = helpers.get_active_children(
                        page_for_submenu.id, include_unpublished=False
                    )

                    for child_info in children:
                        # child_info is a ChildPageInfo dataclass
                        page_metadata = child_info.page
                        dynamic_menu_items.append(
                            {
                                "label": page_metadata.title,
                                "url": page_metadata.path,
                                "isActive": True,
                                "targetBlank": False,
                            }
                        )
                except Exception as e:
                    # Silently fail if children can't be loaded
                    logger.error(f"[NAV] Error generating pageSubmenu: {e}")
                    pass

        # Update dynamic menu items after pageSubmenu generation
        template_config["dynamic_menu_items"] = dynamic_menu_items

        # Get parent page metadata and children
        parent_page_meta = None
        parent_children = []
        if parent_page_obj:
            if hasattr(parent_page_obj, "id"):
                parent_page_meta = asdict(helpers._page_to_metadata(parent_page_obj))
                try:
                    children_info = helpers.get_active_children(
                        parent_page_obj.id, include_unpublished=False
                    )
                    parent_children = [
                        {
                            "id": child.page.id,
                            "title": child.page.title,
                            "slug": child.page.slug,
                            "path": child.page.path,
                            "description": child.page.description,
                        }
                        for child in children_info
                    ]
                except Exception:
                    pass
            else:
                parent_page_meta = page_to_dict(parent_page_obj)

        # Add enhanced context for Component Style templates
        template_config["owner_page"] = owner_page_meta
        template_config["owner_children"] = owner_children
        template_config["hasOwnerChildren"] = len(owner_children) > 0
        template_config["current_page"] = current_page_meta
        template_config["current_children"] = current_children
        template_config["hasCurrentChildren"] = len(current_children) > 0
        template_config["parent_page"] = parent_page_meta
        template_config["parent_children"] = parent_children
        template_config["hasParentChildren"] = len(parent_children) > 0
        template_config["isInherited"] = is_inherited
        
        # Inheritance depth and helper booleans for Mustache templates
        depth = context.get("widget_inheritance_depth", 0)
        template_config["inheritanceDepth"] = depth
        template_config["isRoot"] = depth == 0
        template_config["isLevel1"] = depth == 1
        template_config["isLevel2"] = depth == 2
        template_config["isLevel3"] = depth == 3
        template_config["isLevel1AndBelow"] = depth >= 1
        template_config["isLevel2AndBelow"] = depth >= 2
        template_config["isLevel3AndBelow"] = depth >= 3
        template_config["isDeepLevel"] = depth >= 4

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
        import logging

        logger = logging.getLogger(__name__)

        # Get navigation style
        style_name = config.get("navigation_style")

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
        # Include all enhanced page context variables from prepare_template_context
        # All variables use camelCase for consistency
        context = {
            "items": all_items,
            "dynamicItems": dynamic_items,
            "staticItems": static_items,
            "itemCount": len(all_items),
            "hasItems": len(all_items) > 0,
            # Enhanced page context for Component Style templates
            "ownerPage": config.get("owner_page"),
            "ownerChildren": config.get("owner_children", []),
            "hasOwnerChildren": config.get("hasOwnerChildren", False),
            "currentPage": config.get("current_page"),
            "currentChildren": config.get("current_children", []),
            "hasCurrentChildren": config.get("hasCurrentChildren", False),
            "parentPage": config.get("parent_page"),
            "parentChildren": config.get("parent_children", []),
            "hasParentChildren": config.get("hasParentChildren", False),
            "isInherited": config.get("isInherited", False),
            # Inheritance depth helpers
            "inheritanceDepth": config.get("inheritanceDepth", 0),
            "isRoot": config.get("isRoot", False),
            "isLevel1": config.get("isLevel1", False),
            "isLevel2": config.get("isLevel2", False),
            "isLevel3": config.get("isLevel3", False),
            "isLevel1AndBelow": config.get("isLevel1AndBelow", False),
            "isLevel2AndBelow": config.get("isLevel2AndBelow", False),
            "isLevel3AndBelow": config.get("isLevel3AndBelow", False),
            "isDeepLevel": config.get("isDeepLevel", False),
            # Style-specific variables
            **(style.get("variables") or {}),
        }

        # Render template
        html = render_mustache(style.get("template", ""), context)
        css = style.get("css", "")
        return html, css
