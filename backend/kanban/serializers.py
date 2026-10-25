from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Activity, Attachment, AttachmentImport, Board, Card, Column, Comment, Label, Notification


class MemberSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "name"]

    def get_name(self, user):
        return user.get_full_name() or user.username


class BoardSerializer(serializers.ModelSerializer):
    has_background = serializers.SerializerMethodField()

    def get_has_background(self, board):
        return bool(board.background_path)

    class Meta:
        model = Board
        fields = ["id", "title", "archived", "revision", "members", "has_background"]


class ColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = Column
        fields = ["id", "board", "title", "position", "archived", "revision", "role"]


class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ["id", "name"]


class CardSerializer(serializers.ModelSerializer):
    board = serializers.UUIDField(source="column.board_id", read_only=True)
    short_id = serializers.CharField(read_only=True)
    content_revision = serializers.SerializerMethodField()

    def get_content_revision(self, card):
        return card.mirror_of.revision if card.mirror_of_id else card.revision

    class Meta:
        model = Card
        fields = [
            "id",
            "short_id",
            "cover_color",
            "cover_attachment",
            "mirror_of",
            "content_revision",
            "board",
            "column",
            "title",
            "description",
            "checklist",
            "external_references",
            "assignees",
            "labels",
            "deadline",
            "archived",
            "position",
            "revision",
            "updated_at",
        ]


class ImportSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttachmentImport
        fields = ["id", "destination", "destination_id", "destination_label", "created_at"]


class AttachmentSerializer(serializers.ModelSerializer):
    imports = ImportSerializer(many=True, read_only=True)

    class Meta:
        model = Attachment
        fields = ["id", "card", "comment", "filename", "content_type", "size", "approved_at", "approved_by", "imports"]


class CommentSerializer(serializers.ModelSerializer):
    author = MemberSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "card", "body", "author", "revision", "created_at", "edited_at"]


class ActivitySerializer(serializers.ModelSerializer):
    actor = MemberSerializer(read_only=True)
    can_undo = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = ["id", "card", "actor", "kind", "message", "changes", "created_at", "can_undo"]

    def get_can_undo(self, event):
        return bool(event.undo)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "card", "message", "read", "created_at"]


class RevisionInput(serializers.Serializer):
    revision = serializers.IntegerField(min_value=1)


class NamedInput(RevisionInput):
    title = serializers.CharField(max_length=200, required=False)
    archived = serializers.BooleanField(required=False)


COVER_COLORS = ["", "slate", "red", "amber", "green", "blue", "purple"]


class DuplicateInput(RevisionInput):
    column = serializers.UUIDField()
    mirror = serializers.BooleanField(default=False)


class CardInput(RevisionInput):
    cover_color = serializers.ChoiceField(choices=COVER_COLORS, required=False)
    cover_attachment = serializers.UUIDField(allow_null=True, required=False)
    title = serializers.CharField(max_length=250, required=False)
    description = serializers.CharField(max_length=100000, allow_blank=True, required=False)
    deadline = serializers.DateTimeField(allow_null=True, required=False)
    archived = serializers.BooleanField(required=False)
    column = serializers.UUIDField(required=False)
    position = serializers.IntegerField(min_value=0, required=False)
    assignees = serializers.ListField(child=serializers.IntegerField(min_value=1), max_length=200, required=False)
    labels = serializers.ListField(child=serializers.UUIDField(), max_length=100, required=False)
    checklist = serializers.ListField(child=serializers.DictField(), max_length=200, required=False)
    external_references = serializers.ListField(child=serializers.DictField(), max_length=100, required=False)

    def validate_checklist(self, items):
        seen = set()
        for item in items:
            fields = ChecklistItem(data=item)
            fields.is_valid(raise_exception=True)
            item.clear()
            item.update(fields.validated_data)
            if item["id"] in seen:
                raise serializers.ValidationError("Checklist item IDs must be unique.")
            seen.add(item["id"])
        return items

    def validate_external_references(self, references):
        result = []
        for item in references:
            fields = ExternalReference(data=item)
            fields.is_valid(raise_exception=True)
            result.append(fields.validated_data)
        return result


class GenerateImageInput(RevisionInput):
    prompt = serializers.CharField(max_length=4000, allow_blank=True, required=False, default="")
    from_content = serializers.BooleanField(default=False)

    def validate(self, data):
        if not data["from_content"] and not data["prompt"].strip():
            raise serializers.ValidationError("Enter a prompt or generate from the board or card content.")
        return data


class ChecklistItem(serializers.Serializer):
    id = serializers.CharField(max_length=100)
    text = serializers.CharField(max_length=1000)
    done = serializers.BooleanField()


class ExternalReference(serializers.Serializer):
    system = serializers.CharField(max_length=100)
    issue_id = serializers.CharField(max_length=100)
    url = serializers.URLField(max_length=1000)


class CommentInput(RevisionInput):
    body = serializers.CharField(max_length=50000)


class ImportInput(RevisionInput):
    destination = serializers.ChoiceField(choices=["media", "designer"])
    namespace = serializers.IntegerField(required=False)
    title = serializers.CharField(max_length=255, required=False)
    tag_ids = serializers.ListField(child=serializers.CharField(max_length=100), required=False)
    classification_ids = serializers.ListField(child=serializers.UUIDField(), required=False, allow_empty=False)
    theme_id = serializers.IntegerField(required=False)
    asset_key = serializers.CharField(max_length=500, required=False)
    draft_version = serializers.IntegerField(min_value=1, required=False)
    target_breakpoint = serializers.CharField(max_length=50, allow_null=True, required=False)

    def validate(self, data):
        required = ["namespace"] if data["destination"] == "media" else ["theme_id", "asset_key", "draft_version"]
        if any(key not in data for key in required):
            raise serializers.ValidationError(f"Required destination fields: {', '.join(required)}")
        return data
