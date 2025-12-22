from django.db import models
from django.contrib.auth.models import User
from data_connections.models import DataConnection
from object_storage.models import ObjectTypeDefinition
from core.models import Tenant
import uuid


class MigrationPlan(models.Model):
    """
    Blueprint for a migration process.
    Defines where data comes from, what it becomes, and the steps to get there.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE, related_name="migration_plans", null=True, blank=True
    )
    source_connection = models.ForeignKey(
        DataConnection, on_delete=models.CASCADE, related_name="migration_plans"
    )
    query_dsl = models.TextField(
        blank=True, 
        help_text="DSL or path for retrieving data from source"
    )
    target_object_type = models.ForeignKey(
        ObjectTypeDefinition, on_delete=models.CASCADE, related_name="migration_plans"
    )
    
    # Workflow steps (list of dicts)
    # E.g., [{"type": "extract_variables", "config": {...}}, {"type": "process_html", "config": {...}}]
    workflow = models.JSONField(
        default=list, 
        help_text="Sequence of steps to process each item"
    )
    
    # General configuration (batch size, concurrency, etc.)
    config = models.JSONField(
        default=dict,
        help_text="Migration configuration (batch_size, skip_existing, etc.)"
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
    plan = models.ForeignKey(
        MigrationPlan, on_delete=models.CASCADE, related_name="jobs"
    )
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE, related_name="migration_jobs", null=True, blank=True
    )
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
    job = models.ForeignKey(
        MigrationJob, on_delete=models.CASCADE, related_name="tasks"
    )
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
