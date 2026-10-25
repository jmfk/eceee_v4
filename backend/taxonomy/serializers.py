from rest_framework import serializers

from .models import ClassificationGrant, ClassificationOperation, ClassificationProposal, ClassificationType, Tag
from .services import permissions_for


class ClassificationTypeSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = ClassificationType
        fields = [
            "id",
            "namespace",
            "key",
            "name",
            "description",
            "sort_order",
            "allowed_uses",
            "revision",
            "permissions",
        ]
        read_only_fields = ["id", "revision"]

    def validate_allowed_uses(self, value):
        import re

        if not isinstance(value, list) or any(
            not isinstance(item, str)
            or (
                item not in {"pages", "media_files", "media_collections"}
                and not re.fullmatch(r"object:[1-9][0-9]*", item)
            )
            for item in value
        ):
            raise serializers.ValidationError("Choose pages, media_files, media_collections or object:<type-id>.")
        return list(dict.fromkeys(value))

    def validate(self, attrs):
        if "name" in attrs:
            attrs["name"] = attrs["name"].strip()
            if not attrs["name"]:
                raise serializers.ValidationError({"name": "Enter a tag type name."})
        name = attrs.get("name", self.instance.name if self.instance else None)
        namespace = attrs.get("namespace", self.instance.namespace if self.instance else None)
        name_changed = self.instance is None or ("name" in attrs and name.casefold() != self.instance.name.casefold())
        if name and namespace and name_changed:
            duplicate = ClassificationType.objects.filter(
                tenant=self.context["request"].tenant,
                namespace=namespace,
                name__iexact=name.strip(),
            )
            if self.instance:
                duplicate = duplicate.exclude(pk=self.instance.pk)
            if duplicate.exists():
                raise serializers.ValidationError(
                    {"name": "A tag type with this name already exists in this namespace."}
                )
        return attrs

    def get_permissions(self, instance):
        return sorted(permissions_for(self.context["request"].user, instance))


class TermSerializer(serializers.ModelSerializer):
    path = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = [
            "id",
            "namespace",
            "classification_type",
            "tag_type",
            "name",
            "slug",
            "description",
            "color",
            "alternative_names",
            "parent",
            "status",
            "revision",
            "merged_into",
            "path",
        ]
        read_only_fields = fields

    def get_path(self, term):
        type_name = term.classification_type.name if term.classification_type_id else None
        names, seen = [], set()
        while term and term.pk not in seen:
            seen.add(term.pk)
            names.append(term.name)
            term = term.parent
        return " / ".join(([type_name] if type_name else []) + list(reversed(names)))


class ProposalSerializer(serializers.ModelSerializer):
    term = TermSerializer(read_only=True)

    class Meta:
        model = ClassificationProposal
        fields = [
            "id",
            "classification_type",
            "term",
            "action",
            "payload",
            "base_revisions",
            "status",
            "proposed_by",
            "decided_by",
            "reason",
            "created_at",
            "decided_at",
        ]
        read_only_fields = fields


class OperationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassificationOperation
        fields = [
            "id",
            "classification_type",
            "action",
            "actor",
            "proposal",
            "before",
            "after",
            "type_revision",
            "restores",
            "created_at",
        ]
        read_only_fields = fields


class GrantSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ClassificationGrant
        fields = ["id", "classification_type", "user", "username", "permissions"]
        read_only_fields = ["id"]


class ClassificationIdsField(serializers.ListField):
    """The wire field classification_ids maps explicitly to ordered relation rows."""

    child = serializers.UUIDField()

    def get_attribute(self, instance):
        return instance

    def to_representation(self, instance):
        from .assignments import classification_ids

        return classification_ids(instance)
