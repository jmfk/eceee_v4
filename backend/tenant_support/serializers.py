from rest_framework import serializers

from .models import Instruction, Message, SupportThread, MessageAttachment


class InstructionSerializer(serializers.ModelSerializer):
    help_guide_id = serializers.SerializerMethodField()

    def get_help_guide_id(self, obj):
        # A previous release can still insert NULL while the new schema is deployed.
        return obj.help_guide_id or ""

    class Meta:
        model = Instruction
        fields = [
            "id",
            "title",
            "description",
            "transcript",
            "published_at",
            "archived",
            "withdrawn",
            "video_id",
            "help_guide_id",
        ]


class MessageAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageAttachment
        fields = ["id", "filename", "content_type", "byte_size"]


class MessageSerializer(serializers.ModelSerializer):
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    sender_name = serializers.SerializerMethodField()
    sender_id = serializers.IntegerField(read_only=True)

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username

    class Meta:
        model = Message
        fields = ["id", "body", "sender_id", "sender_name", "created_at", "attachments"]


class ThreadSerializer(serializers.ModelSerializer):
    messages = serializers.SerializerMethodField()

    def get_messages(self, obj):
        return MessageSerializer(obj.messages.select_related("sender").prefetch_related("attachments"), many=True).data

    class Meta:
        model = SupportThread
        fields = [
            "id",
            "title",
            "kind",
            "location",
            "status",
            "creator_id",
            "instruction_id",
            "video_id",
            "created_at",
            "messages",
            "support_target",
            "participants",
            "board_card_id",
        ]


def help_guide_field(**kwargs):
    return serializers.RegexField(r"^[a-z0-9][a-z0-9-]*$", max_length=150, allow_blank=True, **kwargs)


class PublishInput(serializers.Serializer):
    title = serializers.CharField(max_length=150)
    description = serializers.CharField(max_length=4000)
    help_guide_id = help_guide_field(default="")
    transcript = serializers.CharField(max_length=30000, allow_blank=True, default="")
    video_id = serializers.UUIDField()
    request_id = serializers.UUIDField()


class ThreadInput(serializers.Serializer):
    def validate_location(self, value):
        from urllib.parse import urlsplit

        if value and (urlsplit(value).scheme not in {"http", "https"} or urlsplit(value).username):
            raise serializers.ValidationError("Använd en http- eller https-länk utan inloggningsuppgifter.")
        return value

    title = serializers.CharField(max_length=150)
    body = serializers.CharField(max_length=4000)
    kind = serializers.ChoiceField(choices=["question", "bug"], default="question", required=False)
    location = serializers.URLField(max_length=2000, allow_blank=True, default="")
    instruction_id = serializers.UUIDField(required=False, allow_null=True)
    video_id = serializers.UUIDField(required=False, allow_null=True)
    request_id = serializers.UUIDField()
    recipients = serializers.ListField(child=serializers.CharField(max_length=80), max_length=100, default=["support"])
    attachment_ids = serializers.ListField(child=serializers.UUIDField(), max_length=10, default=list)
    diagnostics = serializers.JSONField(required=False)

    def validate(self, data):
        return data


class ReplyInput(serializers.Serializer):
    body = serializers.CharField(max_length=4000)
    attachment_ids = serializers.ListField(child=serializers.UUIDField(), max_length=10, default=list)
    request_id = serializers.UUIDField()


class RoleInput(serializers.Serializer):
    user_id = serializers.IntegerField(min_value=1)
    can_support = serializers.BooleanField()
    can_publish = serializers.BooleanField()


class ArchiveInput(serializers.Serializer):
    archived = serializers.BooleanField()


class InstructionStateInput(serializers.Serializer):
    help_guide_id = help_guide_field(required=False)
    archived = serializers.BooleanField(required=False)
    withdrawn = serializers.BooleanField(required=False)


class StatusInput(serializers.Serializer):
    status = serializers.ChoiceField(choices=["open", "waiting", "resolved"])
