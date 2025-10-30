"""
Object Storage System Models

This module defines the core models for the non-hierarchical object storage system:
- ObjectTypeDefinition: Defines object types with configurable schemas
- ObjectInstance: Actual object instances with dynamic data
- ObjectVersion: Version control for object instances

This system complements the hierarchical page system by providing flexible,
database-driven object types for content like news, blogs, events, etc.
"""

from django.db import models, transaction
from django.db.models import Case, When, F
from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.utils import timezone
from django.urls import reverse
from django.core.exceptions import ValidationError
from django.utils.text import slugify
from mptt.models import MPTTModel, TreeForeignKey
import json
from utils.schema_system import validate_schema, get_field_types_for_django_choices
from content.models import Namespace


class ObjectTypeDefinition(models.Model):
    """
    Defines object types with configurable schemas and widget slot configurations.
    This is the blueprint for creating dynamic object types like 'news', 'blog', 'event'.
    """

    @property
    def FIELD_TYPES(self):
        """Dynamic field types from the registry"""
        return get_field_types_for_django_choices()

    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Unique identifier for the object type (e.g., 'news', 'blog')",
    )
    label = models.CharField(
        max_length=200, help_text="Display name for the object type"
    )
    plural_label = models.CharField(
        max_length=200, help_text="Plural display name for the object type"
    )
    description = models.TextField(
        blank=True, help_text="Description of what this object type represents"
    )
    icon_image = models.ImageField(
        upload_to="object_types/icons/",
        blank=True,
        null=True,
        help_text="Visual representation of this object type",
    )
    schema = models.JSONField(
        default=dict, help_text="JSON schema defining the fields for this object type"
    )
    slot_configuration = models.JSONField(
        default=dict,
        help_text="JSON configuration defining widget slots and restrictions",
    )
    allowed_child_types = models.ManyToManyField(
        "self",
        blank=True,
        symmetrical=False,
        help_text="Object types that can be children of this type",
    )

    HIERARCHY_LEVEL_CHOICES = [
        ("top_level_only", "Top-level only"),
        ("sub_object_only", "Sub-object only"),
        ("both", "Both levels"),
    ]

    hierarchy_level = models.CharField(
        max_length=20,
        choices=HIERARCHY_LEVEL_CHOICES,
        default="both",
        help_text="Where this object type can appear in the content hierarchy",
    )
    namespace = models.ForeignKey(
        Namespace,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        help_text="Namespace for organizing content and media for this object type",
    )
    is_active = models.BooleanField(
        default=True, help_text="Whether this object type is available for use"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
    metadata = models.JSONField(
        default=dict, help_text="Additional extensible properties for this object type"
    )

    class Meta:
        ordering = ["label"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["namespace"]),
            GinIndex(fields=["schema"]),
            GinIndex(fields=["slot_configuration"]),
        ]

    def __str__(self):
        return self.label

    def get_effective_namespace(self):
        """Get the effective namespace for this object type (assigned namespace or default)"""
        if self.namespace:
            return self.namespace
        # Return the default namespace
        return Namespace.objects.filter(is_default=True).first()

    def clean(self):
        """Validate the object type definition."""
        super().clean()

        # Validate schema format
        if self.schema:
            self._validate_schema()

        # Validate slot configuration format
        if self.slot_configuration:
            self._validate_slot_configuration()

    def _validate_schema(self):
        """Validate the schema JSON structure using the general schema system."""
        try:
            validate_schema(self.schema, "object_type")
        except ValidationError:
            # Re-raise as is - ValidationError is already the correct type
            raise

    def _validate_slot_configuration(self):
        """Validate the slot configuration JSON structure."""
        if not isinstance(self.slot_configuration, dict):
            raise ValidationError("Slot configuration must be a JSON object")

        if "slots" in self.slot_configuration:
            if not isinstance(self.slot_configuration["slots"], list):
                raise ValidationError("Slot configuration 'slots' must be an array")

            for slot in self.slot_configuration["slots"]:
                if not isinstance(slot, dict):
                    raise ValidationError("Each slot must be an object")

                required_keys = ["name", "label"]
                for key in required_keys:
                    if key not in slot:
                        raise ValidationError(f"Slot missing required key: {key}")

                # Validate widget control definitions (accept both camelCase and snake_case)
                widget_controls_key = None
                if "widget_controls" in slot:
                    widget_controls_key = "widget_controls"
                elif "widgetControls" in slot:
                    widget_controls_key = "widgetControls"

                if widget_controls_key:
                    if not isinstance(slot[widget_controls_key], list):
                        raise ValidationError(
                            f"Slot '{slot['name']}': widget_controls must be an array"
                        )

                    for i, widget_control in enumerate(slot[widget_controls_key]):
                        if not isinstance(widget_control, dict):
                            raise ValidationError(
                                f"Slot '{slot['name']}': widget control {i+1} must be an object"
                            )

                        # Required fields (accept both cases)
                        widget_type = widget_control.get(
                            "widget_type"
                        ) or widget_control.get("widgetType")
                        if not widget_type:
                            raise ValidationError(
                                f"Slot '{slot['name']}': widget control {i+1} missing 'widget_type' field"
                            )

                        # Validate widget type exists
                        self._validate_widget_types([widget_type], slot["name"])

                        # Validate optional fields (accept both cases)
                        max_instances = widget_control.get(
                            "max_instances"
                        ) or widget_control.get("maxInstances")
                        if max_instances is not None:
                            if not isinstance(max_instances, int) or max_instances < 0:
                                raise ValidationError(
                                    f"Slot '{slot['name']}': widget control {i+1} max_instances must be a positive integer or null"
                                )

                        required = widget_control.get("required")
                        if required is not None and not isinstance(required, bool):
                            raise ValidationError(
                                f"Slot '{slot['name']}': widget control {i+1} required must be a boolean"
                            )

                        pre_create = widget_control.get(
                            "pre_create"
                        ) or widget_control.get("preCreate")
                        if pre_create is not None and not isinstance(pre_create, bool):
                            raise ValidationError(
                                f"Slot '{slot['name']}': widget control {i+1} pre_create must be a boolean"
                            )

                        default_config = widget_control.get(
                            "default_config"
                        ) or widget_control.get("defaultConfig")
                        if default_config is not None and not isinstance(
                            default_config, dict
                        ):
                            raise ValidationError(
                                f"Slot '{slot['name']}': widget control {i+1} default_config must be an object"
                            )

                if "maxWidgets" in slot and slot["maxWidgets"] is not None:
                    if (
                        not isinstance(slot["maxWidgets"], int)
                        or slot["maxWidgets"] < 0
                    ):
                        raise ValidationError(
                            f"Slot '{slot['name']}': maxWidgets must be a positive integer or null"
                        )

                # Validate allowed_types (accept both camelCase and snake_case)
                allowed_types = slot.get("allowed_types") or slot.get("allowedTypes")
                if allowed_types is not None:
                    if not isinstance(allowed_types, list):
                        raise ValidationError(
                            f"Slot '{slot['name']}': allowed_types must be an array"
                        )
                    # Validate widget types exist
                    self._validate_widget_types(allowed_types, slot["name"])

                # Validate disallowed_types (accept both camelCase and snake_case)
                disallowed_types = slot.get("disallowed_types") or slot.get("disallowedTypes")
                if disallowed_types is not None:
                    if not isinstance(disallowed_types, list):
                        raise ValidationError(
                            f"Slot '{slot['name']}': disallowed_types must be an array"
                        )
                    # Validate widget types exist
                    self._validate_widget_types(disallowed_types, slot["name"])

                if "preCreatedWidgets" in slot:
                    if not isinstance(slot["preCreatedWidgets"], list):
                        raise ValidationError(
                            f"Slot '{slot['name']}': preCreatedWidgets must be an array"
                        )

                    for widget in slot["preCreatedWidgets"]:
                        if not isinstance(widget, dict):
                            raise ValidationError(
                                f"Slot '{slot['name']}': each pre-created widget must be an object"
                            )

                        if "type" not in widget:
                            raise ValidationError(
                                f"Slot '{slot['name']}': pre-created widget missing 'type' field"
                            )

    def _validate_widget_types(self, widget_types, slot_name):
        """Validate that widget types exist in the registry."""
        from webpages.widget_registry import widget_type_registry

        available_widgets = {
            widget.type for widget in widget_type_registry.list_widget_types()
        }

        for widget_type in widget_types:
            if widget_type not in available_widgets:
                raise ValidationError(
                    f"Slot '{slot_name}': widget type '{widget_type}' not found in registry. "
                    f"Available types: {', '.join(sorted(available_widgets))}"
                )

    def get_schema_fields(self):
        """Return the list of schema fields for this object type."""
        # Convert properties object to fields array for backward compatibility
        properties = self.schema.get("properties", {})
        required = self.schema.get("required", [])
        property_order = self.schema.get("propertyOrder", [])

        fields = []

        # Use propertyOrder if available, otherwise use object keys
        keys_to_process = property_order if property_order else list(properties.keys())

        for prop_name in keys_to_process:
            if prop_name in properties:
                field = {
                    "name": prop_name,
                    "required": prop_name in required,
                    **properties[prop_name],
                }
                fields.append(field)

        return fields

    def get_slots(self):
        """Return the list of widget slots for this object type."""
        return self.slot_configuration.get("slots", [])

    def get_allowed_widgets_for_slot(self, slot_name):
        """Get the list of allowed widget types for a specific slot."""
        from webpages.widget_registry import widget_type_registry

        slots = self.get_slots()
        slot = next((s for s in slots if s["name"] == slot_name), None)

        if not slot:
            return []

        all_widgets = widget_type_registry.list_widget_types()

        # New format: use widgetControls
        if "widgetControls" in slot:
            allowed_slugs = {
                control["widgetType"] for control in slot["widgetControls"]
            }
            return [w for w in all_widgets if w.slug in allowed_slugs]

        # Otherwise, all widgets are allowed
        return all_widgets

    def get_widget_controls_for_slot(self, slot_name):
        """Get the widget control definitions for a specific slot."""
        slots = self.get_slots()
        slot = next((s for s in slots if s["name"] == slot_name), None)

        if not slot:
            return []

        return slot.get("widgetControls", [])

    def get_slot_configuration(self, slot_name):
        """Get the full configuration for a specific slot."""
        slots = self.get_slots()
        return next((s for s in slots if s["name"] == slot_name), None)

    def can_have_child_type(self, child_type):
        """Check if the given object type can be a child of this type."""
        return child_type in self.allowed_child_types.all()

    def to_dict(self):
        """Convert to dictionary for API serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "label": self.label,
            "plural_label": self.plural_label,
            "description": self.description,
            "icon_image": self.icon_image.url if self.icon_image else None,
            "schema": self.schema,
            "slot_configuration": self.slot_configuration,
            "allowed_child_types": [
                child.name for child in self.allowed_child_types.all()
            ],
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "metadata": self.metadata,
        }


class PublishedObjectManager(models.Manager):
    """
    Custom manager for ObjectInstance that provides methods for working with published versions.
    """

    def with_published_versions(self, now=None):
        """
        Annotate queryset with published version data.

        Returns queryset annotated with:
        - is_featured: boolean from current_version.is_featured
        """
        if now is None:
            now = timezone.now()

        from django.db.models import F, Exists, OuterRef, Subquery

        # Subquery to get published version for each object
        published_versions = (
            ObjectVersion.objects.filter(
                object_instance=OuterRef("pk"), effective_date__lte=now
            )
            .filter(models.Q(expiry_date__isnull=True) | models.Q(expiry_date__gt=now))
            .order_by("-version_number")
        )

        return self.get_queryset().annotate(
            is_featured=F("current_version__is_featured"),
            has_published_version=Exists(published_versions),
        )

    def published_only(self, now=None):
        """
        Filter to only objects with currently published versions.

        Returns queryset containing only objects that have a published version.
        """
        if now is None:
            now = timezone.now()

        from django.db.models import Exists, OuterRef

        # Subquery to check if object has a published version
        published_versions = ObjectVersion.objects.filter(
            object_instance=OuterRef("pk"), effective_date__lte=now
        ).filter(models.Q(expiry_date__isnull=True) | models.Q(expiry_date__gt=now))

        return self.get_queryset().filter(
            Exists(published_versions), current_version__isnull=False
        )

    def with_featured_first(self):
        """
        Order by featured status (featured first).

        Uses the is_featured field from current_version.
        """
        return self.get_queryset().order_by("-current_version__is_featured")


class ObjectInstance(MPTTModel):
    """
    Actual instances of objects based on their type definitions.
    Contains dynamic data according to the object type's schema.
    Uses MPTT for efficient tree structure management.

    RENDERING PATTERN FOR PUBLISHED OBJECTS:
    ========================================

    This system uses DATE-BASED PUBLISHING with version control. When rendering objects
    (e.g., in widgets, templates, views), ALWAYS use this pattern:

    Step 1: Query for the ObjectInstance
    ------------------------------------
    obj = (
        ObjectInstance.objects
        .filter(slug='my-news')
        .select_related('object_type')
        .first()
    )
    if not obj:
        return None

    Step 2: Get the currently published version
    -------------------------------------------
    published_version = obj.get_current_published_version()
    if not published_version:
        # Object exists but has no published version (draft, scheduled, or expired)
        return None

    Step 3: Access fields from the correct model
    --------------------------------------------
    # Object metadata (from ObjectInstance):
    title = obj.title
    slug = obj.slug
    object_type = obj.object_type
    created_at = obj.created_at

    # Version-specific content (from ObjectVersion):
    content = published_version.data.get('content')
    featured_image = published_version.data.get('featured_image')
    widgets = published_version.widgets
    publish_date = published_version.effective_date
    is_featured = published_version.is_featured

    COMPLETE EXAMPLE - Widget Rendering:
    ====================================

    def _get_news_object(self, slug, object_type_ids):
        from object_storage.models import ObjectInstance

        # Step 1: Get the object
        obj = (
            ObjectInstance.objects
            .filter(slug=slug, object_type_id__in=object_type_ids)
            .select_related('object_type')
            .first()
        )
        if not obj:
            return None, None

        # Step 2: Get published version
        published_version = obj.get_current_published_version()
        if not published_version:
            return None, None

        # Step 3: Return both for rendering
        return obj, published_version

    # Then in template context:
    obj, published_version = self._get_news_object(slug, types)
    if obj and published_version:
        context = {
            'title': obj.title,
            'slug': obj.slug,
            'content': published_version.data.get('content'),
            'publish_date': published_version.effective_date,
            'is_featured': published_version.is_featured,
        }

    CRITICAL - What NOT to do:
    ==========================

    ❌ DO NOT use obj.current_version for rendering
       Reason: It may point to a draft or scheduled version

    ❌ DO NOT filter by status="published"
       Reason: Status field is not date-aware, use get_current_published_version()

    ❌ DO NOT use obj.data or obj.widgets directly for rendering published content
       Reason: These are convenience properties that return current_version data,
       which may be a draft. Use published_version.data and published_version.widgets

    ✅ DO use get_current_published_version() - it checks effective_date and expiry_date
    ✅ DO return both obj and published_version (not merged data)
    ✅ DO use select_related('object_type') for performance

    WHY THIS PATTERN:
    =================

    - Date-based publishing: Versions have effective_date and expiry_date
    - Multiple versions: An object can have draft, scheduled, and expired versions
    - Separation of concerns: Object metadata vs version content
    - Performance: Explicit queries, no hidden N+1 problems
    - Type safety: Work with models, not dictionaries
    - Consistency: Same pattern used in API (see object_storage/views.py)
    """

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("published", "Published"),
        ("archived", "Archived"),
    ]

    object_type = models.ForeignKey(
        ObjectTypeDefinition,
        on_delete=models.CASCADE,
        help_text="The type definition this object follows",
    )
    title = models.CharField(max_length=300, help_text="Display title for this object")
    slug = models.SlugField(
        max_length=300, help_text="URL-friendly identifier, unique within object type"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
        help_text="Publication status of this object",
    )
    parent = TreeForeignKey(
        "self",
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="children",
        help_text="Parent object for hierarchical relationships",
    )
    current_version = models.ForeignKey(
        "ObjectVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="current_for_objects",
        help_text="The currently active version of this object",
    )
    publish_date = models.DateTimeField(
        blank=True, null=True, help_text="When this object should be published"
    )
    unpublish_date = models.DateTimeField(
        blank=True, null=True, help_text="When this object should be unpublished"
    )
    version = models.PositiveIntegerField(default=1, help_text="Current version number")
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="created_objects"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    metadata = models.JSONField(
        default=dict, help_text="Additional extensible properties for this object"
    )
    relationships = models.JSONField(
        default=list,
        blank=True,
        help_text="Many-to-many relationships to other objects with relationship types",
    )
    related_from = models.JSONField(
        default=list,
        blank=True,
        help_text="Reverse relationships (auto-maintained mirror of relationships field)",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["object_type", "status"]),
            models.Index(fields=["slug", "object_type"]),
            models.Index(fields=["status", "publish_date"]),
            models.Index(fields=["parent"]),
            models.Index(fields=["current_version"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["slug", "object_type"], name="unique_slug_per_object_type"
            )
        ]

    class MPTTMeta:
        order_insertion_by = ["title"]

    # Custom managers
    objects = models.Manager()  # Default manager
    published = PublishedObjectManager()  # Manager for published objects

    def __str__(self):
        return f"{self.object_type.label}: {self.title}"

    @property
    def data(self):
        """Get data from current version"""
        if self.current_version:
            return self.current_version.data
        return {}

    @property
    def widgets(self):
        """Get widgets from current version"""
        if self.current_version:
            return self.current_version.widgets
        return {}

    def save(self, *args, **kwargs):
        """Override save to handle slug generation and validation."""
        is_new = not self.pk

        if not self.slug:
            self.slug = slugify(self.title)

        # Ensure slug is unique within the object type
        if is_new:  # New object
            from django.db import transaction

            with transaction.atomic():
                original_slug = self.slug
                counter = 1
                while (
                    ObjectInstance.objects.select_for_update()
                    .filter(object_type=self.object_type, slug=self.slug)
                    .exists()
                ):
                    self.slug = f"{original_slug}-{counter}"
                    counter += 1

        super().save(*args, **kwargs)

        # Create pre-defined widgets for new objects
        if is_new:
            self._create_pre_defined_widgets()

    def clean(self):
        """Validate the object instance."""
        super().clean()

        # Validate parent-child relationship
        if self.parent:
            self._validate_parent_child_relationship()

        # Validate current version data if it exists
        if self.current_version:
            if self.object_type_id and self.current_version.data:
                self._validate_data_against_schema()
            if self.object_type_id and self.current_version.widgets:
                self._validate_widgets_against_slots()

    def _validate_data_against_schema(self):
        """Validate the object data against its type's schema."""
        schema_fields = self.object_type.get_schema_fields()
        version_data = self.current_version.data if self.current_version else {}

        for field_def in schema_fields:
            field_name = field_def["name"]
            field_required = field_def.get("required", False)

            if field_required and (
                field_name not in version_data or not version_data[field_name]
            ):
                raise ValidationError(
                    f"Required field '{field_name}' is missing or empty"
                )

    def _validate_parent_child_relationship(self):
        """Validate that the parent-child relationship is allowed."""
        if not self.parent.object_type.can_have_child_type(self.object_type):
            raise ValidationError(
                f"Object type '{self.object_type.name}' cannot be a child of "
                f"'{self.parent.object_type.name}'"
            )

    def _create_pre_defined_widgets(self):
        """Create pre-defined widgets for new object instances."""
        from webpages.widget_registry import widget_type_registry
        from django.utils import timezone
        import uuid

        slots = self.object_type.get_slots()
        pre_widgets = {}

        for slot in slots:
            slot_name = slot.get("name")
            slot_widgets = []

            # New format: use widgetControls
            if "widgetControls" in slot:
                for widget_control in slot["widgetControls"]:
                    if not widget_control.get("preCreate", False):
                        continue

                    widget_type = widget_control.get("widgetType")
                    if not widget_type:
                        continue

                    # Get widget type from registry (supports multiple formats for compatibility)
                    widget_instance = widget_type_registry.get_widget_type_flexible(
                        widget_type
                    )
                    if not widget_instance:
                        continue

                    # Merge default configuration with widget control defaults
                    default_config = widget_instance.get_configuration_defaults()
                    custom_config = widget_control.get("defaultConfig", {})
                    merged_config = {**default_config, **custom_config}

                    # Create widget with merged configuration
                    widget_data = {
                        "id": str(uuid.uuid4()),
                        "type": widget_instance.type,
                        "config": merged_config,
                        "order": len(slot_widgets),
                        "created_at": timezone.now().isoformat(),
                        "control_id": widget_control.get("id", str(uuid.uuid4())),
                    }

                    slot_widgets.append(widget_data)

            # Legacy format: use preCreatedWidgets
            elif "preCreatedWidgets" in slot:
                pre_created_widgets = slot.get("preCreatedWidgets", [])

                for pre_widget_config in pre_created_widgets:
                    widget_type = pre_widget_config.get("type")
                    if not widget_type:
                        continue

                    # Get widget type from registry (supports multiple formats for compatibility)
                    widget_instance = widget_type_registry.get_widget_type_flexible(
                        widget_type
                    )
                    if not widget_instance:
                        continue

                    # Create widget with default configuration
                    widget_data = {
                        "id": str(uuid.uuid4()),
                        "type": widget_instance.type,
                        "config": widget_instance.get_configuration_defaults(),
                        "order": len(slot_widgets),
                        "created_at": timezone.now().isoformat(),
                    }

                    slot_widgets.append(widget_data)

            if slot_widgets:
                pre_widgets[slot_name] = slot_widgets

        # Create initial version with pre-defined widgets if any exist
        if pre_widgets:
            self._create_initial_version_with_widgets(pre_widgets)

    def _create_initial_version_with_widgets(self, widgets_data):
        """Create the initial version with pre-defined widgets."""
        from django.utils import timezone

        # Create initial version
        version = ObjectVersion.objects.create(
            object_instance=self,
            version_number=1,
            data=self.data or {},
            widgets=widgets_data,
            created_by=self.created_by,
            created_at=timezone.now(),
            comment="Initial version with pre-defined widgets",
        )

        # Set as current version
        self.current_version = version
        # Use update to avoid triggering save() again
        ObjectInstance.objects.filter(pk=self.pk).update(current_version=version)

    def _validate_widgets_against_slots(self):
        """Validate and normalize widgets against the object type's slot configuration.

        This method:
        1. Keeps extra slot information even if not in the object type definition
        2. Creates missing slots with empty content if defined in the object type
        3. Does not raise errors for missing or extra slots, just normalizes them
        """
        if not self.current_version:
            return

        defined_slots = [slot["name"] for slot in self.object_type.get_slots()]
        version_widgets = self.current_version.widgets

        # Ensure all defined slots exist in widgets (create empty ones if missing)
        for slot_name in defined_slots:
            if slot_name not in version_widgets:
                version_widgets[slot_name] = []  # Create empty slot

        # Note: We intentionally keep extra slots that aren't in the definition
        # This allows for flexibility and prevents data loss when object type
        # definitions change

    def is_published(self, now=None):
        """
        Check if this object should be visible to the public.

        NEW: Object is published if it has a currently published version (date-based).
        """
        current_version = self.get_current_published_version(now)
        return current_version is not None

    def get_current_published_version(self, now=None):
        """
        Get the currently published version using date-based logic.

        THIS IS THE PRIMARY METHOD for getting published content for rendering.

        Returns the latest version (by version_number) that meets ALL criteria:
        - effective_date <= now (already published)
        - expiry_date is None OR expiry_date > now (not expired)

        Args:
            now: Timestamp for publication check (default: timezone.now())

        Returns:
            ObjectVersion instance if a version is currently published
            None if no version meets the publication criteria

        Example:
            obj = ObjectInstance.objects.get(slug='my-article')
            published = obj.get_current_published_version()
            if published:
                content = published.data.get('content')
                widgets = published.widgets
                publish_date = published.effective_date
        """
        if now is None:
            now = timezone.now()

        return (
            self.versions.filter(effective_date__lte=now)
            .filter(models.Q(expiry_date__isnull=True) | models.Q(expiry_date__gt=now))
            .order_by("-version_number")
            .first()
        )

    def get_latest_version(self):
        """Get the latest version of this object (regardless of publication status)"""
        return self.versions.order_by("-version_number").first()

    def has_newer_versions(self):
        """Check if there are versions newer than the current published version"""
        current = self.get_current_published_version()
        if not current:
            return self.versions.exists()

        return self.versions.filter(version_number__gt=current.version_number).exists()

    def get_root_objects(self):
        """Get all root objects (objects without parents) of the same type."""
        return ObjectInstance.objects.filter(
            object_type=self.object_type, parent__isnull=True
        )

    def get_tree_objects(self):
        """Get all objects in the same tree."""
        if self.tree_id:
            return ObjectInstance.objects.filter(tree_id=self.tree_id)
        return ObjectInstance.objects.filter(pk=self.pk)

    def get_path_to_root(self):
        """Get the path from this object to the root."""
        return self.get_ancestors(include_self=True).reverse()

    def can_move_to_parent(self, new_parent):
        """Check if this object can be moved to a new parent."""
        if not new_parent:
            return True

        # Check if new parent allows this object type as child
        if not new_parent.object_type.can_have_child_type(self.object_type):
            return False

        # Prevent moving to own descendant (would create circular reference)
        if new_parent in self.get_descendants(include_self=True):
            return False

        return True

    def create_version(self, user, data=None, widgets=None, change_description=""):
        """Create a new version of this object with the provided data and widgets.

        Args:
            user: User creating the version
            data: Object data for this version
            widgets: Widget configuration for this version
            change_description: Description of changes
        """
        # Find the next available version number
        max_version = (
            self.versions.aggregate(max_version=models.Max("version_number"))[
                "max_version"
            ]
            or 0
        )
        next_version = max_version + 1

        # Use provided data/widgets or copy from current version
        version_data = (
            data
            if data is not None
            else (self.data.copy() if self.current_version else {})
        )
        version_widgets = (
            widgets
            if widgets is not None
            else (self.widgets.copy() if self.current_version else {})
        )

        # Create the new version
        new_version = ObjectVersion.objects.create(
            object_instance=self,
            version_number=next_version,
            data=version_data,
            widgets=version_widgets,
            created_by=user,
            change_description=change_description,
        )

        # Update current version pointer and version counter
        self.current_version = new_version
        self.version = next_version
        self.save(update_fields=["current_version", "version"])

        return new_version

    def update_current_version(
        self, user, data=None, widgets=None, change_description=""
    ):
        """Update the current version with new data and widgets (doesn't create new version).

        Args:
            user: User making the update
            data: New object data (if None, keeps current data)
            widgets: New widget configuration (if None, keeps current widgets)
            change_description: Description of changes
        """
        if not self.current_version:
            # No current version exists, create one
            return self.create_version(
                user, data=data, widgets=widgets, change_description=change_description
            )

        # Update the existing current version
        if data is not None:
            self.current_version.data = data
        if widgets is not None:
            self.current_version.widgets = widgets
        if change_description:
            self.current_version.change_description = change_description

        self.current_version.save()
        return self.current_version

    def to_dict(self):
        """Convert to dictionary for API serialization."""
        return {
            "id": self.id,
            "object_type": self.object_type.to_dict(),
            "title": self.title,
            "slug": self.slug,
            "data": self.data,
            "status": self.status,
            "parent": self.parent.id if self.parent else None,
            "level": self.level,
            "tree_id": self.tree_id,
            "widgets": self.widgets,
            "publish_date": self.publish_date,
            "unpublish_date": self.unpublish_date,
            "version": self.version,
            "created_by": self.created_by.username,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "metadata": self.metadata,
            "is_published": self.is_published(),
        }

    @classmethod
    def get_published_objects(
        cls,
        object_type_ids=None,
        limit=None,
        sort_order="-created_at",
        now=None,
        prioritize_featured=False,
    ):
        """
        Get published objects with flexible filtering and sorting.

        Args:
            object_type_ids: List of object type IDs to filter by (optional)
            limit: Maximum number of results to return (optional)
            sort_order: Field to sort by (default: "-created_at")
                       Note: "publish_date" will be mapped to "current_version__effective_date"
            now: Timestamp to use for publication checks (default: timezone.now())
            prioritize_featured: If True, sort featured items first (default: False)

        Returns:
            QuerySet of ObjectInstance with published versions pre-loaded
        """
        if now is None:
            now = timezone.now()

        from django.db.models import F

        # Start with published objects only
        queryset = cls.published.published_only(now).select_related(
            "object_type", "current_version"
        )

        # Filter by object types if specified
        if object_type_ids:
            queryset = queryset.filter(object_type_id__in=object_type_ids)

        # Annotate with featured status if needed
        if prioritize_featured:
            queryset = queryset.annotate(is_featured=F("current_version__is_featured"))

        # Map publish_date to actual field
        sort_field = sort_order
        if "publish_date" in sort_order:
            sort_field = sort_order.replace(
                "publish_date", "current_version__effective_date"
            )

        # Apply sorting
        if prioritize_featured:
            queryset = queryset.order_by("-is_featured", sort_field)
        else:
            queryset = queryset.order_by(sort_field)

        # Apply limit if specified
        if limit:
            queryset = queryset[:limit]

        return queryset

    # ============================================================================
    # MANY-TO-MANY RELATIONSHIP METHODS
    # ============================================================================

    def add_relationship(self, relationship_type, object_id):
        """
        Add a many-to-many relationship to another ObjectInstance.

        Args:
            relationship_type: String identifying the relationship type (e.g., 'authors', 'translators')
            object_id: Primary key of the related ObjectInstance

        Returns:
            bool: True if relationship was added, False if it already existed

        Raises:
            ValueError: If trying to relate to self or if target object doesn't exist
        """
        # Prevent self-references
        if object_id == self.id:
            raise ValueError("Cannot create relationship to self")

        # Check if target object exists
        if not ObjectInstance.objects.filter(id=object_id).exists():
            raise ValueError(f"ObjectInstance with id {object_id} does not exist")

        # Initialize relationships if None
        if self.relationships is None:
            self.relationships = []

        # Check for duplicate
        relationship_obj = {"type": relationship_type, "object_id": object_id}
        if any(
            r.get("type") == relationship_type and r.get("object_id") == object_id
            for r in self.relationships
        ):
            return False

        # Add relationship
        self.relationships.append(relationship_obj)
        self.save(update_fields=["relationships"])

        # Update reverse relationship
        self._update_reverse_relationship("add", relationship_type, object_id)

        return True

    def remove_relationship(self, relationship_type, object_id):
        """
        Remove a specific relationship.

        Args:
            relationship_type: String identifying the relationship type
            object_id: Primary key of the related ObjectInstance

        Returns:
            bool: True if relationship was removed, False if it didn't exist
        """
        if not self.relationships:
            return False

        # Find and remove the relationship
        original_length = len(self.relationships)
        self.relationships = [
            r
            for r in self.relationships
            if not (
                r.get("type") == relationship_type and r.get("object_id") == object_id
            )
        ]

        if len(self.relationships) < original_length:
            self.save(update_fields=["relationships"])
            # Update reverse relationship
            self._update_reverse_relationship("remove", relationship_type, object_id)
            return True

        return False

    def clear_relationships(self, relationship_type=None):
        """
        Clear relationships. If relationship_type is specified, only clear that type.

        Args:
            relationship_type: Optional type to clear. If None, clears all relationships.
        """
        if not self.relationships:
            return

        # Store relationships to clear for reverse update
        to_clear = []

        if relationship_type:
            # Clear specific type
            to_clear = [
                r for r in self.relationships if r.get("type") == relationship_type
            ]
            self.relationships = [
                r for r in self.relationships if r.get("type") != relationship_type
            ]
        else:
            # Clear all
            to_clear = list(self.relationships)
            self.relationships = []

        self.save(update_fields=["relationships"])

        # Update reverse relationships
        for rel in to_clear:
            self._update_reverse_relationship(
                "remove", rel.get("type"), rel.get("object_id")
            )

    def set_relationships(self, relationship_type, object_ids):
        """
        Replace all relationships of a specific type with a new list.

        Args:
            relationship_type: String identifying the relationship type
            object_ids: List of object IDs to set as the new relationships

        Raises:
            ValueError: If any object_id doesn't exist or is self-referential
        """
        # Validate all object IDs exist
        for obj_id in object_ids:
            if obj_id == self.id:
                raise ValueError("Cannot create relationship to self")
            if not ObjectInstance.objects.filter(id=obj_id).exists():
                raise ValueError(f"ObjectInstance with id {obj_id} does not exist")

        # Get current relationships of this type
        if self.relationships is None:
            self.relationships = []

        current = [r for r in self.relationships if r.get("type") == relationship_type]
        current_ids = {r.get("object_id") for r in current}
        new_ids = set(object_ids)

        # Find relationships to remove and add
        to_remove = current_ids - new_ids
        to_add = new_ids - current_ids

        # Remove old relationships
        self.relationships = [
            r for r in self.relationships if r.get("type") != relationship_type
        ]

        # Add new relationships
        for obj_id in object_ids:
            self.relationships.append({"type": relationship_type, "object_id": obj_id})

        self.save(update_fields=["relationships"])

        # Update reverse relationships
        for obj_id in to_remove:
            self._update_reverse_relationship("remove", relationship_type, obj_id)
        for obj_id in to_add:
            self._update_reverse_relationship("add", relationship_type, obj_id)

    def reorder_relationships(self, relationship_type, object_ids_in_order):
        """
        Reorder relationships of a specific type.

        Args:
            relationship_type: String identifying the relationship type
            object_ids_in_order: List of object IDs in the desired order

        Raises:
            ValueError: If object_ids don't match existing relationships
        """
        if self.relationships is None:
            self.relationships = []

        # Get current relationships of this type
        current = [r for r in self.relationships if r.get("type") == relationship_type]
        current_ids = {r.get("object_id") for r in current}

        # Verify the IDs match
        if set(object_ids_in_order) != current_ids:
            raise ValueError(
                "Provided object IDs must exactly match existing relationships"
            )

        # Remove old relationships of this type
        self.relationships = [
            r for r in self.relationships if r.get("type") != relationship_type
        ]

        # Add them back in the new order
        for obj_id in object_ids_in_order:
            self.relationships.append({"type": relationship_type, "object_id": obj_id})

        self.save(update_fields=["relationships"])

    def get_related_objects(self, relationship_type=None, as_queryset=True):
        """
        Get related objects, optionally filtered by relationship type.

        Args:
            relationship_type: Optional type to filter by
            as_queryset: If True, return QuerySet; if False, return list of dicts with type info

        Returns:
            QuerySet of ObjectInstance or list of dicts (depending on as_queryset)
        """
        if not self.relationships:
            return ObjectInstance.objects.none() if as_queryset else []

        # Filter by type if specified
        if relationship_type:
            rels = [r for r in self.relationships if r.get("type") == relationship_type]
        else:
            rels = self.relationships

        if not rels:
            return ObjectInstance.objects.none() if as_queryset else []

        if as_queryset:
            # Return queryset preserving order
            object_ids = [r.get("object_id") for r in rels]
            # Use Django's preserve order with case
            preserved = Case(
                *[When(pk=pk, then=pos) for pos, pk in enumerate(object_ids)]
            )
            return ObjectInstance.objects.filter(id__in=object_ids).order_by(preserved)
        else:
            # Return list with relationship type info
            return [
                {
                    "type": r.get("type"),
                    "object_id": r.get("object_id"),
                    "object": ObjectInstance.objects.filter(
                        id=r.get("object_id")
                    ).first(),
                }
                for r in rels
            ]

    def get_related_from_objects(self, relationship_type=None, as_queryset=True):
        """
        Get objects that have relationships TO this object (reverse relationships).

        Args:
            relationship_type: Optional type to filter by
            as_queryset: If True, return QuerySet; if False, return list of dicts with type info

        Returns:
            QuerySet of ObjectInstance or list of dicts (depending on as_queryset)
        """
        if not self.related_from:
            return ObjectInstance.objects.none() if as_queryset else []

        # Filter by type if specified
        if relationship_type:
            rels = [r for r in self.related_from if r.get("type") == relationship_type]
        else:
            rels = self.related_from

        if not rels:
            return ObjectInstance.objects.none() if as_queryset else []

        if as_queryset:
            # Return queryset preserving order
            object_ids = [r.get("object_id") for r in rels]
            preserved = Case(
                *[When(pk=pk, then=pos) for pos, pk in enumerate(object_ids)]
            )
            return ObjectInstance.objects.filter(id__in=object_ids).order_by(preserved)
        else:
            # Return list with relationship type info
            return [
                {
                    "type": r.get("type"),
                    "object_id": r.get("object_id"),
                    "object": ObjectInstance.objects.filter(
                        id=r.get("object_id")
                    ).first(),
                }
                for r in rels
            ]

    def has_relationship(self, relationship_type, object_id):
        """
        Check if a specific relationship exists.

        Args:
            relationship_type: String identifying the relationship type
            object_id: Primary key of the related ObjectInstance

        Returns:
            bool: True if relationship exists
        """
        if not self.relationships:
            return False
        return any(
            r.get("type") == relationship_type and r.get("object_id") == object_id
            for r in self.relationships
        )

    def get_relationship_types(self):
        """
        Get all unique relationship types used by this object.

        Returns:
            set: Set of relationship type strings
        """
        if not self.relationships:
            return set()
        return {r.get("type") for r in self.relationships if r.get("type")}

    def count_relationships(self, relationship_type=None):
        """
        Count relationships, optionally filtered by type.

        Args:
            relationship_type: Optional type to filter by

        Returns:
            int: Number of relationships
        """
        if not self.relationships:
            return 0

        if relationship_type:
            return sum(
                1 for r in self.relationships if r.get("type") == relationship_type
            )
        return len(self.relationships)

    def _update_reverse_relationship(self, action, relationship_type, object_id):
        """
        Internal method to maintain bidirectional sync of relationships.
        Updates the related_from field on the target object.

        Args:
            action: 'add' or 'remove'
            relationship_type: String identifying the relationship type
            object_id: Primary key of the related ObjectInstance
        """
        try:
            target = ObjectInstance.objects.get(id=object_id)
        except ObjectInstance.DoesNotExist:
            return

        if target.related_from is None:
            target.related_from = []

        reverse_rel = {"type": relationship_type, "object_id": self.id}

        if action == "add":
            # Add reverse relationship if not already present
            if not any(
                r.get("type") == relationship_type and r.get("object_id") == self.id
                for r in target.related_from
            ):
                target.related_from.append(reverse_rel)
                target.save(update_fields=["related_from"])
        elif action == "remove":
            # Remove reverse relationship
            original_length = len(target.related_from)
            target.related_from = [
                r
                for r in target.related_from
                if not (
                    r.get("type") == relationship_type and r.get("object_id") == self.id
                )
            ]
            if len(target.related_from) < original_length:
                target.save(update_fields=["related_from"])

    def rebuild_related_from(self):
        """
        Rebuild this instance's related_from field by scanning all other objects.
        Useful for repairing broken reverse relationships.

        Returns:
            int: Number of reverse relationships found and restored
        """
        # Find all objects that reference this object in their relationships
        self.related_from = []

        # Query all objects that might have relationships to this object
        all_objects = ObjectInstance.objects.exclude(id=self.id).exclude(
            relationships=[]
        )

        for obj in all_objects:
            if obj.relationships:
                for rel in obj.relationships:
                    if rel.get("object_id") == self.id:
                        reverse_rel = {"type": rel.get("type"), "object_id": obj.id}
                        if reverse_rel not in self.related_from:
                            self.related_from.append(reverse_rel)

        self.save(update_fields=["related_from"])
        return len(self.related_from)

    @classmethod
    def rebuild_all_related_from(cls):
        """
        Rebuild related_from fields for all ObjectInstance objects.
        Useful for bulk repair of broken reverse relationships.

        Returns:
            dict: Statistics about the rebuild operation
        """
        total_objects = cls.objects.count()
        total_relationships = 0

        # Clear all related_from fields first
        cls.objects.update(related_from=[])

        # Process each object and rebuild its reverse relationships
        for obj in cls.objects.exclude(relationships=[]):
            if obj.relationships:
                for rel in obj.relationships:
                    target_id = rel.get("object_id")
                    rel_type = rel.get("type")

                    if target_id and rel_type:
                        try:
                            target = cls.objects.get(id=target_id)
                            if target.related_from is None:
                                target.related_from = []

                            reverse_rel = {"type": rel_type, "object_id": obj.id}
                            if reverse_rel not in target.related_from:
                                target.related_from.append(reverse_rel)
                                target.save(update_fields=["related_from"])
                                total_relationships += 1
                        except cls.DoesNotExist:
                            pass  # Skip if target doesn't exist

        return {
            "total_objects": total_objects,
            "total_relationships_restored": total_relationships,
        }

    def delete(self, *args, **kwargs):
        """
        Override delete to clean up bidirectional relationships.
        """
        # Clean up forward relationships (remove from related_from of targets)
        if self.relationships:
            for rel in self.relationships:
                try:
                    target = ObjectInstance.objects.get(id=rel.get("object_id"))
                    if target.related_from:
                        target.related_from = [
                            r
                            for r in target.related_from
                            if r.get("object_id") != self.id
                        ]
                        target.save(update_fields=["related_from"])
                except ObjectInstance.DoesNotExist:
                    pass

        # Clean up reverse relationships (remove from relationships of sources)
        if self.related_from:
            for rel in self.related_from:
                try:
                    source = ObjectInstance.objects.get(id=rel.get("object_id"))
                    if source.relationships:
                        source.relationships = [
                            r
                            for r in source.relationships
                            if r.get("object_id") != self.id
                        ]
                        source.save(update_fields=["relationships"])
                except ObjectInstance.DoesNotExist:
                    pass

        # Call parent delete
        return super().delete(*args, **kwargs)


