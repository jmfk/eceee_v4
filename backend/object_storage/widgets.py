"""
Object Storage Display Widgets

Widget types for displaying object storage instances in web pages.
These widgets integrate with the existing widget system to show dynamic objects.
"""

from typing import Type, Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from django.template.loader import render_to_string
from django.utils.safestring import mark_safe

from webpages.widget_registry import BaseWidget, register_widget_type
from .models import ObjectTypeDefinition, ObjectInstance


class ObjectListConfig(BaseModel):
    """Configuration for Object List widget"""

    object_type: str = Field(
        ..., description="Object type to display (e.g., 'news', 'blog')"
    )
    limit: int = Field(
        default=5, ge=1, le=50, description="Maximum number of objects to display"
    )
    order_by: str = Field(
        default="-created_at",
        description="Field to order by (prefix with - for descending)",
    )
    status_filter: str = Field(
        default="published",
        description="Status filter: 'all', 'draft', 'published', 'archived'",
    )
    show_hierarchy: bool = Field(
        default=False, description="Show hierarchical structure with indentation"
    )
    display_template: str = Field(
        default="card", description="Display template: 'card', 'list', 'minimal'"
    )
    show_excerpt: bool = Field(
        default=True, description="Show excerpt from object data"
    )
    excerpt_field: Optional[str] = Field(
        default=None,
        description="Field to use for excerpt (auto-detect if not specified)",
    )
    excerpt_length: int = Field(
        default=150, ge=50, le=500, description="Maximum length of excerpt"
    )

    @validator("object_type")
    def validate_object_type(cls, v):
        """Validate that object type exists and is active"""
        try:
            obj_type = ObjectTypeDefinition.objects.get(name=v, is_active=True)
            return v
        except ObjectTypeDefinition.DoesNotExist:
            raise ValueError(f"Object type '{v}' does not exist or is not active")

    @validator("order_by")
    def validate_order_by(cls, v):
        """Validate order_by field"""
        valid_fields = [
            "title",
            "created_at",
            "updated_at",
            "publish_date",
            "-title",
            "-created_at",
            "-updated_at",
            "-publish_date",
        ]
        if v not in valid_fields:
            raise ValueError(f"Invalid order_by field. Must be one of: {valid_fields}")
        return v


class ObjectDetailConfig(BaseModel):
    """Configuration for Object Detail widget"""

    object_id: Optional[int] = Field(
        default=None,
        description="Specific object ID to display (if not provided, uses context)",
    )
    object_type: Optional[str] = Field(
        default=None, description="Object type filter if using slug lookup"
    )
    object_slug: Optional[str] = Field(
        default=None, description="Object slug for lookup (alternative to object_id)"
    )
    display_template: str = Field(
        default="full", description="Display template: 'full', 'summary', 'minimal'"
    )
    show_metadata: bool = Field(
        default=False, description="Show object metadata and technical details"
    )
    show_hierarchy: bool = Field(
        default=True, description="Show parent/child relationships"
    )
    show_widgets: bool = Field(default=True, description="Render object's widget slots")


class ObjectChildrenConfig(BaseModel):
    """Configuration for Object Children widget"""

    parent_object_id: Optional[int] = Field(
        default=None, description="Parent object ID (if not provided, uses context)"
    )
    object_type_filter: Optional[str] = Field(
        default=None, description="Filter children by object type"
    )
    limit: int = Field(
        default=10, ge=1, le=100, description="Maximum number of children to display"
    )
    order_by: str = Field(default="title", description="Field to order children by")
    display_template: str = Field(
        default="card", description="Display template: 'card', 'list', 'grid'"
    )
    show_levels: int = Field(
        default=1, ge=1, le=5, description="Number of hierarchy levels to show"
    )


