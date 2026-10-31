"""
Django REST Framework serializers for the Object Storage System

Provides serialization and deserialization for object types and instances,
following camelCase API conventions and existing patterns.
"""

from types import SimpleNamespace

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import transaction
from rest_framework import serializers

from content.models import Namespace
from file_manager.imgproxy import imgproxy_service
from utils.schema_system import validate_schema

from .browser_config import DEFAULT_LIST_FIELDS, available_list_fields, browser_config, validate_browser_config
from .models import ObjectInstance, ObjectTypeDefinition, ObjectVersion


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


class RelationshipSerializer(serializers.Serializer):
    """Serializer for individual relationship objects in the relationships field"""

    type = serializers.CharField(
        max_length=100,
        help_text="Relationship type (e.g., 'authors', 'translators', 'related_articles')",
    )
    object_id = serializers.IntegerField(help_text="Primary key of the related ObjectInstance")

    def validate_object_id(self, value):
        """Validate that the referenced object exists"""
        if not ObjectInstance.objects.filter(id=value, is_deleted=False, object_type__is_deleted=False).exists():
            raise serializers.ValidationError(f"ObjectInstance with id {value} does not exist")
        return value


class RelatedObjectSerializer(serializers.Serializer):
    """Serializer for displaying related objects with full details"""

    type = serializers.CharField()
    object_id = serializers.IntegerField()
    object = serializers.SerializerMethodField()

    def get_object(self, obj):
        """Get the related object details"""
        from .models import ObjectInstance

        instance = ObjectInstance.objects.filter(
            id=obj.get("object_id"), is_deleted=False, object_type__is_deleted=False
        ).first()
        if instance:
            return {
                "id": instance.id,
                "title": instance.title,
                "slug": instance.slug,
                "object_type": {
                    "id": instance.object_type.id,
                    "name": instance.object_type.name,
                    "label": instance.object_type.label,
                },
            }
        return None