class ObjectVersion(models.Model):
    """
    Version history for object instances.
    Stores snapshots of object data and widgets at specific points in time.
    """

    object_instance = models.ForeignKey(
        ObjectInstance, on_delete=models.CASCADE, related_name="versions"
    )
    version_number = models.PositiveIntegerField()
    data = models.JSONField(help_text="Snapshot of object data at this version")
    widgets = models.JSONField(
        help_text="Snapshot of widget configurations at this version"
    )
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    change_description = models.TextField(
        blank=True, help_text="Description of changes made in this version"
    )

    # Publication date fields - similar to PageVersion
    effective_date = models.DateTimeField(
        blank=True, null=True, help_text="When this version becomes active/published"
    )
    expiry_date = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When this version expires (null means never expires)",
    )

    # Featured status
    is_featured = models.BooleanField(
        default=False, help_text="Mark this version as featured/pinned in listings"
    )

    class Meta:
        ordering = ["-version_number"]
        indexes = [
            models.Index(fields=["object_instance", "version_number"]),
            models.Index(fields=["created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["object_instance", "version_number"],
                name="unique_version_per_object",
            )
        ]

    def __str__(self):
        return f"{self.object_instance.title} v{self.version_number}"

    def clean(self):
        """Validate the version data"""
        super().clean()

        # Validate that effective_date is before expiry_date
        if (
            self.effective_date
            and self.expiry_date
            and self.effective_date >= self.expiry_date
        ):
            from django.core.exceptions import ValidationError

            raise ValidationError("Effective date must be before expiry date.")

    def is_published(self, now=None):
        """
        Check if this version is currently published based on dates.

        A version is published if:
        - It has an effective_date that has passed
        - It either has no expiry_date or the expiry_date hasn't passed
        """
        if now is None:
            now = timezone.now()

        # Must have an effective date that has passed
        if not self.effective_date or self.effective_date > now:
            return False

        # Must not be expired
        if self.expiry_date and self.expiry_date <= now:
            return False

        return True

    def is_current_published(self, now=None):
        """
        Check if this is the current published version for its object.

        The current published version is the latest published version by version_number.
        """
        if not self.is_published(now):
            return False

        current_version = self.object_instance.get_current_published_version(now)
        return current_version == self

    def get_publication_status(self, now=None):
        """
        Get a human-readable publication status based on dates.

        Returns: 'draft', 'scheduled', 'published', 'expired'
        """
        if now is None:
            now = timezone.now()

        if not self.effective_date:
            return "draft"

        if self.effective_date > now:
            return "scheduled"

        if self.expiry_date and self.expiry_date <= now:
            return "expired"

        return "published"

    def sync_relationships_from_data(self):
        """
        Sync object_reference fields in data to ObjectInstance.relationships.
        Called automatically on save.

        This method:
        1. Finds all object_reference fields in the schema
        2. Extracts values from self.data
        3. Updates ObjectInstance.relationships accordingly
        """
        from utils.schema_system import field_registry

        # Get schema fields
        schema_fields = self.object_instance.object_type.get_schema_fields()

        # Find object_reference fields
        for field_def in schema_fields:
            field_name = field_def.get("name")
            field_type = field_def.get("type")

            if field_type == "object_reference":
                # Get the value from data
                value = self.data.get(field_name)

                # Determine relationship type
                relationship_type = field_def.get("relationship_type", field_name)

                # Normalize value to list
                if value is None or value == "":
                    value = []
                elif not isinstance(value, list):
                    value = [value]

                # Filter out any non-integer values
                value = [int(v) for v in value if v]

                # Update the relationship
                try:
                    self.object_instance.set_relationships(relationship_type, value)
                except ValueError as e:
                    # Log error but don't fail - validation should have caught this
                    import logging

                    logger = logging.getLogger(__name__)
                    logger.warning(
                        f"Failed to sync relationship {relationship_type} for "
                        f"object {self.object_instance.id}: {str(e)}"
                    )

    def populate_reverse_references(self):
        """
        Populate reverse_object_reference fields in data from related_from.
        Called when serializing for display.

        This method:
        1. Finds all reverse_object_reference fields in the schema
        2. Queries related_from
        3. Populates self.data with computed values (does not save)

        Note: This modifies self.data temporarily for display purposes only.
              The changes are not persisted to the database.
        """
        # Get schema fields
        schema_fields = self.object_instance.object_type.get_schema_fields()

        # Find reverse_object_reference fields
        for field_def in schema_fields:
            field_name = field_def.get("name")
            field_type = field_def.get("type")

            if field_type == "reverse_object_reference":
                # Get configuration
                reverse_relationship_type = field_def.get("reverse_relationship_type")
                reverse_object_types = field_def.get("reverse_object_types", [])

                if not reverse_relationship_type:
                    # Skip if not configured
                    continue

                # Query related_from
                if not self.object_instance.related_from:
                    self.data[field_name] = []
                    continue

                # Filter by relationship type and object types
                related_ids = []
                for rel in self.object_instance.related_from:
                    if rel.get("type") == reverse_relationship_type:
                        obj_id = rel.get("object_id")

                        # Filter by object types if specified
                        if reverse_object_types:
                            try:
                                from object_storage.models import ObjectInstance

                                obj = ObjectInstance.objects.get(id=obj_id)
                                if obj.object_type.name in reverse_object_types:
                                    related_ids.append(obj_id)
                            except ObjectInstance.DoesNotExist:
                                pass
                        else:
                            related_ids.append(obj_id)

                # Populate the field
                self.data[field_name] = related_ids

    def save(self, *args, **kwargs):
        """
        Override save to sync relationships from data.
        """
        # Call parent save first
        super().save(*args, **kwargs)

        # Sync relationships after save
        self.sync_relationships_from_data()

    def to_dict(self):
        """Convert to dictionary for API serialization."""
        return {
            "id": self.id,
            "object_id": self.object_instance.id,
            "version_number": self.version_number,
            "data": self.data,
            "widgets": self.widgets,
            "created_by": self.created_by.username,
            "created_at": self.created_at,
            "change_description": self.change_description,
            "effective_date": self.effective_date,
            "expiry_date": self.expiry_date,
            "is_published": self.is_published(),
            "publication_status": self.get_publication_status(),
        }
