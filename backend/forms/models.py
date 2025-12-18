import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from core.models import Tenant

class FormFieldType(models.Model):
    """
    Defines a reusable field type (either core or custom).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.SlugField(max_length=100, unique=True, help_text="Unique identifier for the field type")
    label = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # base_type: text, number, email, select, etc.
    base_type = models.CharField(max_length=50, help_text="The underlying primitive field type")
    
    # configuration: default labels, validation rules, UI props
    config = models.JSONField(default=dict, help_text="Default configuration for this field type")
    
    is_custom = models.BooleanField(default=True, help_text="True if created by admin, False if built-in")
    is_active = models.BooleanField(default=True)
    
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="form_field_types",
        null=True, blank=True # Null for system-wide built-ins
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["label"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return self.label

class Form(models.Model):
    """
    Defines a dynamic form with fields, actions, and conditional logic.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.SlugField(max_length=100, unique=True, help_text="Unique identifier for the form")
    label = models.CharField(max_length=200, help_text="Display name for the form")
    description = models.TextField(blank=True, help_text="Description of the form's purpose")
    
    # Store fields, actions and logic as JSON
    # fields: list of field objects { id, type, label, defaultValue, validation: {}, ui: {}, ... }
    fields = models.JSONField(default=list, help_text="JSON list of form field definitions")
    
    # actions: list of action objects { type, config: {}, conditions: {} }
    actions = models.JSONField(default=list, help_text="JSON list of actions to trigger on submission")
    
    # conditional_logic: { rules: [ { if: {}, then: {} } ] }
    conditional_logic = models.JSONField(default=dict, blank=True, help_text="Declarative conditional logic rules")
    
    is_active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="forms",
        help_text="Tenant this form belongs to"
    )
    
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="created_forms")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional extensible properties")

    class Meta:
        ordering = ["label"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["tenant"]),
        ]

    def __str__(self):
        return f"{self.label} (v{self.version})"

class FormSubmission(models.Model):
    """
    Stores data submitted via a Form.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="submissions")
    data = models.JSONField(help_text="The submitted form data")
    
    metadata = models.JSONField(default=dict, help_text="Submission metadata (IP, user agent, etc.)")
    
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processed", "Processed"),
        ("error", "Error"),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    processing_log = models.JSONField(default=list, blank=True, help_text="Log of action executions")
    
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="form_submissions"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["form", "created_at"]),
            models.Index(fields=["status"]),
            models.Index(fields=["tenant"]),
        ]

    def __str__(self):
        return f"Submission for {self.form.label} at {self.created_at}"

