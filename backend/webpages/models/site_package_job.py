"""
Site package export/import job tracking.
"""

import uuid
from django.db import models
from django.contrib.auth.models import User


class SitePackageJob(models.Model):
    """Tracks asynchronous ZIP site export/import jobs."""

    KIND_EXPORT = "export"
    KIND_IMPORT = "import"
    KIND_CHOICES = [
        (KIND_EXPORT, "Export"),
        (KIND_IMPORT, "Import"),
    ]

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
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    root_page = models.ForeignKey(
        "webpages.WebPage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="site_package_jobs",
    )
    imported_root_page = models.ForeignKey(
        "webpages.WebPage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="site_package_import_jobs",
    )
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="site_package_jobs"
    )
    object_key = models.CharField(
        max_length=500,
        blank=True,
        help_text="Object-store key for generated export ZIP or staged import ZIP.",
    )
    progress = models.JSONField(default=dict, blank=True)
    errors = models.JSONField(default=list, blank=True)
    options = models.JSONField(default=dict, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["kind", "status"], name="sitepkg_kind_status_idx"),
            models.Index(fields=["created_by", "created_at"], name="sitepkg_user_idx"),
            models.Index(fields=["expires_at"], name="sitepkg_expires_idx"),
        ]

    def __str__(self):
        return f"{self.kind} {self.id} ({self.status})"

    def mark_running(self):
        self.status = self.STATUS_RUNNING
        self.save(update_fields=["status", "updated_at"])

    def mark_completed(self, **updates):
        for field, value in updates.items():
            setattr(self, field, value)
        self.status = self.STATUS_COMPLETED
        update_fields = ["status", "updated_at", *updates.keys()]
        self.save(update_fields=update_fields)

    def mark_failed(self, error):
        errors = self.errors or []
        errors.append(str(error))
        self.errors = errors
        self.status = self.STATUS_FAILED
        self.save(update_fields=["errors", "status", "updated_at"])