class ObjectReferenceFieldSerializer(serializers.Serializer):
    """
    Serializer for validating object_reference field values.

    This can be used standalone or as part of larger serializers.
    Validates that referenced objects exist and match allowed types.
    """

    value = serializers.JSONField()
    field_config = serializers.JSONField()

    def validate(self, attrs):
        """Validate the object reference field value"""
        from django.core.exceptions import ValidationError as DjangoValidationError

        from utils.schema_system import validate_object_reference

        value = attrs.get("value")
        field_config = attrs.get("field_config", {})

        try:
            validate_object_reference(value, field_config)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"value": str(e)})

        return attrs


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
    browser_group = serializers.SerializerMethodField()
    browser_group_id = serializers.PrimaryKeyRelatedField(
        queryset=ObjectTypeDefinition.objects.filter(is_deleted=False),
        source="browser_group",
        write_only=True,
        required=False,
        allow_null=True,
        help_text="Main object type under which this type is grouped in the object browser",
    )
    schema_fields_count = serializers.SerializerMethodField()
    slots_count = serializers.SerializerMethodField()
    child_types_count = serializers.SerializerMethodField()
    instance_count = serializers.SerializerMethodField()
    icon_image = serializers.SerializerMethodField()
    browser_config = serializers.SerializerMethodField()

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
            "browser_group",
            "browser_group_id",
            "hierarchy_level",
            "namespace",
            "namespace_id",
            "is_active",
            "created_at",
            "updated_at",
            "created_by",
            "metadata",
            "browser_config",
            "schema_fields_count",
            "slots_count",
            "child_types_count",
            "instance_count",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def get_browser_config(self, obj):
        return browser_config(obj)

    def get_schema_fields_count(self, obj):
        """Return count of schema fields"""
        return len(obj.get_schema_fields())

    def get_slots_count(self, obj):
        """Return count of widget slots"""
        return len(obj.get_slots())

    def get_child_types_count(self, obj):
        """Return count of allowed child types"""
        return obj.allowed_child_types.count()

    def get_browser_group(self, obj):
        """Return the main browser type used to group this supporting type."""
        if not obj.browser_group:
            return None
        return {
            "id": obj.browser_group.id,
            "name": obj.browser_group.name,
            "label": obj.browser_group.label,
            "plural_label": obj.browser_group.plural_label,
        }

    def get_instance_count(self, obj):
        """Return count of object instances of this type"""
        return obj.objectinstance_set.filter(is_deleted=False).count()

    def _get_absolute_url(self, url):
        """Helper to ensure URL is absolute for imgproxy"""
        if not url:
            return None
        if url.startswith("http"):
            return url

        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_icon_image(self, obj):
        """Return icon image URL with imgproxy optimization and cache busting"""
        if not obj.icon_image:
            return None

        # Use imgproxy for optimized icon delivery
        source_url = obj.icon_image.url

        # Ensure URL is absolute for imgproxy
        absolute_source_url = self._get_absolute_url(source_url)

        # Generate optimized URL using imgproxy (small square icon)
        return imgproxy_service.generate_url(
            source_url=absolute_source_url,
            width=64,
            height=64,
            resize_type="fill",
            gravity="ce",
            version=int(obj.updated_at.timestamp()),
        )

    def to_representation(self, instance):
        """Convert representation to camelCase for frontend"""
        data = super().to_representation(instance)

        # Convert schema keys from snake_case to camelCase for frontend
        if "schema" in data and data["schema"]:
            data["schema"] = self._convert_schema_keys_to_camel(data["schema"])

        return data

    def get_allowed_child_types(self, obj):
        """Return full object data for allowed child types"""
        child_types = obj.allowed_child_types.filter(is_active=True, is_deleted=False)
        return [
            {
                "id": ct.id,
                "name": ct.name,
                "label": ct.label,
                "iconImage": (
                    f"{self._get_absolute_url(ct.icon_image.url)}?v={int(ct.updated_at.timestamp())}"
                    if ct.icon_image
                    else None
                ),
                "description": ct.description,
            }
            for ct in child_types
        ]

    def get_slot_configuration(self, obj):
        """Return slot configuration as-is (snake_case)"""
        return obj.slot_configuration or {}

    def _camel_to_snake(self, name: str) -> str:
        """Convert camelCase to snake_case"""
        import re

        return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()

    def _snake_to_camel(self, name: str) -> str:
        """Convert snake_case to camelCase"""
        components = name.split("_")
        return components[0] + "".join(x.title() for x in components[1:])

    def _convert_schema_keys_to_snake(self, schema: dict) -> dict:
        """Convert schema property keys and references to snake_case for backend storage"""
        if not isinstance(schema, dict):
            return schema

        converted = {**schema}

        # Convert properties object keys
        if "properties" in converted and isinstance(converted["properties"], dict):
            old_props = converted["properties"]
            converted["properties"] = {self._camel_to_snake(key): value for key, value in old_props.items()}

        # Convert required array items
        if "required" in converted and isinstance(converted["required"], list):
            converted["required"] = [self._camel_to_snake(key) for key in converted["required"]]

        # Convert propertyOrder array items
        if "propertyOrder" in converted and isinstance(converted["propertyOrder"], list):
            converted["propertyOrder"] = [self._camel_to_snake(key) for key in converted["propertyOrder"]]

        if isinstance(converted.get("editorGroups"), list):
            converted["editorGroups"] = [
                (
                    {**group, "fields": [self._camel_to_snake(key) for key in group.get("fields", [])]}
                    if isinstance(group, dict)
                    else group
                )
                for group in converted["editorGroups"]
            ]

        return converted

    def _convert_schema_keys_to_camel(self, schema: dict) -> dict:
        """Convert schema property keys and references to camelCase for frontend"""
        if not isinstance(schema, dict):
            return schema

        converted = {**schema}

        # Convert properties object keys
        if "properties" in converted and isinstance(converted["properties"], dict):
            old_props = converted["properties"]
            converted["properties"] = {self._snake_to_camel(key): value for key, value in old_props.items()}

        # Convert required array items
        if "required" in converted and isinstance(converted["required"], list):
            converted["required"] = [self._snake_to_camel(key) for key in converted["required"]]

        # Convert propertyOrder array items
        if "propertyOrder" in converted and isinstance(converted["propertyOrder"], list):
            converted["propertyOrder"] = [self._snake_to_camel(key) for key in converted["propertyOrder"]]

        if isinstance(converted.get("editorGroups"), list):
            converted["editorGroups"] = [
                (
                    {**group, "fields": [self._snake_to_camel(key) for key in group.get("fields", [])]}
                    if isinstance(group, dict)
                    else group
                )
                for group in converted["editorGroups"]
            ]

        return converted

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
        # Convert camelCase keys to snake_case for backend storage
        value = self._convert_schema_keys_to_snake(value)

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
            raise serializers.ValidationError("Slot configuration must be a JSON object")

        if "slots" in value:
            if not isinstance(value["slots"], list):
                raise serializers.ValidationError("Slot configuration 'slots' must be an array")

            available_widgets = self._available_widget_types()
            slot_names = set()
            for slot in value["slots"]:
                if not isinstance(slot, dict):
                    raise serializers.ValidationError("Each slot must be an object")

                if "name" not in slot or "label" not in slot:
                    raise serializers.ValidationError("Each slot must have 'name' and 'label'")

                if slot["name"] in slot_names:
                    raise serializers.ValidationError(f"Duplicate slot name: {slot['name']}")
                slot_names.add(slot["name"])

                # Validate widget type restrictions
                self._validate_widget_restrictions(slot, available_widgets)

        return value

    def _available_widget_types(self):
        """Include published types from the selected namespace's tenant default theme."""
        from webpages.widget_registry import widget_type_registry

        available_widgets = {widget.type for widget in widget_type_registry.list_widget_types()}
        if "namespace_id" in self.initial_data:
            namespace_id = self.initial_data["namespace_id"]
        elif "namespaceId" in self.initial_data:
            namespace_id = self.initial_data["namespaceId"]
        elif self.instance is not None:
            namespace_id = self.instance.namespace_id
        else:
            namespace_id = None
        try:
            namespace = Namespace.objects.filter(pk=namespace_id).first() if namespace_id else None
        except (TypeError, ValueError):
            namespace = None
        request = self.context.get("request")
        if namespace is None or (request and getattr(request, "tenant", None) != namespace.tenant):
            return available_widgets

        from webpages.models import PageTheme
        from webpages.theme_widgets import PREFIX

        theme = PageTheme.objects.filter(tenant=namespace.tenant, is_default=True, is_active=True).first()
        if theme:
            available_widgets.update(
                PREFIX + item["id"]
                for item in (theme.widget_types or {}).get("items", [])
                if item.get("active_version") and item.get("status", "active") == "active" and item.get("releases")
            )
        return available_widgets

    def _validate_widget_restrictions(self, slot, available_widgets):
        """Validate widget type restrictions for a slot."""
        # Validate widget_controls (new field)
        if "widget_controls" in slot:
            if not isinstance(slot["widget_controls"], list):
                raise serializers.ValidationError(f"Slot '{slot['name']}': widget_controls must be an array")

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
                            "message": (
                                f"Widget control '{control.get('label', i)}' is missing "
                                "'widget_type' field and was removed"
                            ),
                        }
                    )
                    continue

                if "label" not in control:
                    self._slot_warnings.append(
                        {
                            "slot": slot["name"],
                            "control": control.get("widget_type", f"control {i}"),
                            "issue": "missing_label",
                            "message": (
                                f"Widget control for '{control.get('widget_type', i)}' is missing "
                                "'label' field and was removed"
                            ),
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
                            "message": (
                                f"Widget type '{widget_type}' for control '{control['label']}' "
                                "does not exist and was removed"
                            ),
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
                        "message": (
                            f"Slot '{slot['name']}': {original_count - filtered_count} "
                            "widget control(s) were filtered out"
                        ),
                        "original_count": original_count,
                        "filtered_count": filtered_count,
                    }
                )

            # Replace with filtered list
            slot["widget_controls"] = valid_controls

        # Validate allowed_widgets
        if "allowed_widgets" in slot:
            if not isinstance(slot["allowed_widgets"], list):
                raise serializers.ValidationError(f"Slot '{slot['name']}': allowed_widgets must be an array")

            for widget_type in slot["allowed_widgets"]:
                if widget_type not in available_widgets:
                    raise serializers.ValidationError(
                        f"Slot '{slot['name']}': widget type '{widget_type}' not found in registry"
                    )

        # Validate disallowed_widgets
        if "disallowed_widgets" in slot:
            if not isinstance(slot["disallowed_widgets"], list):
                raise serializers.ValidationError(f"Slot '{slot['name']}': disallowed_widgets must be an array")

            for widget_type in slot["disallowed_widgets"]:
                if widget_type not in available_widgets:
                    raise serializers.ValidationError(
                        f"Slot '{slot['name']}': widget type '{widget_type}' not found in registry"
                    )

        # Validate allowed_types
        if "allowed_types" in slot:
            if not isinstance(slot["allowed_types"], list):
                raise serializers.ValidationError(f"Slot '{slot['name']}': allowed_types must be an array")

            for widget_type in slot["allowed_types"]:
                if widget_type not in available_widgets:
                    raise serializers.ValidationError(
                        f"Slot '{slot['name']}': widget type '{widget_type}' not found in registry"
                    )

        # Validate disallowed_types
        if "disallowed_types" in slot:
            if not isinstance(slot["disallowed_types"], list):
                raise serializers.ValidationError(f"Slot '{slot['name']}': disallowed_types must be an array")

            for widget_type in slot["disallowed_types"]:
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
                raise serializers.ValidationError(f"Slot '{slot['name']}': pre_created_widgets must be an array")

            for widget in slot["pre_created_widgets"]:
                if not isinstance(widget, dict):
                    raise serializers.ValidationError(
                        f"Slot '{slot['name']}': each pre-created widget must be an object"
                    )

                if "type" not in widget:
                    raise serializers.ValidationError(f"Slot '{slot['name']}': pre-created widget missing 'type' field")

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
            name__in=value, is_active=True, is_deleted=False
        ).values_list("name", flat=True)

        invalid_names = set(value) - set(existing_types)
        if invalid_names:
            raise serializers.ValidationError(
                f"The following object types do not exist or are inactive: {', '.join(invalid_names)}"
            )

        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # Keep browse choices valid when metadata or the schema changes through regular APIs.
        metadata = attrs.get("metadata", self.instance.metadata if self.instance else {}) or {}
        if "browser" in metadata and ("metadata" in attrs or "schema" in attrs):
            definition = SimpleNamespace(
                pk=self.instance.pk if self.instance else None,
                schema=attrs.get("schema", self.instance.schema if self.instance else {}),
            )
            request = self.context.get("request")
            if request is None or not getattr(request, "tenant", None):
                raise serializers.ValidationError({"metadata": "A tenant is required for browser configuration."})
            validate_browser_config(definition, request.tenant, metadata["browser"])
        browser_group = attrs.get("browser_group")
        if browser_group is None:
            return attrs

        if self.instance and browser_group.pk == self.instance.pk:
            raise serializers.ValidationError({"browser_group_id": "An object type cannot be its own browser group."})
        if (
            browser_group.is_deleted
            or not browser_group.is_active
            or browser_group.hierarchy_level not in ["top_level_only", "both"]
        ):
            raise serializers.ValidationError(
                {"browser_group_id": "The browser group must be an active top-level object type."}
            )
        if browser_group.browser_group_id:
            raise serializers.ValidationError({"browser_group_id": "Browser groups cannot be nested."})
        if self.instance and self.instance.supporting_browser_types.exists():
            raise serializers.ValidationError(
                {"browser_group_id": ("A browser group with supporting types cannot itself become a supporting type.")}
            )
        return attrs

    def create(self, validated_data):
        """Create object type with allowed child types"""
        allowed_child_types_names = validated_data.pop("allowed_child_types_input", [])

        # Create the object type instance
        instance = super().create(validated_data)

        # Set the allowed child types
        if allowed_child_types_names:
            child_types = ObjectTypeDefinition.objects.filter(
                name__in=allowed_child_types_names, is_active=True, is_deleted=False
            )
            instance.allowed_child_types.set(child_types)

        return instance

    def update(self, instance, validated_data):
        """Update object type with allowed child types"""
        allowed_child_types_names = validated_data.pop("allowed_child_types_input", None)

        # Update the instance fields
        instance = super().update(instance, validated_data)

        # Update the allowed child types if provided
        if allowed_child_types_names is not None:
            if allowed_child_types_names:
                child_types = ObjectTypeDefinition.objects.filter(
                    name__in=allowed_child_types_names, is_active=True, is_deleted=False
                )
                instance.allowed_child_types.set(child_types)
            else:
                # Clear all child types if empty list is provided
                instance.allowed_child_types.clear()

        return instance


