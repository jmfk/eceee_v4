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
import json


class ObjectTypeDefinition(models.Model):
    """
    Defines object types with configurable schemas and widget slot configurations.
    This is the blueprint for creating dynamic object types like 'news', 'blog', 'event'.
    """

    FIELD_TYPES = [
        ("text", "Text"),
        ("rich_text", "Rich Text"),
        ("number", "Number"),
        ("date", "Date"),
        ("datetime", "Date & Time"),
        ("boolean", "Boolean"),
        ("image", "Image"),
        ("file", "File"),
        ("url", "URL"),
        ("email", "Email"),
        ("choice", "Choice"),
        ("multi_choice", "Multiple Choice"),
        ("user_reference", "User Reference"),
        ("object_reference", "Object Reference"),
    ]

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
        """Validate the schema JSON structure."""
        if not isinstance(self.schema, dict):
            raise ValidationError("Schema must be a JSON object")

        if "fields" not in self.schema:
            raise ValidationError("Schema must contain a 'fields' array")

        if not isinstance(self.schema["fields"], list):
            raise ValidationError("Schema 'fields' must be an array")

        for field in self.schema["fields"]:
            if not isinstance(field, dict):
                raise ValidationError("Each schema field must be an object")

            required_keys = ["name", "type"]
            for key in required_keys:
                if key not in field:
                    raise ValidationError(f"Schema field missing required key: {key}")

            if field["type"] not in [choice[0] for choice in self.FIELD_TYPES]:
                raise ValidationError(f"Invalid field type: {field['type']}")

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

    def get_schema_fields(self):
        """Return the list of schema fields for this object type."""
        return self.schema.get("fields", [])

    def get_slots(self):
        """Return the list of widget slots for this object type."""
        return self.slot_configuration.get("slots", [])

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


class ObjectInstance(models.Model):
    """
    Actual instances of objects based on their type definitions.
    Contains dynamic data according to the object type's schema.
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
    data = models.JSONField(
        default=dict, help_text="Object data according to the type's schema"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
        help_text="Publication status of this object",
    )
    parent_object = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        help_text="Parent object for hierarchical relationships",
    )
    widgets = models.JSONField(
        default=dict,
        help_text="Widget configurations for each slot defined by the object type",
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
            models.Index(fields=["parent_object"]),
            GinIndex(fields=["data"]),
            GinIndex(fields=["widgets"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["slug", "object_type"], name="unique_slug_per_object_type"
            )
        ]

    def __str__(self):
        return f"{self.object_type.label}: {self.title}"

    def save(self, *args, **kwargs):
        """Override save to handle slug generation and validation."""
        if not self.slug:
            self.slug = slugify(self.title)

        # Ensure slug is unique within the object type
        if not self.pk:  # New object
            original_slug = self.slug
            counter = 1
            while ObjectInstance.objects.filter(
                object_type=self.object_type, slug=self.slug
            ).exists():
                self.slug = f"{original_slug}-{counter}"
                counter += 1

        super().save(*args, **kwargs)

    def clean(self):
        """Validate the object instance."""
        super().clean()

        # Validate data against schema
        if self.object_type_id and self.data:
            self._validate_data_against_schema()

        # Validate parent-child relationship
        if self.parent_object:
            self._validate_parent_child_relationship()

        # Validate widgets against slot configuration
        if self.object_type_id and self.widgets:
            self._validate_widgets_against_slots()

    def _validate_data_against_schema(self):
        """Validate the object data against its type's schema."""
        schema_fields = self.object_type.get_schema_fields()

        for field_def in schema_fields:
            field_name = field_def["name"]
            field_required = field_def.get("required", False)

            if field_required and (
                field_name not in self.data or not self.data[field_name]
            ):
                raise ValidationError(
                    f"Required field '{field_name}' is missing or empty"
                )

    def _validate_parent_child_relationship(self):
        """Validate that the parent-child relationship is allowed."""
        if not self.object_type.can_have_child_type(self.parent_object.object_type):
            raise ValidationError(
                f"Object type '{self.object_type.name}' cannot be a child of "
                f"'{self.parent_object.object_type.name}'"
            )

    def _validate_widgets_against_slots(self):
        """Validate widgets against the object type's slot configuration."""
        allowed_slots = [slot["name"] for slot in self.object_type.get_slots()]

        for slot_name in self.widgets.keys():
            if slot_name not in allowed_slots:
                raise ValidationError(
                    f"Widget slot '{slot_name}' is not defined for this object type"
                )

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

    def get_children(self):
        """Get all child objects."""
        return ObjectInstance.objects.filter(parent_object=self)

    def get_descendants(self):
        """Get all descendant objects (children, grandchildren, etc.)."""
        descendants = []
        children = self.get_children()

        for child in children:
            descendants.append(child)
            descendants.extend(child.get_descendants())

        return descendants

    def create_version(self, user, change_description=""):
        """Create a version snapshot of this object."""
        return ObjectVersion.objects.create(
            object=self,
            version_number=self.version,
            data=self.data.copy(),
            widgets=self.widgets.copy(),
            created_by=user,
            change_description=change_description,
        )

    def to_dict(self):
        """Convert to dictionary for API serialization."""
        return {
            "id": self.id,
            "object_type": self.object_type.to_dict(),
            "title": self.title,
            "slug": self.slug,
            "data": self.data,
            "status": self.status,
            "parent_object": self.parent_object.id if self.parent_object else None,
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
