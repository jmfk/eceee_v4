"""
Django REST Framework serializers for the Object Storage System

Provides serialization and deserialization for object types and instances,
following camelCase API conventions and existing patterns.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import ObjectTypeDefinition, ObjectInstance, ObjectVersion
from django.utils import timezone


class UserSerializer(serializers.ModelSerializer):
    """Basic user serializer for references"""

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]
        read_only_fields = ["id"]


class ObjectTypeDefinitionSerializer(serializers.ModelSerializer):
    """Serializer for Object Type Definitions"""

    created_by = UserSerializer(read_only=True)
    allowed_child_types = serializers.SlugRelatedField(
        many=True,
        slug_field="name",
        queryset=ObjectTypeDefinition.objects.filter(is_active=True),
        required=False,
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
        """Validate schema structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Schema must be a JSON object")

        if "fields" not in value:
            raise serializers.ValidationError("Schema must contain a 'fields' array")

        if not isinstance(value["fields"], list):
            raise serializers.ValidationError("Schema 'fields' must be an array")

        # Validate each field in the schema
        field_names = set()
        for field in value["fields"]:
            if not isinstance(field, dict):
                raise serializers.ValidationError("Each schema field must be an object")

            if "name" not in field or "type" not in field:
                raise serializers.ValidationError(
                    "Each schema field must have 'name' and 'type'"
                )

            if field["name"] in field_names:
                raise serializers.ValidationError(
                    f"Duplicate field name: {field['name']}"
                )
            field_names.add(field["name"])

            valid_types = [choice[0] for choice in ObjectTypeDefinition.FIELD_TYPES]
            if field["type"] not in valid_types:
                raise serializers.ValidationError(
                    f"Invalid field type: {field['type']}"
                )

        return value

    def validate_slot_configuration(self, value):
        """Validate slot configuration structure"""
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

        return value


class ObjectTypeDefinitionListSerializer(serializers.ModelSerializer):
    """Simplified serializer for object type lists"""

    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
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
            "is_active",
            "created_at",
            "updated_at",
            "created_by_name",
            "instance_count",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_instance_count(self, obj):
        """Return count of object instances of this type"""
        return obj.objectinstance_set.count()


class ObjectInstanceSerializer(serializers.ModelSerializer):
    """Serializer for Object Instances"""

    object_type = ObjectTypeDefinitionSerializer(read_only=True)
    object_type_id = serializers.IntegerField(write_only=True)
    created_by = UserSerializer(read_only=True)
    parent_object = serializers.PrimaryKeyRelatedField(
        queryset=ObjectInstance.objects.all(), required=False, allow_null=True
    )
    is_published = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    version_count = serializers.SerializerMethodField()

    class Meta:
        model = ObjectInstance
        fields = [
            "id",
            "object_type",
            "object_type_id",
            "title",
            "slug",
            "data",
            "status",
            "parent_object",
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
            "slug",
            "version",
            "created_at",
            "updated_at",
            "created_by",
        ]

    def get_is_published(self, obj):
        """Return publication status"""
        return obj.is_published()

    def get_children_count(self, obj):
        """Return count of child objects"""
        return obj.get_children().count()

    def get_version_count(self, obj):
        """Return count of versions"""
        return obj.versions.count()

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
        if attrs.get("parent_object") and attrs.get("object_type_id"):
            parent = attrs["parent_object"]
            object_type = ObjectTypeDefinition.objects.get(id=attrs["object_type_id"])

            if not parent.object_type.can_have_child_type(object_type):
                raise serializers.ValidationError(
                    {
                        "parent_object": f"Object type '{object_type.name}' cannot be a child of '{parent.object_type.name}'"
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
        """Validate widgets against object type slots"""
        allowed_slots = [slot["name"] for slot in object_type.get_slots()]

        for slot_name in widgets.keys():
            if slot_name not in allowed_slots:
                raise serializers.ValidationError(
                    {
                        "widgets": f"Widget slot '{slot_name}' is not defined for this object type"
                    }
                )

    def create(self, validated_data):
        """Create new object instance with version tracking"""
        user = self.context["request"].user
        validated_data["created_by"] = user

        instance = super().create(validated_data)

        # Create initial version
        instance.create_version(user, "Initial version")

        return instance

    def update(self, instance, validated_data):
        """Update object instance with version tracking"""
        user = self.context["request"].user

        # Check if data or widgets changed
        data_changed = (
            "data" in validated_data and validated_data["data"] != instance.data
        )
        widgets_changed = (
            "widgets" in validated_data
            and validated_data["widgets"] != instance.widgets
        )

        if data_changed or widgets_changed:
            # Create version snapshot before updating
            instance.create_version(user, "Update via API")
            instance.version += 1

        return super().update(instance, validated_data)


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
    parent_object_title = serializers.CharField(
        source="parent_object.title", read_only=True
    )

    class Meta:
        model = ObjectInstance
        fields = [
            "id",
            "object_type_name",
            "object_type_label",
            "title",
            "slug",
            "status",
            "parent_object",
            "parent_object_title",
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
    """Serializer for Object Versions"""

    object = ObjectInstanceListSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = ObjectVersion
        fields = [
            "id",
            "object",
            "version_number",
            "data",
            "widgets",
            "created_by",
            "created_at",
            "change_description",
        ]
        read_only_fields = [
            "id",
            "object",
            "version_number",
            "data",
            "widgets",
            "created_by",
            "created_at",
        ]


class ObjectVersionListSerializer(serializers.ModelSerializer):
    """Simplified serializer for object version lists"""

    object_title = serializers.CharField(source="object.title", read_only=True)
    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )

    class Meta:
        model = ObjectVersion
        fields = [
            "id",
            "object",
            "object_title",
            "version_number",
            "created_by_name",
            "created_at",
            "change_description",
        ]
        read_only_fields = [
            "id",
            "object",
            "version_number",
            "created_by_name",
            "created_at",
        ]
