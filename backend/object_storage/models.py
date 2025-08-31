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
            GinIndex(fields=["schema"]),
            GinIndex(fields=["slot_configuration"]),
        ]

    def __str__(self):
        return self.label

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

                # Validate widget control definitions
                if "widgetControls" in slot:
                    if not isinstance(slot["widgetControls"], list):
                        raise ValidationError(
                            f"Slot '{slot['name']}': widgetControls must be an array"
                        )

                    for i, widget_control in enumerate(slot["widgetControls"]):
                        if not isinstance(widget_control, dict):
                            raise ValidationError(
                                f"Slot '{slot['name']}': widget control {i+1} must be an object"
                            )

                        # Required fields
                        if "widgetType" not in widget_control:
                            raise ValidationError(
                                f"Slot '{slot['name']}': widget control {i+1} missing 'widgetType' field"
                            )

                        # Validate widget type exists
                        self._validate_widget_types(
                            [widget_control["widgetType"]], slot["name"]
                        )

                        # Validate optional fields
                        if (
                            "maxInstances" in widget_control
                            and widget_control["maxInstances"] is not None
                        ):
                            if (
                                not isinstance(widget_control["maxInstances"], int)
                                or widget_control["maxInstances"] < 0
                            ):
                                raise ValidationError(
                                    f"Slot '{slot['name']}': widget control {i+1} maxInstances must be a positive integer or null"
                                )

                        if "required" in widget_control and not isinstance(
                            widget_control["required"], bool
                        ):
                            raise ValidationError(
                                f"Slot '{slot['name']}': widget control {i+1} required must be a boolean"
                            )

                        if "preCreate" in widget_control and not isinstance(
                            widget_control["preCreate"], bool
                        ):
                            raise ValidationError(
                                f"Slot '{slot['name']}': widget control {i+1} preCreate must be a boolean"
                            )

                        if "defaultConfig" in widget_control and not isinstance(
                            widget_control["defaultConfig"], dict
                        ):
                            raise ValidationError(
                                f"Slot '{slot['name']}': widget control {i+1} defaultConfig must be an object"
                            )

                # Legacy support - validate old format if present
                if "allowedWidgets" in slot:
                    if not isinstance(slot["allowedWidgets"], list):
                        raise ValidationError(
                            f"Slot '{slot['name']}': allowedWidgets must be an array"
                        )

                    # Validate that widget types exist
                    self._validate_widget_types(slot["allowedWidgets"], slot["name"])

                if "disallowedWidgets" in slot:
                    if not isinstance(slot["disallowedWidgets"], list):
                        raise ValidationError(
                            f"Slot '{slot['name']}': disallowedWidgets must be an array"
                        )

                    # Validate that widget types exist
                    self._validate_widget_types(slot["disallowedWidgets"], slot["name"])

                if "maxWidgets" in slot and slot["maxWidgets"] is not None:
                    if (
                        not isinstance(slot["maxWidgets"], int)
                        or slot["maxWidgets"] < 0
                    ):
                        raise ValidationError(
                            f"Slot '{slot['name']}': maxWidgets must be a positive integer or null"
                        )

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
            widget.slug for widget in widget_type_registry.list_widget_types()
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

        # Legacy format: If allowedWidgets is specified, use only those
        if "allowedWidgets" in slot:
            allowed_slugs = set(slot["allowedWidgets"])
            return [w for w in all_widgets if w.slug in allowed_slugs]

        # Legacy format: If disallowedWidgets is specified, exclude those
        if "disallowedWidgets" in slot:
            disallowed_slugs = set(slot["disallowedWidgets"])
            return [w for w in all_widgets if w.slug not in disallowed_slugs]

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


class ObjectInstance(MPTTModel):
    """
    Actual instances of objects based on their type definitions.
    Contains dynamic data according to the object type's schema.
    Uses MPTT for efficient tree structure management.
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
            original_slug = self.slug
            counter = 1
            while ObjectInstance.objects.filter(
                object_type=self.object_type, slug=self.slug
            ).exists():
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

                    # Get widget type from registry
                    widget_instance = widget_type_registry.get_widget_type_by_slug(
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
                        "type": widget_instance.name,
                        "slug": widget_type,
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

                    # Get widget type from registry
                    widget_instance = widget_type_registry.get_widget_type_by_slug(
                        widget_type
                    )
                    if not widget_instance:
                        continue

                    # Create widget with default configuration
                    widget_data = {
                        "id": str(uuid.uuid4()),
                        "type": widget_instance.name,
                        "slug": widget_type,
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

    def is_published(self):
        """Check if the object is currently published."""
        if self.status != "published":
            return False

        now = timezone.now()

        if self.publish_date and self.publish_date > now:
            return False

        if self.unpublish_date and self.unpublish_date <= now:
            return False

        return True

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
            object=self,
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


class ObjectVersion(models.Model):
    """
    Version history for object instances.
    Stores snapshots of object data and widgets at specific points in time.
    """

    object = models.ForeignKey(
        ObjectInstance, on_delete=models.CASCADE, related_name="versions"
    )
    version_number = models.PositiveIntegerField()
    data = models.JSONField(help_text="Snapshot of object data at this version")
    widgets = models.JSONField(
        help_text="Snapshot of widget configurations at this version"
    )
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    change_description = models.TextField(
        blank=True, help_text="Description of changes made in this version"
    )

    class Meta:
        ordering = ["-version_number"]
        indexes = [
            models.Index(fields=["object", "version_number"]),
            models.Index(fields=["created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["object", "version_number"], name="unique_version_per_object"
            )
        ]

    def __str__(self):
        return f"{self.object.title} v{self.version_number}"

    def to_dict(self):
        """Convert to dictionary for API serialization."""
        return {
            "id": self.id,
            "object_id": self.object.id,
            "version_number": self.version_number,
            "data": self.data,
            "widgets": self.widgets,
            "created_by": self.created_by.username,
            "created_at": self.created_at,
            "change_description": self.change_description,
        }
