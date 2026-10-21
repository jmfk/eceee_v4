"""
Object Storage Display Widgets

Widget types for displaying object storage instances in web pages.
These widgets integrate with the existing widget system to show dynamic objects.
"""

from datetime import datetime
from typing import Optional, Type

from django.db.models import Q
from django.utils import timezone
from pydantic import BaseModel, Field, validator

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget

from .models import ObjectInstance, ObjectTypeDefinition


class ObjectListConfig(BaseModel):
    """Configuration for Object List widget"""

    object_type: str = Field(..., description="Object type to display (e.g., 'news', 'blog')")
    limit: int = Field(
        default=5,
        ge=1,
        le=50,
        description="Maximum number of objects to display",
        json_schema_extra={"group": "Content"},
    )
    order_by: str = Field(
        default="-created_at",
        description="Field to order by (prefix with - for descending)",
        json_schema_extra={"group": "Content"},
    )
    status_filter: str = Field(
        default="published",
        description="Status filter: 'all', 'draft', 'published', 'archived'",
        json_schema_extra={"group": "Content"},
    )
    show_hierarchy: bool = Field(default=False, description="Show hierarchical structure with indentation")
    display_template: str = Field(default="card", description="Display template: 'card', 'list', 'minimal'")
    show_excerpt: bool = Field(default=True, description="Show excerpt from object data")
    excerpt_field: Optional[str] = Field(
        default=None,
        description="Field to use for excerpt (auto-detect if not specified)",
    )
    excerpt_length: int = Field(default=150, ge=50, le=500, description="Maximum length of excerpt")

    @validator("object_type")
    def validate_object_type(cls, v):
        """Validate that object type exists and is active"""
        try:
            ObjectTypeDefinition.objects.get(name=v, is_active=True)
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
        json_schema_extra={"group": "Content"},
    )
    object_type: Optional[str] = Field(
        default=None,
        description="Object type filter if using slug lookup",
        json_schema_extra={"group": "Content"},
    )
    object_slug: Optional[str] = Field(
        default=None,
        description="Object slug for lookup (alternative to object_id)",
        json_schema_extra={"group": "Content"},
    )
    display_template: str = Field(default="full", description="Display template: 'full', 'summary', 'minimal'")
    show_metadata: bool = Field(default=False, description="Show object metadata and technical details")
    show_hierarchy: bool = Field(default=True, description="Show parent/child relationships")
    show_widgets: bool = Field(default=True, description="Render object's widget slots")


class ObjectChildrenConfig(BaseModel):
    """Configuration for Object Children widget"""

    parent_object_id: Optional[int] = Field(
        default=None,
        description="Parent object ID (if not provided, uses context)",
        json_schema_extra={"group": "Content"},
    )
    object_type_filter: Optional[str] = Field(
        default=None,
        description="Filter children by object type",
        json_schema_extra={"group": "Content"},
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Maximum number of children to display",
        json_schema_extra={"group": "Content"},
    )
    order_by: str = Field(
        default="title",
        description="Field to order children by",
        json_schema_extra={"group": "Content"},
    )
    display_template: str = Field(default="card", description="Display template: 'card', 'list', 'grid'")
    show_levels: int = Field(default=1, ge=1, le=5, description="Number of hierarchy levels to show")