class ObjectTypeDefinitionListSerializer(serializers.ModelSerializer):
    """Simplified serializer for object type lists"""

    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    instance_count = serializers.SerializerMethodField()
    allowed_child_types = serializers.SerializerMethodField()
    icon_image = serializers.SerializerMethodField()
    browser_group = serializers.SerializerMethodField()
    browser_config = serializers.SerializerMethodField()
    browser_list_fields = serializers.SerializerMethodField()

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
            "browser_group",
            "browser_config",
            "browser_list_fields",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_browser_config(self, obj):
        return browser_config(obj)

    def get_browser_list_fields(self, obj):
        fields = available_list_fields(obj)
        return [fields[key] for key in browser_config(obj).get("list_fields", DEFAULT_LIST_FIELDS) if key in fields]

    def get_instance_count(self, obj):
        """Return count of object instances of this type"""
        return obj.objectinstance_set.filter(is_deleted=False).count()

    def _get_absolute_url(self, url):
        """Helper to ensure URL is absolute for imgproxy"""
        if not url:
            return None
        if url.startswith("http"):
            return url

        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_icon_image(self, obj):
        """Return icon image URL with imgproxy optimization and cache busting"""
        if not obj.icon_image:
            return None

        # Use imgproxy for optimized icon delivery
        source_url = obj.icon_image.url

        # Ensure URL is absolute for imgproxy
        absolute_source_url = self._get_absolute_url(source_url)

        # Generate optimized URL using imgproxy (small square icon)
        return imgproxy_service.generate_url(
            source_url=absolute_source_url,
            width=64,
            height=64,
            resize_type="fill",
            gravity="ce",
            version=int(obj.updated_at.timestamp()),
        )

    def get_allowed_child_types(self, obj):
        """Return full object data for allowed child types"""
        child_types = obj.allowed_child_types.filter(is_active=True, is_deleted=False)
        return [
            {
                "id": ct.id,
                "name": ct.name,
                "label": ct.label,
                "iconImage": (
                    f"{self._get_absolute_url(ct.icon_image.url)}?v={int(ct.updated_at.timestamp())}"
                    if ct.icon_image
                    else None
                ),
                "description": ct.description,
            }
            for ct in child_types
        ]

    def get_browser_group(self, obj):
        """Return the main browser type used to group this supporting type."""
        if not obj.browser_group:
            return None
        return {
            "id": obj.browser_group.id,
            "name": obj.browser_group.name,
            "label": obj.browser_group.label,
            "plural_label": obj.browser_group.plural_label,
        }


