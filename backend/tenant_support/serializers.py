from rest_framework import serializers

from .models import Instruction, Message, SupportThread


class InstructionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Instruction
        fields = ["id", "title", "description", "transcript", "published_at", "archived", "withdrawn", "video_id"]


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_id = serializers.IntegerField(read_only=True)

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username

    class Meta:
        model = Message
        fields = ["id", "body", "sender_id", "sender_name", "created_at"]


class ThreadSerializer(serializers.ModelSerializer):
    messages = serializers.SerializerMethodField()

    def get_messages(self, obj):
        return MessageSerializer(obj.messages.select_related("sender"), many=True).data

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
        ]


class PublishInput(serializers.Serializer):
    title = serializers.CharField(max_length=150)
    description = serializers.CharField(max_length=4000)
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
    kind = serializers.ChoiceField(choices=["question", "bug"])
    location = serializers.URLField(max_length=2000, allow_blank=True, default="")
    instruction_id = serializers.UUIDField(required=False, allow_null=True)
    video_id = serializers.UUIDField(required=False, allow_null=True)
    request_id = serializers.UUIDField()

    def validate(self, data):
        if data["kind"] == "bug" and not data["location"]:
            raise serializers.ValidationError({"location": "Ange länken till platsen där felet uppstod."})
        if data["kind"] != "bug" and data.get("video_id"):
            raise serializers.ValidationError({"video_id": "Videobilagor används för felrapporter."})
        return data


class ReplyInput(serializers.Serializer):
    body = serializers.CharField(max_length=4000)
    request_id = serializers.UUIDField()


class RoleInput(serializers.Serializer):
    user_id = serializers.IntegerField(min_value=1)
    can_support = serializers.BooleanField()
    can_publish = serializers.BooleanField()


class ArchiveInput(serializers.Serializer):
    archived = serializers.BooleanField()


class InstructionStateInput(serializers.Serializer):
    archived = serializers.BooleanField(required=False)
    withdrawn = serializers.BooleanField(required=False)


class StatusInput(serializers.Serializer):
    status = serializers.ChoiceField(choices=["open", "waiting", "resolved"])