@register_widget_type
class ObjectListWidget(BaseWidget):
    """Display a list of objects from the object storage system"""

    name = "Object List"
    description = "Display a filtered list of objects from the object storage system"
    template_name = "object_storage/widgets/object_list.html"
    config_model: Type[BaseModel] = ObjectListConfig

    widget_css = """
    .object-list-widget {
        font-family: var(--body-font, inherit);
    }
    
    .object-list-widget .object-item {
        padding: var(--object-padding, 1rem);
        margin-bottom: var(--object-spacing, 1rem);
        border: var(--object-border, 1px solid #e5e7eb);
        border-radius: var(--object-radius, 0.5rem);
        background: var(--object-bg, #ffffff);
    }
    
    .object-list-widget .object-item:hover {
        box-shadow: var(--object-hover-shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
        transform: var(--object-hover-transform, translateY(-2px));
        transition: all 0.2s ease;
    }
    
    .object-list-widget .object-title {
        font-size: var(--object-title-size, 1.25rem);
        font-weight: var(--object-title-weight, 600);
        color: var(--object-title-color, #1f2937);
        margin-bottom: var(--object-title-spacing, 0.5rem);
    }
    
    .object-list-widget .object-excerpt {
        color: var(--object-text-color, #6b7280);
        line-height: var(--object-line-height, 1.6);
    }
    
    .object-list-widget .object-meta {
        font-size: var(--object-meta-size, 0.875rem);
        color: var(--object-meta-color, #9ca3af);
        margin-top: var(--object-meta-spacing, 0.5rem);
    }
    
    .object-list-widget.template-card .object-item {
        background: var(--card-bg, #ffffff);
        border: var(--card-border, 1px solid #e5e7eb);
        border-radius: var(--card-radius, 0.75rem);
        padding: var(--card-padding, 1.5rem);
    }
    
    .object-list-widget.template-list .object-item {
        border-left: var(--list-border, 4px solid #3b82f6);
        padding-left: var(--list-padding, 1rem);
        background: transparent;
        border-radius: 0;
    }
    
    .object-list-widget.template-minimal .object-item {
        border: none;
        padding: var(--minimal-padding, 0.5rem 0);
        background: transparent;
    }
    """

    def get_context_data(self, config: ObjectListConfig, page_context: dict) -> dict:
        """Get objects and prepare context for template rendering"""
        try:
            # Get object type
            object_type = ObjectTypeDefinition.objects.get(
                name=config.object_type, is_active=True
            )

            # Build queryset
            queryset = ObjectInstance.objects.filter(object_type=object_type)

            # Apply status filter
            if config.status_filter != "all":
                queryset = queryset.filter(status=config.status_filter)

            # Apply ordering
            queryset = queryset.order_by(config.order_by)

            # Apply limit
            objects = list(queryset[: config.limit])

            # Prepare objects with excerpts
            for obj in objects:
                obj.excerpt = self._get_excerpt(obj, config)

            return {
                "objects": objects,
                "object_type": object_type,
                "config": config,
                "widget_css_class": f"template-{config.display_template}",
            }

        except ObjectTypeDefinition.DoesNotExist:
            return {
                "objects": [],
                "error": f"Object type '{config.object_type}' not found",
                "config": config,
            }
        except Exception as e:
            return {
                "objects": [],
                "error": f"Error loading objects: {str(e)}",
                "config": config,
            }

    def _get_excerpt(self, obj: ObjectInstance, config: ObjectListConfig) -> str:
        """Extract excerpt from object data"""
        if not config.show_excerpt:
            return ""

        # Use specified field or auto-detect
        if config.excerpt_field and config.excerpt_field in obj.data:
            text = str(obj.data[config.excerpt_field])
        else:
            # Auto-detect content field
            content_fields = ["content", "description", "summary", "text", "body"]
            text = ""
            for field in content_fields:
                if field in obj.data and obj.data[field]:
                    text = str(obj.data[field])
                    break

        # Truncate to excerpt length
        if len(text) > config.excerpt_length:
            text = text[: config.excerpt_length].rsplit(" ", 1)[0] + "..."

        return text


