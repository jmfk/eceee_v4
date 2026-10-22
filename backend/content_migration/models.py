import uuid

from django.contrib.auth.models import User
from django.db import models

from core.models import Tenant
from data_connections.models import DataConnection
from object_storage.models import ObjectTypeDefinition


class MigrationPlan(models.Model):
    """
    Blueprint for a migration process.
    Defines where data comes from, what it becomes, and the steps to get there.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="migration_plans", null=True, blank=True)
    source_connection = models.ForeignKey(DataConnection, on_delete=models.CASCADE, related_name="migration_plans")
    query_dsl = models.TextField(blank=True, help_text="DSL or path for retrieving data from source")
    target_object_type = models.ForeignKey(
        ObjectTypeDefinition, on_delete=models.CASCADE, related_name="migration_plans"
    )

    # Workflow steps (list of dicts)
    # E.g., [{"type": "extract_variables", "config": {...}}, {"type": "process_html", "config": {...}}]
    workflow = models.JSONField(default=list, blank=True, help_text="Sequence of steps to process each item")

    # General configuration (batch size, concurrency, etc.)
    config = models.JSONField(
        default=dict, blank=True, help_text="Migration configuration (batch_size, skip_existing, etc.)"
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return self.name


class MigrationJob(models.Model):
    """
    Tracking a specific execution of a migration plan.
    """

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("RUNNING", "Running"),
        ("COMPLETED", "Completed"),
        ("FAILED", "Failed"),
        ("CANCELLED", "Cancelled"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan = models.ForeignKey(MigrationPlan, on_delete=models.CASCADE, related_name="jobs")
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="migration_jobs", null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    total_items = models.IntegerField(default=0)
    processed_items = models.IntegerField(default=0)
    failed_items = models.IntegerField(default=0)
    skipped_items = models.IntegerField(default=0)

    error_log = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"{self.plan.name} - {self.id} ({self.status})"


class MigrationTask(models.Model):
    """
    Individual item processing task within a job.
    Useful for retries and fine-grained tracking.
    """

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("COMPLETED", "Completed"),
        ("FAILED", "Failed"),
        ("SKIPPED", "Skipped"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(MigrationJob, on_delete=models.CASCADE, related_name="tasks")
    source_id = models.CharField(max_length=255, help_text="ID of the item in the source system")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")

    # Store temporary data during processing
    context_data = models.JSONField(default=dict, blank=True)

    error_message = models.TextField(blank=True)

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("job", "source_id")

    def __str__(self):
        return f"Task {self.source_id} for Job {self.job.id}"


class PluginImportJob(models.Model):
    """Observable execution of a code-registered tenant importer."""

    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_RUNNING, "Running"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="plugin_import_jobs")
    importer_id = models.CharField(max_length=200)
    importer_version = models.CharField(max_length=40)
    connection = models.ForeignKey(
        DataConnection,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="plugin_import_jobs",
    )
    idempotency_key = models.UUIDField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    phase = models.CharField(max_length=80, blank=True)
    options = models.JSONField(default=dict, blank=True)
    progress = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)
    errors = models.JSONField(default=list, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="created_plugin_import_jobs")

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "importer_id", "idempotency_key"],
                name="unique_tenant_import_request",
            )
        ]
        indexes = [models.Index(fields=["tenant", "status", "created_at"], name="plugin_import_status_idx")]

    def mark_running(self, phase="starting", **progress):
        from django.utils import timezone

        self.status = self.STATUS_RUNNING
        self.phase = phase
        self.started_at = self.started_at or timezone.now()
        self.progress = {**(self.progress or {}), **progress}
        self.save(update_fields=["status", "phase", "started_at", "progress", "updated_at"])

    def mark_completed(self, result=None, **progress):
        from django.utils import timezone

        self.status = self.STATUS_COMPLETED
        self.phase = "completed"
        self.completed_at = timezone.now()
        self.result = result or {}
        self.progress = {**(self.progress or {}), **progress}
        self.save(update_fields=["status", "phase", "completed_at", "result", "progress", "updated_at"])

    def mark_failed(self, error):
        from django.utils import timezone

        self.status = self.STATUS_FAILED
        self.phase = "failed"
        self.completed_at = timezone.now()
        self.errors = [*(self.errors or []), str(error)[:1000]]
        self.save(update_fields=["status", "phase", "completed_at", "errors", "updated_at"])


class EditorialImportRun(models.Model):
    """Frozen public-source manifest, separate from content activation."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.PROTECT)
    namespace = models.ForeignKey("content.Namespace", on_delete=models.PROTECT)
    source_scope = models.CharField(max_length=255)
    preset = models.CharField(max_length=20)
    configuration = models.JSONField(default=dict)
    manifest_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=20, default="staged")
    report = models.JSONField(default=dict)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)
    reviewed_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.PROTECT, related_name="reviewed_editorial_imports"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class EditorialImportItem(models.Model):
    """One durable, independently retryable manifest entry."""

    run = models.ForeignKey(EditorialImportRun, on_delete=models.PROTECT, related_name="items")
    resource = models.CharField(max_length=32)
    source_id = models.CharField(max_length=64)
    record = models.JSONField()
    source_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=20, default="pending")
    error_category = models.CharField(max_length=100, blank=True)
    object_instance = models.ForeignKey(
        "object_storage.ObjectInstance", null=True, blank=True, on_delete=models.PROTECT
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["run", "resource", "source_id"], name="editorial_run_source_uniq")
        ]
        indexes = [models.Index(fields=["run", "status"], name="editorial_run_status_idx")]


class EditorialImportBinding(models.Model):
    """Stable destination identity and last untouched imported content baseline."""

    tenant = models.ForeignKey(Tenant, on_delete=models.PROTECT)
    namespace = models.ForeignKey("content.Namespace", on_delete=models.PROTECT)
    source_scope = models.CharField(max_length=255)
    resource = models.CharField(max_length=32)
    source_id = models.CharField(max_length=64)
    object_instance = models.ForeignKey("object_storage.ObjectInstance", on_delete=models.PROTECT)
    source_hash = models.CharField(max_length=64)
    target_hash = models.CharField(max_length=64)
    source_url = models.URLField(max_length=2000, blank=True)
    last_run = models.ForeignKey(EditorialImportRun, on_delete=models.PROTECT)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "namespace", "source_scope", "resource", "source_id"],
                name="editorial_binding_identity_uniq",
            )
        ]
