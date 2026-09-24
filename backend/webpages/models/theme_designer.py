"""Models supporting the restricted designer theme workflow."""

import uuid

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models


class ThemeDesignerAssignment(models.Model):
    """Grant a user access to the designer surface for one theme."""

    tenant = models.ForeignKey("core.Tenant", on_delete=models.CASCADE, related_name="theme_designer_assignments")
    theme = models.ForeignKey("webpages.PageTheme", on_delete=models.CASCADE, related_name="designer_assignments")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="theme_designer_assignments")
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="created_theme_designer_assignments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["theme", "user"], name="unique_theme_designer_assignment"),
        ]
        indexes = [
            models.Index(fields=["tenant", "user"], name="theme_designer_tenant_user_idx"),
        ]

    def clean(self):
        if self.theme_id and self.tenant_id and self.theme.tenant_id != self.tenant_id:
            raise ValidationError("The assigned theme must belong to the selected tenant.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ThemeDesignerRevision(models.Model):
    """Recoverable snapshot made immediately before a designer mutation."""

    theme = models.ForeignKey("webpages.PageTheme", on_delete=models.CASCADE, related_name="designer_revisions")
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="theme_designer_revisions")
    snapshot = models.JSONField(default=dict)
    summary = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["theme", "created_at"], name="theme_rev_theme_created_idx")]


class ThemeDesignerDraft(models.Model):
    """Shared staged Designer state for one theme."""

    theme = models.OneToOneField("webpages.PageTheme", on_delete=models.CASCADE, related_name="designer_draft")
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="created_theme_designer_drafts")
    updated_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="updated_theme_designer_drafts")
    base_sync_version = models.PositiveIntegerField()
    version = models.PositiveIntegerField(default=1)
    snapshot = models.JSONField(default=dict)
    has_changes = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ThemeDesignerExportJob(models.Model):
    """Tracks an asynchronous designer ZIP export."""

    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_RUNNING, "Running"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    theme = models.ForeignKey("webpages.PageTheme", on_delete=models.CASCADE, related_name="designer_export_jobs")
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="theme_designer_export_jobs")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    object_key = models.CharField(max_length=500, blank=True)
    progress = models.JSONField(default=dict, blank=True)
    errors = models.JSONField(default=list, blank=True)
    snapshot = models.JSONField(default=dict, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["theme", "status"], name="theme_export_theme_status_idx")]

    def mark_running(self):
        self.status = self.STATUS_RUNNING
        self.save(update_fields=["status", "updated_at"])

    def mark_completed(self, object_key):
        self.status = self.STATUS_COMPLETED
        self.object_key = object_key
        self.progress = {"percent": 100, "message": "Export ready"}
        self.save(update_fields=["status", "object_key", "progress", "updated_at"])

    def mark_failed(self, error):
        self.status = self.STATUS_FAILED
        self.errors = [*self.errors, str(error)]
        self.save(update_fields=["status", "errors", "updated_at"])