class ObjectInstanceSerializer(serializers.ModelSerializer):
    """Serializer for Object Instances"""

    classification_ids = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)
    object_id = serializers.SerializerMethodField()
    object_type = ObjectTypeDefinitionSerializer(read_only=True)
    object_type_id = serializers.IntegerField(write_only=True)
    created_by = UserSerializer(read_only=True)
    parent = serializers.PrimaryKeyRelatedField(
        queryset=ObjectInstance.objects.filter(is_deleted=False, object_type__is_deleted=False),
        required=False,
        allow_null=True,
    )
    status = serializers.SerializerMethodField()  # Computed status based on version publication
    is_published = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    version_count = serializers.SerializerMethodField()

    # Custom fields for data and widgets (not stored on model, but handled in versions)
    data = serializers.JSONField(required=False, allow_null=True)
    widgets = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = ObjectInstance
        fields = [
            "classification_ids",
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
            "relationships",
            "related_from",
        ]
        read_only_fields = [
            "id",
            "object_id",
            "slug",
            "version",
            "created_at",
            "updated_at",
            "created_by",
            "related_from",
        ]

    def get_object_id(self, obj):
        """Return object ID"""
        return obj.id

    def get_status(self, obj):
        return obj.get_publication_status()

    def get_is_published(self, obj):
        """Return publication status"""
        return obj.is_published()

    def get_children_count(self, obj):
        """Return count of child objects"""
        return obj.get_children().filter(is_deleted=False, object_type__is_deleted=False).count()

    def get_version_count(self, obj):
        """Return count of versions"""
        return obj.versions.count()

    def to_representation(self, instance):
        """Read the canonical editor snapshot without creating a working copy."""
        from taxonomy.assignments import classification_ids
        from webpages.utils.widget_serialization import serialize_widget_slots

        from .services.version_workflow import ObjectVersionWorkflow

        data = super().to_representation(instance)
        for field, lookup in (
            ("relationships", instance.get_related_objects),
            ("related_from", instance.get_related_from_objects),
        ):
            visible_ids = {str(pk) for pk in lookup().values_list("pk", flat=True)}
            data[field] = [
                relation for relation in (data.get(field) or []) if str(relation.get("object_id")) in visible_ids
            ]
        workflow = ObjectVersionWorkflow(instance)
        editable = workflow.editable()
        version = editable or workflow.live() or workflow.versions().first()
        if version:
            data.update(
                title=version.content_title,
                is_working_copy=editable is not None,
                data=version.data,
                widgets=(
                    serialize_widget_slots(version.widgets) if isinstance(version.widgets, dict) else version.widgets
                ),
                classification_ids=classification_ids(version),
                version=version.version_number,
                version_id=version.id,
                edit_revision=version.edit_revision,
                version_updated_at=version.updated_at,
                is_featured=version.is_featured,
            )
        from webpages.theme_widgets import empty_widget_types, iter_widgets, object_widget_theme

        if any(iter_widgets(version.widgets if version else {})):
            theme = object_widget_theme(instance.tenant_id)
            data["theme_widget_types"] = theme.widget_types if theme else empty_widget_types()

        return data

    def validate_object_type_id(self, value):
        """Validate that object type exists and is active"""
        try:
            obj_type = ObjectTypeDefinition.objects.get(id=value)
            if not obj_type.is_active or obj_type.is_deleted:
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
        from webpages.theme_widgets import iter_widgets, object_widget_theme, validate_instances

        if not any(iter_widgets(value)):
            return value
        tenant = self._tenant()
        try:
            validate_instances(object_widget_theme(tenant.pk) if tenant else None, value)
        except ValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value

    def validate_relationships(self, value):
        """Validate relationships field"""
        if not isinstance(value, list):
            raise serializers.ValidationError("Relationships must be a list")

        # Validate each relationship object
        for idx, rel in enumerate(value):
            if not isinstance(rel, dict):
                raise serializers.ValidationError(f"Relationship at index {idx} must be an object")

            # Check required fields
            if "type" not in rel:
                raise serializers.ValidationError(f"Relationship at index {idx} missing 'type' field")
            if "object_id" not in rel:
                raise serializers.ValidationError(f"Relationship at index {idx} missing 'object_id' field")

            tenant = self._tenant()
            # Object relationships are tenant-local. A global lookup here used
            # to permit cross-workspace references that restore could later
            # delete or leave dangling.
            if (
                tenant is None
                or not ObjectInstance.objects.filter(
                    id=rel["object_id"], tenant=tenant, is_deleted=False, object_type__is_deleted=False
                ).exists()
            ):
                raise serializers.ValidationError(f"ObjectInstance with id {rel['object_id']} does not exist")

            # Prevent self-reference (will be checked in validate() with instance context)

        return value

    def validate(self, attrs):
        """Cross-field validation"""
        tenant = self._tenant()
        if attrs.get("parent") and (tenant is None or attrs["parent"].tenant_id != tenant.id):
            raise serializers.ValidationError({"parent": "Parent must belong to the same workspace"})

        # Validate parent-child relationship
        if attrs.get("parent") and attrs.get("object_type_id"):
            parent = attrs["parent"]
            object_type = ObjectTypeDefinition.objects.get(id=attrs["object_type_id"])

            if not parent.object_type.can_have_child_type(object_type):
                raise serializers.ValidationError(
                    {"parent": f"Object type '{object_type.name}' cannot be a child of '{parent.object_type.name}'"}
                )

        # Validate data against schema if object type is provided
        if attrs.get("object_type_id") and attrs.get("data"):
            object_type = ObjectTypeDefinition.objects.get(id=attrs["object_type_id"])
            self._validate_data_against_schema(attrs["data"], object_type)

        # Validate widgets against slots if object type is provided
        if attrs.get("object_type_id") and attrs.get("widgets"):
            object_type = ObjectTypeDefinition.objects.get(id=attrs["object_type_id"])
            self._validate_widgets_against_slots(attrs["widgets"], object_type)

        # Validate relationships don't reference self
        if attrs.get("relationships") and self.instance:
            for rel in attrs["relationships"]:
                if rel.get("object_id") == self.instance.id:
                    raise serializers.ValidationError({"relationships": "Cannot create relationship to self"})

        return attrs

    def _tenant(self):
        request = self.context.get("request")
        if request is not None and getattr(request, "tenant", None) is not None:
            return request.tenant
        return getattr(self.instance, "tenant", None)

    def _validate_data_against_schema(self, data, object_type):
        """Validate data against object type schema"""
        schema_fields = object_type.get_schema_fields()

        for field_def in schema_fields:
            field_name = field_def["name"]
            field_required = field_def.get("required", False)

            if field_required and (field_name not in data or not data[field_name]):
                raise serializers.ValidationError({"data": f"Required field '{field_name}' is missing or empty"})

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

    @transaction.atomic
    def create(self, validated_data):
        """Create new object instance with version tracking"""
        user = self.context["request"].user

        # Extract data and widgets from validated_data
        classification_ids = validated_data.pop("classification_ids", None)
        data = validated_data.pop("data", {})
        widgets = validated_data.pop("widgets", {})

        validated_data["created_by"] = user
        try:
            instance = super().create(validated_data)
            # Include initial widgets in the same transaction as the object itself.
            instance.create_version(
                user, data=data, widgets=widgets, change_description="Initial version", sync_relationships=False
            )
        except ValidationError as exc:
            raise serializers.ValidationError({"widgets": exc.messages}) from exc

        if classification_ids is not None:
            from taxonomy.assignments import replace_assignments

            replace_assignments(instance.current_version, classification_ids, user)

        return instance

    @transaction.atomic
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
            version_widgets = new_widgets if new_widgets is not None else instance.widgets

            try:
                instance.create_version(
                    user,
                    data=version_data,
                    widgets=version_widgets,
                    change_description="Update via API",
                )
            except ValidationError as exc:
                raise serializers.ValidationError({"widgets": exc.messages}) from exc

        return instance


