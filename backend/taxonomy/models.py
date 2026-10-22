import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify


class ClassificationType(models.Model):
    """Stable, namespace-owned definition; tag_type remains the legacy adapter key."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey("core.Tenant", on_delete=models.CASCADE)
    namespace = models.ForeignKey("content.Namespace", on_delete=models.CASCADE)
    key = models.SlugField(max_length=32)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    allowed_uses = models.JSONField(default=list, blank=True)
    revision = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [models.UniqueConstraint(fields=["tenant", "namespace", "key"], name="taxonomy_type_scope_uniq")]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.namespace_id and self.namespace.tenant_id != self.tenant_id:
            raise ValidationError("Classification namespace belongs to another tenant.")
        if not isinstance(self.allowed_uses, list) or any(
            not isinstance(item, str) or not item for item in self.allowed_uses
        ):
            raise ValidationError({"allowed_uses": "Use a list of content kinds or object:<type-id>."})


class Tag(models.Model):
    """Canonical typed tag shared by editorial content and media."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey("core.Tenant", on_delete=models.CASCADE, related_name="taxonomy_tags")
    namespace = models.ForeignKey("content.Namespace", on_delete=models.CASCADE, related_name="taxonomy_tags")
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    tag_type = models.SlugField(max_length=32, default="general", db_index=True)
    classification_type = models.ForeignKey(
        ClassificationType, null=True, blank=True, on_delete=models.PROTECT, related_name="terms"
    )
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="children")
    status = models.CharField(
        max_length=16,
        default="approved",
        choices=[
            ("approved", "Approved"),
            ("proposed", "Proposed"),
            ("rejected", "Rejected"),
            ("archived", "Archived"),
            ("merged", "Merged"),
        ],
    )
    alternative_names = models.JSONField(default=list, blank=True)
    revision = models.PositiveIntegerField(default=1)
    merged_into = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="merged_sources"
    )
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

    def clean(self):
        from django.core.exceptions import ValidationError

        super().clean()
        if self.namespace_id and self.namespace.tenant_id != self.tenant_id:
            raise ValidationError("Tag tenant must match its namespace tenant.")
        if self.classification_type_id:
            definition = self.classification_type
            if (definition.tenant_id, definition.namespace_id, definition.key) != (
                self.tenant_id,
                self.namespace_id,
                self.tag_type,
            ):
                raise ValidationError("Classification type must match term scope and legacy key.")
        if not isinstance(self.alternative_names, list) or any(
            not isinstance(name, str) or not name.strip() for name in self.alternative_names
        ):
            raise ValidationError({"alternative_names": "Use a list of non-empty names."})
        seen = {self.pk}
        node = self.parent
        while node:
            if node.pk in seen:
                raise ValidationError({"parent": "A term cannot be placed below itself."})
            if (node.tenant_id, node.namespace_id, node.tag_type) != (self.tenant_id, self.namespace_id, self.tag_type):
                raise ValidationError({"parent": "Parent must belong to the same classification scope."})
            if node.status != "approved":
                raise ValidationError({"parent": "Parent must be approved."})
            seen.add(node.pk)
            node = node.parent
        if self.merged_into_id:
            target = self.merged_into
            if target.pk == self.pk or (target.tenant_id, target.namespace_id, target.tag_type) != (
                self.tenant_id,
                self.namespace_id,
                self.tag_type,
            ):
                raise ValidationError("Merge target must be another term in the same scope.")

    def __str__(self):
        return f"{self.name} ({self.tag_type})"


class LegacyTagMapping(models.Model):
    """Durable mapping from a legacy content/media tag to its canonical tag."""

    class SourceKind(models.TextChoices):
        CONTENT = "content", "Content tag"
        MEDIA = "media", "Media tag"
        OBJECT = "object", "Legacy classification object"
        TRANSFER = "transfer", "Transferred classification"

    source_kind = models.CharField(max_length=16, choices=SourceKind.choices)
    source_id = models.CharField(max_length=64)
    canonical_tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="legacy_mappings")
    source_name = models.CharField(max_length=255)
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


class ClassificationGrant(models.Model):
    classification_type = models.ForeignKey(ClassificationType, on_delete=models.CASCADE, related_name="grants")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    permissions = models.JSONField(default=list)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["classification_type", "user"], name="taxonomy_grant_user_uniq")]


class ClassificationProposal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    classification_type = models.ForeignKey(ClassificationType, on_delete=models.PROTECT, related_name="proposals")
    term = models.ForeignKey(Tag, on_delete=models.PROTECT, related_name="proposals")
    action = models.CharField(max_length=16)
    payload = models.JSONField(default=dict)
    base_revisions = models.JSONField(default=dict)
    status = models.CharField(
        max_length=16,
        default="pending",
        choices=[
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("withdrawn", "Withdrawn"),
        ],
    )
    proposed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="classification_proposals"
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, related_name="classification_decisions"
    )
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True)

    class Meta:
        ordering = ["-created_at"]


class ClassificationOperation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    classification_type = models.ForeignKey(ClassificationType, on_delete=models.PROTECT, related_name="operations")
    action = models.CharField(max_length=16)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    proposal = models.ForeignKey(ClassificationProposal, on_delete=models.PROTECT, null=True)
    before = models.JSONField(default=dict)
    after = models.JSONField(default=dict)
    type_revision = models.PositiveIntegerField()
    restores = models.OneToOneField("self", null=True, on_delete=models.PROTECT, related_name="restoration")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ObjectVersionTag(models.Model):
    object_version = models.ForeignKey(
        "object_storage.ObjectVersion", on_delete=models.CASCADE, related_name="canonical_tag_links"
    )
    tag = models.ForeignKey(Tag, on_delete=models.PROTECT, related_name="object_version_links")
    position = models.PositiveIntegerField()

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["object_version", "tag"], name="taxonomy_object_term_uniq"),
            models.UniqueConstraint(fields=["object_version", "position"], name="taxonomy_object_position_uniq"),
        ]


class MediaFileClassification(models.Model):
    media_file = models.ForeignKey(
        "file_manager.MediaFile", on_delete=models.CASCADE, related_name="classification_links"
    )
    tag = models.ForeignKey(Tag, on_delete=models.PROTECT, related_name="media_file_classification_links")
    position = models.PositiveIntegerField()

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["media_file", "tag"], name="taxonomy_media_term_uniq"),
            models.UniqueConstraint(fields=["media_file", "position"], name="taxonomy_media_position_uniq"),
        ]


class MediaCollectionClassification(models.Model):
    collection = models.ForeignKey(
        "file_manager.MediaCollection", on_delete=models.CASCADE, related_name="classification_links"
    )
    tag = models.ForeignKey(Tag, on_delete=models.PROTECT, related_name="collection_classification_links")
    position = models.PositiveIntegerField()

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["collection", "tag"], name="taxonomy_collection_term_uniq"),
            models.UniqueConstraint(fields=["collection", "position"], name="taxonomy_collection_position_uniq"),
        ]


class ClassificationRollout(models.Model):
    """An explicit namespace cutover, separate from additive schema migration."""

    namespace = models.OneToOneField("content.Namespace", on_delete=models.PROTECT, primary_key=True)
    phase = models.CharField(
        max_length=16, default="legacy", choices=[("legacy", "Legacy"), ("canonical", "Canonical")]
    )
    verified_run = models.ForeignKey(TagBackfillRun, null=True, on_delete=models.PROTECT)
    activated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT)
    activated_at = models.DateTimeField(null=True)