@register_widget_type
@catalog_widget
class ObjectListWidget(BaseWidget):
    """Display a list of objects from the object storage system"""

    description = "Display a filtered list of objects from the object storage system"
    template_name = "object_storage/widgets/object_list.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ObjectListConfig

    def get_context_data(self, config: ObjectListConfig, page_context: dict) -> dict:
        """Get objects and prepare context for template rendering"""
        try:
            # Get object type
            current_page = page_context.get("current_page") or page_context.get("page")
            tenant = getattr(current_page, "tenant", None)
            if tenant is None:
                return {"objects": [], "error": "Tenant context is required", "config": config}
            object_types = ObjectTypeDefinition.objects.filter(name=config.object_type, is_active=True)
            if tenant:
                object_types = object_types.filter(Q(namespace__tenant=tenant) | Q(namespace__isnull=True))
            object_type = object_types.get()

            # Public rendering must always start from effective, unexpired versions.
            queryset = ObjectInstance.published.published_only().filter(object_type=object_type)
            if tenant:
                queryset = queryset.filter(tenant=tenant)

            # Preserve the legacy status filter without allowing it to bypass
            # date-based publication checks.
            if config.status_filter not in {"all", "published"}:
                queryset = queryset.filter(status=config.status_filter)

            # Apply ordering
            if config.order_by.lstrip("-") == "publish_date":
                from django.db.models import OuterRef, Subquery
                from django.utils import timezone

                from .models import ObjectVersion

                published_version = (
                    ObjectVersion.objects.filter(object_instance=OuterRef("pk"), effective_date__lte=timezone.now())
                    .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=timezone.now()))
                    .order_by("-version_number")
                )
                direction = "-" if config.order_by.startswith("-") else ""
                queryset = queryset.annotate(
                    published_effective_date=Subquery(published_version.values("effective_date")[:1])
                ).order_by(f"{direction}published_effective_date", f"{direction}id")
            else:
                queryset = queryset.order_by(config.order_by, "id")

            # Apply limit
            objects = list(queryset[: config.limit])

            # Prepare objects with excerpts
            for obj in objects:
                published_version = obj.get_current_published_version()
                if published_version:
                    obj.render_publish_date = published_version.effective_date
                obj.excerpt = self._get_excerpt(
                    obj,
                    config,
                    published_version.data if published_version else {},
                )

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

    def prepare_template_context(self, config, context=None):
        parsed = ObjectListConfig(**(config or {}))
        prepared = super().prepare_template_context(parsed.model_dump(), context)
        prepared.update(self.get_context_data(parsed, context or {}))
        return prepared

    def _get_excerpt(self, obj: ObjectInstance, config: ObjectListConfig, data=None) -> str:
        """Extract excerpt from object data"""
        if not config.show_excerpt:
            return ""
        data = data if data is not None else obj.data

        # Use specified field or auto-detect
        if config.excerpt_field and config.excerpt_field in data:
            text = str(data[config.excerpt_field])
        else:
            # Auto-detect content field
            content_fields = ["content", "description", "summary", "text", "body"]
            text = ""
            for field in content_fields:
                if field in data and data[field]:
                    text = str(data[field])
                    break

        # Truncate to excerpt length
        if len(text) > config.excerpt_length:
            text = text[: config.excerpt_length].rsplit(" ", 1)[0] + "..."

        return text