class ObjectInstanceListSerializer(serializers.ModelSerializer):
    """Simplified serializer for object instance lists"""

    classification_ids = serializers.SerializerMethodField()
    data = serializers.SerializerMethodField()

    def get_data(self, obj):
        # The browser only needs fields selected for its rows, not the full version payload.
        selected = [
            key[6:] for key in browser_config(obj.object_type).get("list_fields", []) if key.startswith("field:")
        ]
        values = obj.data or {}
        return {key: values[key] for key in selected if key in values}

    def get_classification_ids(self, obj):
        from taxonomy.assignments import classification_ids

        return classification_ids(obj.current_version) if obj.current_version else []

    object_type_name = serializers.CharField(source="object_type.name", read_only=True)
    object_type_label = serializers.CharField(source="object_type.label", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    status = serializers.SerializerMethodField()
    is_published = serializers.SerializerMethodField()
    parent_title = serializers.CharField(source="parent.title", read_only=True)

    class Meta:
        model = ObjectInstance
        fields = [
            "classification_ids",
            "data",
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

    def get_status(self, obj):
        return obj.get_publication_status()

    def get_is_published(self, obj):
        """Return publication status"""
        return obj.is_published()


class ObjectVersionSerializer(serializers.ModelSerializer):
    """Serializer for Object Versions with enhanced publication support"""

    classification_ids = serializers.SerializerMethodField()

    def get_classification_ids(self, obj):
        from taxonomy.assignments import classification_ids

        return classification_ids(obj)

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
            "classification_ids",
            "object_instance",
            "version_number",
            "title",
            "updated_at",
            "edit_revision",
            "data",
            "widgets",
            "created_by",
            "created_at",
            "change_description",
            # New publication fields
            "effective_date",
            "expiry_date",
            "is_featured",
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
            "title",
            "updated_at",
            "edit_revision",
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

    def validate_widgets(self, value):
        if self.instance:
            from django.core.exceptions import ValidationError as DjangoValidationError

            from webpages.models import PageTheme
            from webpages.theme_widgets import validate_instances

            theme = PageTheme.objects.filter(
                tenant=self.instance.object_instance.tenant, is_default=True, is_active=True
            ).first()
            try:
                validate_instances(theme, value)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.messages) from exc
        return value

    def validate_data(self, value):
        """Validate data field including object_reference fields"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Data must be a JSON object")

        # Get the object instance from context or instance
        object_instance = self.instance.object_instance if self.instance else None

        # If we don't have an object instance yet, we can't validate object_reference fields
        if not object_instance:
            return value

        # Get schema fields
        schema_fields = object_instance.object_type.get_schema_fields()

        # Validate object_reference fields
        from utils.schema_system import validate_object_reference, validate_reverse_object_reference

        for field_def in schema_fields:
            field_name = field_def.get("name")
            field_type = field_def.get("type")

            if field_type == "object_reference":
                field_value = value.get(field_name)
                try:
                    validate_object_reference(field_value, field_def)
                except ValidationError as e:
                    raise serializers.ValidationError({field_name: str(e)})

            elif field_type == "reverse_object_reference":
                field_value = value.get(field_name)
                # Only validate if the field is present in the data
                if field_name in value:
                    try:
                        validate_reverse_object_reference(field_value, field_def)
                    except ValidationError as e:
                        raise serializers.ValidationError({field_name: str(e)})

        return value

    def to_representation(self, instance):
        """
        Add reverse reference fields to representation.
        Populates reverse_object_reference fields dynamically.
        """
        data = super().to_representation(instance)

        # Populate reverse references
        instance.populate_reverse_references()

        # Update data field with populated values
        data["data"] = instance.data
        from webpages.theme_widgets import empty_widget_types, iter_widgets, object_widget_theme

        if any(iter_widgets(instance.widgets)):
            theme = object_widget_theme(instance.object_instance.tenant_id)
            data["theme_widget_types"] = theme.widget_types if theme else empty_widget_types()
        return data


class ObjectVersionListSerializer(serializers.ModelSerializer):
    """Simplified serializer for object version lists"""

    object_title = serializers.CharField(source="object_instance.title", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True)
    publication_status = serializers.SerializerMethodField()
    is_current_published = serializers.SerializerMethodField()

    class Meta:
        model = ObjectVersion
        fields = [
            "id",
            "object_instance",
            "object_title",
            "version_number",
            "title",
            "updated_at",
            "edit_revision",
            "created_by_name",
            "created_at",
            "change_description",
            "effective_date",
            "expiry_date",
            "is_featured",
            "publication_status",
            "is_current_published",
        ]
        read_only_fields = [
            "id",
            "object_instance",
            "version_number",
            "title",
            "updated_at",
            "edit_revision",
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
