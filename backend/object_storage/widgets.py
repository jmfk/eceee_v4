"""
Object Storage Display Widgets

Widget types for displaying object storage instances in web pages.
These widgets integrate with the existing widget system to show dynamic objects.
"""

from datetime import datetime
from typing import Optional, Type

from django.db.models import F, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce, NullIf
from django.utils import timezone
from pydantic import BaseModel, ConfigDict, Field, validator
from pydantic.alias_generators import to_camel

from webpages.widget_registry import BaseWidget, register_widget_type
from widget_contracts import catalog_widget

from .models import ObjectInstance, ObjectTypeDefinition, ObjectVersion


def _bind_public_snapshot(obj, now):
    """Attach render-only fields from the live version without changing its pointer."""
    version = obj.get_current_published_version(now)
    if version:
        obj.title = version.content_title
        obj.render_data = version.data
        obj.render_publish_date = version.effective_date
    return version


def _order_by_public_title(queryset, order_by, now):
    """Sort on the same live title rendered after the queryset is limited."""
    live_title = (
        ObjectVersion.objects.filter(object_instance_id=OuterRef("pk"), effective_date__lte=now)
        .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
        .order_by("-version_number")
        .values("title")[:1]
    )
    direction = "-" if order_by.startswith("-") else ""
    return queryset.annotate(public_title=Coalesce(NullIf(Subquery(live_title), Value("")), F("title"))).order_by(
        f"{direction}public_title", f"{direction}id"
    )


class ObjectListConfig(BaseModel):
    """Configuration for Object List widget"""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

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
            ObjectTypeDefinition.objects.get(name=v, is_active=True, is_deleted=False)
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

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

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

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

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
            object_types = ObjectTypeDefinition.objects.filter(
                name=config.object_type, is_active=True, is_deleted=False
            )
            if tenant:
                object_types = object_types.filter(Q(namespace__tenant=tenant) | Q(namespace__isnull=True))
            object_type = object_types.get()

            # Public rendering must always start from effective, unexpired versions.
            now = timezone.now()
            queryset = ObjectInstance.published.published_only(now).filter(object_type=object_type)
            if tenant:
                queryset = queryset.filter(tenant=tenant)

            # Preserve the legacy status filter without allowing it to bypass
            # date-based publication checks.
            if config.status_filter not in {"all", "published"}:
                queryset = queryset.filter(status=config.status_filter)

            # Apply ordering
            if config.order_by.lstrip("-") == "title":
                queryset = _order_by_public_title(queryset, config.order_by, now)
            elif config.order_by.lstrip("-") == "publish_date":
                published_version = (
                    ObjectVersion.objects.filter(object_instance=OuterRef("pk"), effective_date__lte=now)
                    .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
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
                published_version = _bind_public_snapshot(obj, now)
                obj.excerpt = self._get_excerpt(
                    obj,
                    config,
                    published_version.data if published_version else {},
                )
                if config.show_hierarchy and obj.parent_id:
                    parent = (
                        ObjectInstance.published.published_only(now)
                        .filter(pk=obj.parent_id, tenant=tenant, object_type__is_active=True)
                        .filter(Q(object_type__namespace__tenant=tenant) | Q(object_type__namespace__isnull=True))
                        .first()
                    )
                    if parent and _bind_public_snapshot(parent, now):
                        obj.render_parent = parent

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
                object_types = ObjectTypeDefinition.objects.filter(
                    name=config.object_type, is_active=True, is_deleted=False
                )
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
                obj.title = published_version.content_title
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

                ancestors = list(obj.get_ancestors().filter(id__in=published_ids))
                children = list(obj.get_children().filter(id__in=published_ids))
                siblings = list(obj.get_siblings().filter(id__in=published_ids))
                for relative in (*ancestors, *children, *siblings):
                    _bind_public_snapshot(relative, now)
                context.update({"ancestors": ancestors, "children": children, "siblings": siblings})

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
            from webpages.theme_widgets import iter_widgets, object_widget_theme

            widget_context = (
                {**context, "widget_theme": object_widget_theme(obj.tenant_id)}
                if any(iter_widgets(published_version.widgets))
                else context
            )
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
                        rendered_widgets[slot_name].append(
                            context["renderer"].render_widget_json(widget_data, widget_context)
                        )
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
            current_page = page_context.get("current_page") or page_context.get("page")
            tenant = getattr(current_page, "tenant", None)
            if tenant is None:
                return {"children": [], "error": "Tenant context is required", "config": config}
            now = timezone.now()
            published_qs = (
                ObjectInstance.published.published_only(now)
                .filter(tenant=tenant, object_type__is_active=True)
                .filter(Q(object_type__namespace__tenant=tenant) | Q(object_type__namespace__isnull=True))
            )
            parent_obj = None

            # Get parent object (using version-based publishing)
            if config.parent_object_id:
                parent_obj = published_qs.filter(id=config.parent_object_id).first()
            else:
                # Try to get from page context (if object detail page)
                context_obj = page_context.get("object")
                if context_obj:
                    parent_obj = published_qs.filter(id=context_obj.id).first()

            if not parent_obj:
                return {
                    "children": [],
                    "error": "Parent object not found",
                    "config": config,
                }

            _bind_public_snapshot(parent_obj, now)

            # Get children with hierarchy (filter to only published)
            published_ids = list(published_qs.values_list("id", flat=True))

            children = parent_obj.get_descendants().filter(
                id__in=published_ids, level__lte=parent_obj.level + config.show_levels
            )

            # Apply object type filter
            if config.object_type_filter:
                object_type = ObjectTypeDefinition.objects.get(
                    name=config.object_type_filter, is_active=True, is_deleted=False
                )
                children = children.filter(object_type=object_type)

            # Apply ordering and limit using the live title when requested.
            if config.order_by.lstrip("-") == "title":
                children = _order_by_public_title(children, config.order_by, now)
            else:
                children = children.order_by(config.order_by)
            children = list(children[: config.limit])
            for child in children:
                _bind_public_snapshot(child, now)

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
