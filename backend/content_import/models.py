"""Content Import models for tracking import operations."""

import uuid
from django.db import models
from django.contrib.auth.models import User
from content.models import Namespace


class ImportLog(models.Model):
    """Track content import operations for auditing and debugging."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("partial", "Partial Success"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Import metadata
    source_url = models.URLField(
        max_length=2000, help_text="URL of the imported content"
    )
    slot_name = models.CharField(max_length=100, help_text="Target slot name")
    page_id = models.IntegerField(help_text="Target page ID")
    namespace = models.ForeignKey(
        Namespace,
        on_delete=models.CASCADE,
        help_text="Namespace for imported media files",
    )

    # Import mode
    mode = models.CharField(
        max_length=20,
        choices=[("append", "Append"), ("replace", "Replace")],
        default="append",
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )

    # Results
    widgets_created = models.IntegerField(default=0)
    media_files_imported = models.IntegerField(default=0)
    errors = models.JSONField(default=list, blank=True)
    stats = models.JSONField(
        default=dict,
        blank=True,
        help_text="Statistics about imported content (blocks, tables, images, files)",
    )

    # Processing details
    html_content = models.TextField(
        blank=True, help_text="Original HTML content that was imported"
    )
    extracted_element_info = models.JSONField(
        default=dict,
        blank=True,
        help_text="Information about the extracted element",
    )

    # Timestamps and user
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="content_imports",
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    # Rate limiting support
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_by", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["page_id"]),
        ]

    def __str__(self):
        return f"Import from {self.source_url} to page {self.page_id} - {self.status}"