@register_widget_type
@catalog_widget
class ObjectDetailWidget(BaseWidget):
    """Display a single object with full details"""

    description = "Display a single object with full details and widgets"
    template_name = "object_storage/widgets/object_detail.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ObjectDetailConfig

    def get_context_data(self, config: ObjectDetailConfig, page_context: dict) -> dict:
        """Get object and prepare context for template rendering"""
        try:
            obj = None
            object_slug = None
            current_page = page_context.get("current_page") or page_context.get("page")
            tenant = getattr(current_page, "tenant", None)
            if tenant is None:
                return {"object": None, "error": "Tenant context is required", "config": config}

            # Get object by ID or slug (using version-based publishing)
            path_variables = page_context.get("path_variables", {})
            object_id = config.object_id or (path_variables.get("id") if not config.object_slug else None)
            if object_id:
                queryset = ObjectInstance.published.published_only().filter(object_type__is_active=True)
                if tenant:
                    queryset = queryset.filter(tenant=tenant).filter(
                        Q(object_type__namespace__tenant=tenant) | Q(object_type__namespace__isnull=True)
                    )
                obj = queryset.select_related("object_type", "parent", "current_version").filter(id=object_id).first()
            else:
                object_slug = config.object_slug or next(
                    (
                        path_variables.get(key)
                        for key in (
                            "news_slug",
                            "event_slug",
                            "library_slug",
                            "member_slug",
                            "date_slug",
                            "slug",
                            "category_slug",
                        )
                        if path_variables.get(key)
                    ),
                    None,
                )
            if not obj and object_slug and config.object_type:
                object_types = ObjectTypeDefinition.objects.filter(name=config.object_type, is_active=True)
                if tenant:
                    object_types = object_types.filter(Q(namespace__tenant=tenant) | Q(namespace__isnull=True))
                object_type = object_types.get()
                queryset = ObjectInstance.published.published_only()
                if tenant:
                    queryset = queryset.filter(tenant=tenant)
                obj = (
                    queryset.select_related("object_type", "parent", "current_version")
                    .filter(slug=object_slug, object_type=object_type)
                    .first()
                )

            if not obj:
                return {
                    "object": None,
                    "error": "Object not found or not published",
                    "config": config,
                }

            published_version = obj.get_current_published_version()
            if published_version:
                obj.render_publish_date = published_version.effective_date

            context = {
                "object": obj,
                "object_type": obj.object_type,
                "published_version": published_version,
                "config": config,
            }

            # Add hierarchy information if requested
            if config.show_hierarchy:
                # Get IDs of published objects to filter hierarchy
                from django.utils import timezone

                now = timezone.now()
                published_qs = ObjectInstance.published.published_only(now)
                if tenant:
                    published_qs = published_qs.filter(tenant=tenant, object_type__is_active=True).filter(
                        Q(object_type__namespace__tenant=tenant) | Q(object_type__namespace__isnull=True)
                    )
                published_ids = list(published_qs.values_list("id", flat=True))

                context.update(
                    {
                        "ancestors": obj.get_ancestors().filter(id__in=published_ids),
                        "children": obj.get_children().filter(id__in=published_ids),
                        "siblings": obj.get_siblings().filter(id__in=published_ids),
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

    def prepare_template_context(self, config, context=None):
        parsed = ObjectDetailConfig(**(config or {}))
        prepared = super().prepare_template_context(parsed.model_dump(), context)
        prepared.update(self.get_context_data(parsed, context or {}))
        obj = prepared.get("object")
        published_version = prepared.get("published_version")
        if obj and published_version and parsed.show_widgets and context and context.get("renderer"):
            rendered_widgets = {}
            for slot_name, widgets in published_version.widgets.items():
                rendered_widgets[slot_name] = []
                for widget_data in widgets:
                    is_published = widget_data.get("isPublished", widget_data.get("is_published", True))
                    is_visible = widget_data.get("isVisible", widget_data.get("is_visible", True))
                    if not is_published or not is_visible:
                        continue
                    now = timezone.now()
                    effective_date = widget_data.get("publishEffectiveDate") or widget_data.get(
                        "publish_effective_date"
                    )
                    expiry_date = widget_data.get("publishExpireDate") or widget_data.get("publish_expire_date")
                    if isinstance(effective_date, str):
                        try:
                            effective_date = datetime.fromisoformat(effective_date.replace("Z", "+00:00"))
                        except ValueError:
                            effective_date = None
                    if isinstance(expiry_date, str):
                        try:
                            expiry_date = datetime.fromisoformat(expiry_date.replace("Z", "+00:00"))
                        except ValueError:
                            expiry_date = None
                    if (effective_date and effective_date > now) or (expiry_date and expiry_date < now):
                        continue
                    widget_config = widget_data.get("config", {})
                    config_visible = widget_config.get("isVisible", widget_config.get("is_visible", True))
                    is_active = widget_config.get("isActive", widget_config.get("is_active", True))
                    if not config_visible or not is_active:
                        continue
                    try:
                        rendered_widgets[slot_name].append(context["renderer"].render_widget_json(widget_data, context))
                    except Exception:
                        continue
            prepared["rendered_widgets"] = rendered_widgets
        return prepared


@register_widget_type
@catalog_widget
class ObjectChildrenWidget(BaseWidget):
    """Display children of an object in a hierarchical view"""

    description = "Display child objects in a hierarchical structure"
    template_name = "object_storage/widgets/object_children.html"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ObjectChildrenConfig

    def get_context_data(self, config: ObjectChildrenConfig, page_context: dict) -> dict:
        """Get children objects and prepare context for template rendering"""
        try:
            parent_obj = None

            # Get parent object (using version-based publishing)
            if config.parent_object_id:
                parent_obj = ObjectInstance.published.published_only().filter(id=config.parent_object_id).first()
            else:
                # Try to get from page context (if object detail page)
                parent_obj = page_context.get("object")

            if not parent_obj:
                return {
                    "children": [],
                    "error": "Parent object not found",
                    "config": config,
                }

            # Get children with hierarchy (filter to only published)
            from django.utils import timezone

            now = timezone.now()
            published_qs = ObjectInstance.published.published_only(now)
            published_ids = list(published_qs.values_list("id", flat=True))

            children = parent_obj.get_descendants().filter(
                id__in=published_ids, level__lte=parent_obj.level + config.show_levels
            )

            # Apply object type filter
            if config.object_type_filter:
                object_type = ObjectTypeDefinition.objects.get(name=config.object_type_filter, is_active=True)
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
