"""
Django REST Framework serializers for the Object Storage System

Provides serialization and deserialization for object types and instances,
following camelCase API conventions and existing patterns.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import ObjectTypeDefinition, ObjectInstance, ObjectVersion
from content.models import Namespace
from utils.schema_system import validate_schema
from django.core.exceptions import ValidationError
from django.utils import timezone


class UserSerializer(serializers.ModelSerializer):
    """Basic user serializer for references"""

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name"]
        read_only_fields = ["id"]


class NamespaceSerializer(serializers.ModelSerializer):
    """Basic namespace serializer for references"""

    class Meta:
        model = Namespace
        fields = ["id", "name", "slug", "description", "is_active", "is_default"]
        read_only_fields = ["id"]


class ObjectTypeDefinitionSerializer(serializers.ModelSerializer):
    """Serializer for Object Type Definitions"""

    created_by = UserSerializer(read_only=True)
    namespace = NamespaceSerializer(read_only=True)
    namespace_id = serializers.PrimaryKeyRelatedField(
        queryset=Namespace.objects.all(),
        source="namespace",
        write_only=True,
        required=False,
        allow_null=True,
        help_text="Namespace for organizing content and media for this object type",
    )
    allowed_child_types = serializers.SerializerMethodField()
    allowed_child_types_input = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        help_text="List of object type names that can be children of this type",
    )
    schema_fields_count = serializers.SerializerMethodField()
    slots_count = serializers.SerializerMethodField()
    child_types_count = serializers.SerializerMethodField()
    instance_count = serializers.SerializerMethodField()

    class Meta:
        model = ObjectTypeDefinition
        fields = [
            "id",
            "name",
            "label",
            "plural_label",
            "description",
            "icon_image",
            "schema",
            "slot_configuration",
            "allowed_child_types",
            "allowed_child_types_input",
            "hierarchy_level",
            "namespace",
            "namespace_id",
            "is_active",
            "created_at",
            "updated_at",
            "created_by",
            "metadata",
            "schema_fields_count",
            "slots_count",
            "child_types_count",
            "instance_count",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def get_schema_fields_count(self, obj):
        """Return count of schema fields"""
        return len(obj.get_schema_fields())

    def get_slots_count(self, obj):
        """Return count of widget slots"""
        return len(obj.get_slots())

    def get_child_types_count(self, obj):
        """Return count of allowed child types"""
        return obj.allowed_child_types.count()

    def get_instance_count(self, obj):
        """Return count of object instances of this type"""
        return obj.objectinstance_set.count()

    def get_allowed_child_types(self, obj):
        """Return full object data for allowed child types"""
        child_types = obj.allowed_child_types.filter(is_active=True)
        return [
            {
                "id": ct.id,
                "name": ct.name,
                "label": ct.label,
                "iconImage": ct.icon_image.url if ct.icon_image else None,
                "description": ct.description,
            }
            for ct in child_types
        ]

    def get_slot_configuration(self, obj):
        """Return slot configuration as-is (snake_case)"""
        return obj.slot_configuration or {}

    def validate_name(self, value):
        """Validate object type name"""
        if not value.islower():
            raise serializers.ValidationError("Object type name must be lowercase")
        if not value.replace("_", "").isalnum():
            raise serializers.ValidationError(
                "Object type name must contain only lowercase letters, numbers, and underscores"
            )
        return value

    def validate_schema(self, value):
        """Validate schema structure using the general schema system"""
        try:
            validate_schema(value, "object_type")
        except ValidationError as e:
            # Convert Django ValidationError to DRF ValidationError
            raise serializers.ValidationError(str(e))

        return value

    def validate_slot_configuration(self, value):
        """Validate slot configuration structure and convert to snake_case"""
        # Initialize warnings list
        if not hasattr(self, "_slot_warnings"):
            self._slot_warnings = []

        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Slot configuration must be a JSON object"
            )

        if "slots" in value:
            if not isinstance(value["slots"], list):
                raise serializers.ValidationError(
                    "Slot configuration 'slots' must be an array"
                )

            slot_names = set()
            for slot in value["slots"]:
                if not isinstance(slot, dict):
                    raise serializers.ValidationError("Each slot must be an object")

                if "name" not in slot or "label" not in slot:
                    raise serializers.ValidationError(
                        "Each slot must have 'name' and 'label'"
                    )

                if slot["name"] in slot_names:
                    raise serializers.ValidationError(
                        f"Duplicate slot name: {slot['name']}"
                    )
                slot_names.add(slot["name"])

                # Validate widget type restrictions
                self._validate_widget_restrictions(slot)

        return value

    def _validate_widget_restrictions(self, slot):
        """Validate widget type restrictions for a slot."""
        from webpages.widget_registry import widget_type_registry

        available_widgets = {
            widget.type for widget in widget_type_registry.list_widget_types()
        }
        # Validate widget_controls (new field)
        if "widget_controls" in slot:
            if not isinstance(slot["widget_controls"], list):
                raise serializers.ValidationError(
                    f"Slot '{slot['name']}': widget_controls must be an array"
                )

            valid_controls = []
            for i, control in enumerate(slot["widget_controls"]):
                if not isinstance(control, dict):
                    self._slot_warnings.append(
                        {
                            "slot": slot["name"],
                            "issue": "invalid_control",
                            "message": f"Widget control {i} is not an object and was removed",
                        }
                    )
                    continue

                # Check required fields
                if "widget_type" not in control:
                    self._slot_warnings.append(
                        {
                            "slot": slot["name"],
                            "control": control.get("label", f"control {i}"),
                            "issue": "missing_widget_type",
                            "message": f"Widget control '{control.get('label', i)}' is missing 'widget_type' field and was removed",
                        }
                    )
                    continue

                if "label" not in control:
                    self._slot_warnings.append(
                        {
                            "slot": slot["name"],
                            "control": control.get("widget_type", f"control {i}"),
                            "issue": "missing_label",
                            "message": f"Widget control for '{control.get('widget_type', i)}' is missing 'label' field and was removed",
                        }
                    )
                    continue

                # Filter out controls with invalid widget types
                widget_type = control["widget_type"]
                if widget_type not in available_widgets:
                    self._slot_warnings.append(
                        {
                            "slot": slot["name"],
                            "control": control["label"],
                            "widget_type": widget_type,
                            "issue": "widget_type_not_found",
                            "message": f"Widget type '{widget_type}' for control '{control['label']}' does not exist and was removed",
                        }
                    )
                    continue

                valid_controls.append(control)

            # Add summary if widgets were filtered
            original_count = len(slot["widget_controls"])
            filtered_count = len(valid_controls)
            if filtered_count < original_count:
                self._slot_warnings.append(
                    {
                        "slot": slot["name"],
                        "issue": "widgets_filtered",
                        "message": f"Slot '{slot['name']}': {original_count - filtered_count} widget control(s) were filtered out",
                        "original_count": original_count,
                        "filtered_count": filtered_count,
                    }
                )

            # Replace with filtered list
            slot["widget_controls"] = valid_controls

        # Validate allowed_widgets
        if "allowed_widgets" in slot:
            if not isinstance(slot["allowed_widgets"], list):
                raise serializers.ValidationError(
                    f"Slot '{slot['name']}': allowed_widgets must be an array"
                )

            for widget_type in slot["allowed_widgets"]:
                if widget_type not in available_widgets:
                    raise serializers.ValidationError(
                        f"Slot '{slot['name']}': widget type '{widget_type}' not found in registry"
                    )

        # Validate disallowed_widgets
        if "disallowed_widgets" in slot:
            if not isinstance(slot["disallowed_widgets"], list):
                raise serializers.ValidationError(
                    f"Slot '{slot['name']}': disallowed_widgets must be an array"
                )

            for widget_type in slot["disallowed_widgets"]:
                if widget_type not in available_widgets:
                    raise serializers.ValidationError(
                        f"Slot '{slot['name']}': widget type '{widget_type}' not found in registry"
                    )

        # Validate max_widgets
        if "max_widgets" in slot and slot["max_widgets"] is not None:
            if not isinstance(slot["max_widgets"], int) or slot["max_widgets"] < 0:
                raise serializers.ValidationError(
                    f"Slot '{slot['name']}': max_widgets must be a positive integer or null"
                )

        # Validate pre_created_widgets
        if "pre_created_widgets" in slot:
            if not isinstance(slot["pre_created_widgets"], list):
                raise serializers.ValidationError(
                    f"Slot '{slot['name']}': pre_created_widgets must be an array"
                )

            for widget in slot["pre_created_widgets"]:
                if not isinstance(widget, dict):
                    raise serializers.ValidationError(
                        f"Slot '{slot['name']}': each pre-created widget must be an object"
                    )

                if "type" not in widget:
                    raise serializers.ValidationError(
                        f"Slot '{slot['name']}': pre-created widget missing 'type' field"
                    )

                if widget["type"] not in available_widgets:
                    raise serializers.ValidationError(
                        f"Slot '{slot['name']}': pre-created widget type '{widget['type']}' not found in registry"
                    )

    def validate_allowed_child_types_input(self, value):
        """Validate that all child type names exist and are active"""
        if not value:
            return value

        # Check that all provided names exist and are active
        existing_types = ObjectTypeDefinition.objects.filter(
            name__in=value, is_active=True
        ).values_list("name", flat=True)

        invalid_names = set(value) - set(existing_types)
        if invalid_names:
            raise serializers.ValidationError(
                f"The following object types do not exist or are inactive: {', '.join(invalid_names)}"
            )

        return value

    def create(self, validated_data):
        """Create object type with allowed child types"""
        allowed_child_types_names = validated_data.pop("allowed_child_types_input", [])

        # Create the object type instance
        instance = super().create(validated_data)

        # Set the allowed child types
        if allowed_child_types_names:
            child_types = ObjectTypeDefinition.objects.filter(
                name__in=allowed_child_types_names, is_active=True
            )
            instance.allowed_child_types.set(child_types)

        return instance

    def update(self, instance, validated_data):
        """Update object type with allowed child types"""
        allowed_child_types_names = validated_data.pop(
            "allowed_child_types_input", None
        )

        # Update the instance fields
        instance = super().update(instance, validated_data)

        # Update the allowed child types if provided
        if allowed_child_types_names is not None:
            if allowed_child_types_names:
                child_types = ObjectTypeDefinition.objects.filter(
                    name__in=allowed_child_types_names, is_active=True
                )
                instance.allowed_child_types.set(child_types)
            else:
                # Clear all child types if empty list is provided
                instance.allowed_child_types.clear()

        return instance


class ObjectTypeDefinitionListSerializer(serializers.ModelSerializer):
    """Simplified serializer for object type lists"""

    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    instance_count = serializers.SerializerMethodField()
    allowed_child_types = serializers.SerializerMethodField()

    class Meta:
        model = ObjectTypeDefinition
        fields = [
            "id",
            "name",
            "label",
            "plural_label",
            "description",
            "icon_image",
            "hierarchy_level",
            "is_active",
            "created_at",
            "updated_at",
            "created_by_name",
            "instance_count",
            "allowed_child_types",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_instance_count(self, obj):
        """Return count of object instances of this type"""
        return obj.objectinstance_set.count()

    def get_allowed_child_types(self, obj):
        """Return full object data for allowed child types"""
        child_types = obj.allowed_child_types.filter(is_active=True)
        return [
            {
                "id": ct.id,
                "name": ct.name,
                "label": ct.label,
                "iconImage": ct.icon_image.url if ct.icon_image else None,
                "description": ct.description,
            }
            for ct in child_types
        ]


class ObjectInstanceSerializer(serializers.ModelSerializer):
    """Serializer for Object Instances"""

    object_id = serializers.SerializerMethodField()
    object_type = ObjectTypeDefinitionSerializer(read_only=True)
    object_type_id = serializers.IntegerField(write_only=True)
    created_by = UserSerializer(read_only=True)
    parent = serializers.PrimaryKeyRelatedField(
        queryset=ObjectInstance.objects.all(), required=False, allow_null=True
    )
    is_published = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    version_count = serializers.SerializerMethodField()

    # Custom fields for data and widgets (not stored on model, but handled in versions)
    data = serializers.JSONField(required=False, allow_null=True)
    widgets = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = ObjectInstance
        fields = [
            "id",
            "object_id",
            "object_type",
            "object_type_id",
            "title",
            "slug",
            "data",
            "status",
            "parent",
            "level",
            "tree_id",
            "widgets",
            "publish_date",
            "unpublish_date",
            "version",
            "created_by",
            "created_at",
            "updated_at",
            "metadata",
            "is_published",
            "children_count",
            "version_count",
        ]
        read_only_fields = [
            "id",
            "object_id",
            "slug",
            "version",
            "created_at",
            "updated_at",
            "created_by",
        ]

    def get_object_id(self, obj):
        """Return publication status"""
        return obj.id

    def get_is_published(self, obj):
        """Return publication status"""
        return obj.is_published()

    def get_children_count(self, obj):
        """Return count of child objects"""
        return obj.get_children().count()

    def get_version_count(self, obj):
        """Return count of versions"""
        return obj.versions.count()

    def to_representation(self, instance):
        """Add data and widgets from current version to the serialized output"""
        data = super().to_representation(instance)

        # Add data and widgets from current version
        data["data"] = instance.data
        data["widgets"] = instance.widgets

        return data

    def validate_object_type_id(self, value):
        """Validate that object type exists and is active"""
        try:
            obj_type = ObjectTypeDefinition.objects.get(id=value)
            if not obj_type.is_active:
                raise serializers.ValidationError("Object type is not active")
            return value
        except ObjectTypeDefinition.DoesNotExist:
            raise serializers.ValidationError("Object type does not exist")

    def validate_data(self, value):
        """Validate data against object type schema"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Data must be a JSON object")
        return value

    def validate_widgets(self, value):
        """Validate widgets configuration"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Widgets must be a JSON object")
        return value

    def validate(self, attrs):
        """Cross-field validation"""
        # Validate parent-child relationship
        if attrs.get("parent") and attrs.get("object_type_id"):
            parent = attrs["parent"]
            object_type = ObjectTypeDefinition.objects.get(id=attrs["object_type_id"])

            if not parent.object_type.can_have_child_type(object_type):
                raise serializers.ValidationError(
                    {
                        "parent": f"Object type '{object_type.name}' cannot be a child of '{parent.object_type.name}'"
                    }
                )

        # Validate data against schema if object type is provided
        if attrs.get("object_type_id") and attrs.get("data"):
            object_type = ObjectTypeDefinition.objects.get(id=attrs["object_type_id"])
            self._validate_data_against_schema(attrs["data"], object_type)

        # Validate widgets against slots if object type is provided
        if attrs.get("object_type_id") and attrs.get("widgets"):
            object_type = ObjectTypeDefinition.objects.get(id=attrs["object_type_id"])
            self._validate_widgets_against_slots(attrs["widgets"], object_type)

        return attrs

    def _validate_data_against_schema(self, data, object_type):
        """Validate data against object type schema"""
        schema_fields = object_type.get_schema_fields()

        for field_def in schema_fields:
            field_name = field_def["name"]
            field_required = field_def.get("required", False)

            if field_required and (field_name not in data or not data[field_name]):
                raise serializers.ValidationError(
                    {"data": f"Required field '{field_name}' is missing or empty"}
                )

    def _validate_widgets_against_slots(self, widgets, object_type):
        """Validate and normalize widgets against object type slots.

        This method:
        1. Keeps extra slot information even if not in the object type definition
        2. Creates missing slots with empty content if defined in the object type
        3. Does not raise errors for missing or extra slots, just normalizes them
        """
        defined_slots = [slot["name"] for slot in object_type.get_slots()]

        # Ensure all defined slots exist in widgets (create empty ones if missing)
        for slot_name in defined_slots:
            if slot_name not in widgets:
                widgets[slot_name] = []  # Create empty slot

        # Note: We intentionally keep extra slots that aren't in the definition
        # This allows for flexibility and prevents data loss when object type
        # definitions change

    def create(self, validated_data):
        """Create new object instance with version tracking"""
        user = self.context["request"].user

        # Extract data and widgets from validated_data
        data = validated_data.pop("data", {})
        widgets = validated_data.pop("widgets", {})

        validated_data["created_by"] = user
        instance = super().create(validated_data)

        # Create initial version with the data and widgets
        instance.create_version(
            user, data=data, widgets=widgets, change_description="Initial version"
        )

        return instance

    def update(self, instance, validated_data):
        """Update object instance with version tracking"""
        user = self.context["request"].user

        # Extract data and widgets from validated_data
        new_data = validated_data.pop("data", None)
        new_widgets = validated_data.pop("widgets", None)

        # Check if data or widgets changed
        data_changed = new_data is not None and new_data != instance.data
        widgets_changed = new_widgets is not None and new_widgets != instance.widgets

        # Update basic instance fields first
        instance = super().update(instance, validated_data)

        # Create new version if data or widgets changed
        if data_changed or widgets_changed:
            # Use current data/widgets if not provided in update
            version_data = new_data if new_data is not None else instance.data
            version_widgets = (
                new_widgets if new_widgets is not None else instance.widgets
            )

            instance.create_version(
                user,
                data=version_data,
                widgets=version_widgets,
                change_description="Update via API",
            )

        return instance


class ObjectInstanceListSerializer(serializers.ModelSerializer):
    """Simplified serializer for object instance lists"""

    object_type_name = serializers.CharField(source="object_type.name", read_only=True)
    object_type_label = serializers.CharField(
        source="object_type.label", read_only=True
    )
    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    is_published = serializers.SerializerMethodField()
    parent_title = serializers.CharField(source="parent.title", read_only=True)

    class Meta:
        model = ObjectInstance
        fields = [
            "id",
            "object_type_name",
            "object_type_label",
            "title",
            "slug",
            "status",
            "parent",
            "parent_title",
            "level",
            "publish_date",
            "unpublish_date",
            "version",
            "created_by_name",
            "created_at",
            "updated_at",
            "is_published",
        ]
        read_only_fields = ["id", "slug", "version", "created_at", "updated_at"]

    def get_is_published(self, obj):
        """Return publication status"""
        return obj.is_published()


class ObjectVersionSerializer(serializers.ModelSerializer):
    """Serializer for Object Versions with enhanced publication support"""

    object_id = serializers.SerializerMethodField()
    version_id = serializers.SerializerMethodField()
    object_instance = ObjectInstanceListSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    is_published = serializers.SerializerMethodField()
    is_current_published = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()

    class Meta:
        model = ObjectVersion
        fields = [
            "id",
            "object_id",
            "version_id",
            "object_instance",
            "version_number",
            "data",
            "widgets",
            "created_by",
            "created_at",
            "change_description",
            # New publication fields
            "effective_date",
            "expiry_date",
            "is_published",
            "is_current_published",
            "publication_status",
        ]
        read_only_fields = [
            "id",
            "object_id",
            "version_id",
            "object_instance",
            "version_number",
            "data",
            "widgets",
            "created_by",
            "created_at",
            "is_published",
            "is_current_published",
            "publication_status",
        ]

    def get_object_id(self, obj):
        """Return publication status"""
        return obj.object_instance.id

    def get_version_id(self, obj):
        """Return publication status"""
        return obj.id

    def get_is_published(self, obj):
        """Check if this version is currently published based on dates"""
        return obj.is_published()

    def get_is_current_published(self, obj):
        """Check if this is the current published version for its object"""
        return obj.is_current_published()

    def get_publication_status(self, obj):
        """Get human-readable publication status based on dates"""
        return obj.get_publication_status()


class ObjectVersionListSerializer(serializers.ModelSerializer):
    """Simplified serializer for object version lists"""

    object_title = serializers.CharField(source="object_instance.title", read_only=True)
    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    publication_status = serializers.SerializerMethodField()
    is_current_published = serializers.SerializerMethodField()

    class Meta:
        model = ObjectVersion
        fields = [
            "id",
            "object_instance",
            "object_title",
            "version_number",
            "created_by_name",
            "created_at",
            "change_description",
            "effective_date",
            "expiry_date",
            "publication_status",
            "is_current_published",
        ]
        read_only_fields = [
            "id",
            "object_instance",
            "version_number",
            "created_by_name",
            "created_at",
            "publication_status",
            "is_current_published",
        ]

    def get_publication_status(self, obj):
        """Get human-readable publication status based on dates"""
        return obj.get_publication_status()

    def get_is_current_published(self, obj):
        """Check if this is the current published version for its object"""
        return obj.is_current_published()
