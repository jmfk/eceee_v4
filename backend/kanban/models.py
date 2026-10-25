"""Tenant-owned Kanban state. Writes go through services under a tenant lock."""

import uuid

from django.conf import settings
from django.db import models


class TenantRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey("core.Tenant", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class Board(TenantRecord):
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="kanban_boards")
    title = models.CharField(max_length=200)
    background_path = models.CharField(max_length=500, blank=True, default="")
    background_content_type = models.CharField(max_length=100, blank=True, default="")
    archived = models.BooleanField(default=False)
    revision = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["created_at", "id"]


class Column(TenantRecord):
    role = models.CharField(max_length=16, blank=True, default="")
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="columns")
    title = models.CharField(max_length=200)
    position = models.PositiveIntegerField(default=0)
    archived = models.BooleanField(default=False)
    revision = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["position", "created_at", "id"]
        indexes = [models.Index(fields=["tenant", "board", "position"])]
        constraints = [
            models.UniqueConstraint(
                fields=["board", "role"], condition=~models.Q(role=""), name="kanban_board_list_role"
            )
        ]


class Label(TenantRecord):
    name = models.CharField(max_length=80)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["tenant", "name"], name="kanban_tenant_label")]


class Card(TenantRecord):
    cover_color = models.CharField(max_length=16, blank=True, default="")
    cover_attachment = models.ForeignKey(
        "Attachment", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    mirror_of = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="mirrors")
    number = models.PositiveIntegerField()
    column = models.ForeignKey(Column, on_delete=models.CASCADE, related_name="cards")
    title = models.CharField(max_length=250)
    description = models.TextField(blank=True)
    checklist = models.JSONField(default=list, blank=True)
    external_references = models.JSONField(default=list, blank=True)
    assignees = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True)
    labels = models.ManyToManyField(Label, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    archived = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)
    revision = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)
    embedding = models.JSONField(default=list, blank=True)
    embedding_revision = models.PositiveIntegerField(default=0)
    embedding_model = models.CharField(max_length=100, blank=True)

    @property
    def short_id(self):
        return f"TASK-{self.number}"

    class Meta:
        ordering = ["position", "created_at", "id"]
        constraints = [models.UniqueConstraint(fields=["tenant", "number"], name="kanban_tenant_card_number")]
        indexes = [models.Index(fields=["tenant", "column", "position"]), models.Index(fields=["tenant", "deadline"])]


class Comment(TenantRecord):
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    body = models.TextField()
    revision = models.PositiveIntegerField(default=1)
    edited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]


class Attachment(TenantRecord):
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name="attachments")
    comment = models.ForeignKey(Comment, null=True, blank=True, on_delete=models.PROTECT)
    filename = models.CharField(max_length=255)
    path = models.CharField(max_length=500)
    content_type = models.CharField(max_length=100)
    size = models.PositiveBigIntegerField()
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="kanban_uploads")
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="kanban_approvals"
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]


class AttachmentImport(TenantRecord):
    attachment = models.ForeignKey(Attachment, on_delete=models.PROTECT, related_name="imports")
    destination = models.CharField(max_length=20)
    destination_id = models.CharField(max_length=100)
    destination_label = models.CharField(max_length=255)
    imported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)


class Activity(TenantRecord):
    board = models.ForeignKey(Board, on_delete=models.CASCADE)
    card = models.ForeignKey(Card, null=True, on_delete=models.CASCADE, related_name="activity")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    kind = models.CharField(max_length=50)
    message = models.TextField()
    changes = models.JSONField(default=dict)
    undo = models.JSONField(default=dict)

    class Meta:
        ordering = ["created_at", "id"]


class Notification(TenantRecord):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    card = models.ForeignKey(Card, on_delete=models.CASCADE)
    message = models.CharField(max_length=500)
    dedupe_key = models.CharField(max_length=200)
    read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["tenant", "user", "dedupe_key"], name="kanban_notification_once")
        ]
