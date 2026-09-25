import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Tag(models.Model):
    """Canonical typed tag shared by editorial content and media."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey("core.Tenant", on_delete=models.CASCADE, related_name="taxonomy_tags")
    namespace = models.ForeignKey("content.Namespace", on_delete=models.CASCADE, related_name="taxonomy_tags")
    name = models.CharField(max_length=50)
    slug = models.SlugField(max_length=50)
    tag_type = models.SlugField(max_length=32, default="general", db_index=True)
    color = models.CharField(max_length=7, default="#3B82F6")
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_taxonomy_tags",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "namespace", "tag_type", "slug"],
                name="taxonomy_tag_identity_uniq",
            ),
            models.CheckConstraint(
                check=models.Q(namespace__isnull=False),
                name="taxonomy_tag_namespace_required",
            ),
        ]
        indexes = [
            models.Index(
                fields=["tenant", "namespace", "tag_type", "name"],
                name="taxonomy_tag_lookup_idx",
            )
        ]

    def save(self, *args, **kwargs):
        self.name = self.name.strip()
        self.slug = slugify(self.slug or self.name)
        self.tag_type = slugify(self.tag_type or "general") or "general"
        if self.namespace_id and self.tenant_id != self.namespace.tenant_id:
            raise ValueError("Tag tenant must match its namespace tenant")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.tag_type})"


class LegacyTagMapping(models.Model):
    """Durable mapping from a legacy content/media tag to its canonical tag."""

    class SourceKind(models.TextChoices):
        CONTENT = "content", "Content tag"
        MEDIA = "media", "Media tag"

    source_kind = models.CharField(max_length=16, choices=SourceKind.choices)
    source_id = models.CharField(max_length=64)
    canonical_tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="legacy_mappings")
    source_name = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source_kind", "source_id"],
                name="taxonomy_legacy_source_uniq",
            )
        ]


class TagBackfillRun(models.Model):
    """Durable identity and progress for an interruption-safe tag backfill."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        INTERRUPTED = "interrupted", "Interrupted"
        FAILED = "failed", "Failed"
        COMPLETE = "complete", "Complete"

    run_id = models.SlugField(max_length=100, primary_key=True)
    schema_version = models.PositiveSmallIntegerField(default=1)
    source_fingerprint = models.CharField(max_length=71)
    config_fingerprint = models.CharField(max_length=71)
    code_revision = models.CharField(max_length=128)
    total_work_units = models.PositiveIntegerField(default=0)
    completed_work_units = models.PositiveIntegerField(default=0)
    failed_work_units = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    started_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)


class TagBackfillUnit(models.Model):
    """One atomically committed source-object backfill result."""

    class Status(models.TextChoices):
        COMPLETE = "complete", "Complete"
        FAILED = "failed", "Failed"

    run = models.ForeignKey(TagBackfillRun, on_delete=models.CASCADE, related_name="units")
    work_unit_id = models.CharField(max_length=100)
    status = models.CharField(max_length=16, choices=Status.choices)
    payload = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    recorded_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["run", "work_unit_id"],
                name="taxonomy_backfill_unit_uniq",
            )
        ]
        indexes = [models.Index(fields=["run", "status"], name="taxonomy_run_status_idx")]