@register_widget_type
class ObjectDetailWidget(BaseWidget):
    """Display a single object with full details"""

    name = "Object Detail"
    description = "Display a single object with full details and widgets"
    template_name = "object_storage/widgets/object_detail.html"
    config_model: Type[BaseModel] = ObjectDetailConfig

    widget_css = """
    .object-detail-widget {
        font-family: var(--body-font, inherit);
    }
    
    .object-detail-widget .object-header {
        margin-bottom: var(--header-spacing, 2rem);
        padding-bottom: var(--header-padding, 1rem);
        border-bottom: var(--header-border, 1px solid #e5e7eb);
    }
    
    .object-detail-widget .object-title {
        font-size: var(--detail-title-size, 2rem);
        font-weight: var(--detail-title-weight, 700);
        color: var(--detail-title-color, #1f2937);
        margin-bottom: var(--detail-title-spacing, 0.5rem);
    }
    
    .object-detail-widget .object-meta {
        font-size: var(--detail-meta-size, 0.875rem);
        color: var(--detail-meta-color, #6b7280);
    }
    
    .object-detail-widget .object-content {
        margin: var(--content-spacing, 2rem 0);
    }
    
    .object-detail-widget .object-hierarchy {
        background: var(--hierarchy-bg, #f9fafb);
        padding: var(--hierarchy-padding, 1rem);
        border-radius: var(--hierarchy-radius, 0.5rem);
        margin: var(--hierarchy-spacing, 1rem 0);
    }
    """

    def get_context_data(self, config: ObjectDetailConfig, page_context: dict) -> dict:
        """Get object and prepare context for template rendering"""
        try:
            obj = None

            # Get object by ID or slug
            if config.object_id:
                obj = ObjectInstance.objects.select_related(
                    "object_type", "parent"
                ).get(id=config.object_id, status="published")
            elif config.object_slug and config.object_type:
                object_type = ObjectTypeDefinition.objects.get(
                    name=config.object_type, is_active=True
                )
                obj = ObjectInstance.objects.select_related(
                    "object_type", "parent"
                ).get(
                    slug=config.object_slug, object_type=object_type, status="published"
                )

            if not obj:
                return {
                    "object": None,
                    "error": "Object not found or not published",
                    "config": config,
                }

            context = {"object": obj, "object_type": obj.object_type, "config": config}

            # Add hierarchy information if requested
            if config.show_hierarchy:
                context.update(
                    {
                        "ancestors": obj.get_ancestors(),
                        "children": obj.get_children().filter(status="published"),
                        "siblings": obj.get_siblings().filter(status="published"),
                    }
                )

            return context

        except (ObjectInstance.DoesNotExist, ObjectTypeDefinition.DoesNotExist):
            return {"object": None, "error": "Object not found", "config": config}
        except Exception as e:
            return {
                "object": None,
                "error": f"Error loading object: {str(e)}",
                "config": config,
            }


@register_widget_type
class ObjectChildrenWidget(BaseWidget):
    """Display children of an object in a hierarchical view"""

    name = "Object Children"
    description = "Display child objects in a hierarchical structure"
    template_name = "object_storage/widgets/object_children.html"
    config_model: Type[BaseModel] = ObjectChildrenConfig

    widget_css = """
    .object-children-widget {
        font-family: var(--body-font, inherit);
    }
    
    .object-children-widget .children-list {
        margin: var(--children-spacing, 1rem 0);
    }
    
    .object-children-widget .child-item {
        margin: var(--child-spacing, 0.5rem 0);
        padding: var(--child-padding, 0.75rem);
        border-left: var(--child-border, 3px solid #e5e7eb);
        background: var(--child-bg, #f9fafb);
    }
    
    .object-children-widget .child-item.level-1 {
        margin-left: var(--level-1-indent, 1rem);
        border-color: var(--level-1-color, #3b82f6);
    }
    
    .object-children-widget .child-item.level-2 {
        margin-left: var(--level-2-indent, 2rem);
        border-color: var(--level-2-color, #10b981);
    }
    
    .object-children-widget .child-item.level-3 {
        margin-left: var(--level-3-indent, 3rem);
        border-color: var(--level-3-color, #f59e0b);
    }
    
    .object-children-widget .child-title {
        font-weight: var(--child-title-weight, 600);
        color: var(--child-title-color, #1f2937);
        margin-bottom: var(--child-title-spacing, 0.25rem);
    }
    
    .object-children-widget .child-meta {
        font-size: var(--child-meta-size, 0.75rem);
        color: var(--child-meta-color, #6b7280);
    }
    """

    def get_context_data(
        self, config: ObjectChildrenConfig, page_context: dict
    ) -> dict:
        """Get children objects and prepare context for template rendering"""
        try:
            parent_obj = None

            # Get parent object
            if config.parent_object_id:
                parent_obj = ObjectInstance.objects.get(
                    id=config.parent_object_id, status="published"
                )
            else:
                # Try to get from page context (if object detail page)
                parent_obj = page_context.get("object")

            if not parent_obj:
                return {
                    "children": [],
                    "error": "Parent object not found",
                    "config": config,
                }

            # Get children with hierarchy
            children = parent_obj.get_descendants().filter(
                status="published", level__lte=parent_obj.level + config.show_levels
            )

            # Apply object type filter
            if config.object_type_filter:
                object_type = ObjectTypeDefinition.objects.get(
                    name=config.object_type_filter, is_active=True
                )
                children = children.filter(object_type=object_type)

            # Apply ordering and limit
            children = children.order_by(config.order_by)[: config.limit]

            return {"parent_object": parent_obj, "children": children, "config": config}

        except (ObjectInstance.DoesNotExist, ObjectTypeDefinition.DoesNotExist):
            return {
                "children": [],
                "error": "Parent object or type not found",
                "config": config,
            }
        except Exception as e:
            return {
                "children": [],
                "error": f"Error loading children: {str(e)}",
                "config": config,
            }
