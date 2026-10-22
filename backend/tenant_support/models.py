"""Private tenant instruction and support data; never part of public CMS media."""

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class TenantRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey("core.Tenant", on_delete=models.PROTECT)

    class Meta:
        abstract = True


class SupportRole(TenantRecord):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    can_support = models.BooleanField(default=False)
    can_publish = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["tenant", "user"], name="support_role_tenant_user")]


class PrivateVideo(TenantRecord):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    purpose = models.CharField(max_length=16, choices=[("bug", "Bug"), ("instruction", "Instruction")])
    storage_key = models.CharField(max_length=255, unique=True)
    content_type = models.CharField(max_length=64)
    byte_size = models.PositiveBigIntegerField()
    duration = models.DecimalField(max_digits=12, decimal_places=6)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["tenant", "created_at"], name="support_video_quota_idx")]


class Instruction(TenantRecord):
    title = models.CharField(max_length=150)
    description = models.TextField(max_length=4000)
    transcript = models.TextField(blank=True, max_length=30000)
    help_guide_id = models.CharField(max_length=150, blank=True, default="")
    video = models.OneToOneField(PrivateVideo, on_delete=models.PROTECT)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    published_at = models.DateTimeField(auto_now_add=True)
    archived = models.BooleanField(default=False)
    withdrawn = models.BooleanField(default=False)
    request_id = models.UUIDField()

    class Meta:
        ordering = ["-published_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "author", "request_id"], name="support_publish_request")
        ]
        indexes = [
            models.Index(fields=["tenant", "published_at"], name="support_instruction_idx"),
            models.Index(fields=["tenant", "help_guide_id"], name="support_instruction_guide_idx"),
        ]


class SupportThread(TenantRecord):
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    instruction = models.ForeignKey(Instruction, null=True, blank=True, on_delete=models.PROTECT)
    video = models.OneToOneField(PrivateVideo, null=True, blank=True, on_delete=models.PROTECT)
    title = models.CharField(max_length=150)
    kind = models.CharField(max_length=16, choices=[("question", "Question"), ("bug", "Bug")])
    location = models.URLField(max_length=2000, blank=True)
    status = models.CharField(
        max_length=16, choices=[("open", "Open"), ("waiting", "Waiting"), ("resolved", "Resolved")], default="open"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    request_id = models.UUIDField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "creator", "request_id"], name="support_thread_request")
        ]
        indexes = [models.Index(fields=["tenant", "creator"], name="support_thread_owner_idx")]


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(SupportThread, related_name="messages", on_delete=models.PROTECT)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    body = models.TextField(max_length=4000)
    created_at = models.DateTimeField(auto_now_add=True)
    request_id = models.UUIDField()

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.UniqueConstraint(fields=["thread", "sender", "request_id"], name="support_message_request")
        ]


class InboxEntry(TenantRecord):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    instruction = models.ForeignKey(Instruction, null=True, blank=True, on_delete=models.PROTECT)
    thread = models.ForeignKey(SupportThread, null=True, blank=True, on_delete=models.PROTECT)
    activity_at = models.DateTimeField()
    read_at = models.DateTimeField(null=True, blank=True)
    archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["-activity_at", "-id"]
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(instruction__isnull=False, thread__isnull=True)
                    | Q(instruction__isnull=True, thread__isnull=False)
                ),
                name="support_entry_one_target",
            ),
            models.UniqueConstraint(fields=["user", "instruction"], name="support_entry_instruction"),
            models.UniqueConstraint(fields=["user", "thread"], name="support_entry_thread"),
        ]
        indexes = [models.Index(fields=["tenant", "user", "activity_at"], name="support_inbox_order_idx")]


class EmailDelivery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entry = models.ForeignKey(InboxEntry, on_delete=models.PROTECT, related_name="deliveries")
    event_key = models.CharField(max_length=180, unique=True)
    summary = models.CharField(max_length=200)
    state = models.CharField(max_length=16, default="pending")
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField()
    sent_at = models.DateTimeField(null=True, blank=True)
    error_code = models.CharField(max_length=50, blank=True)

    class Meta:
        indexes = [models.Index(fields=["state", "next_attempt_at"], name="support_email_due_idx")]
