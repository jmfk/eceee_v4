import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class EventRaw(models.Model):
    """
    Stores raw events received from clients or server-side logging.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.ForeignKey(
        "core.Tenant", on_delete=models.CASCADE, related_name="raw_events"
    )
    user_id = models.CharField(max_length=255, db_index=True)  # Anonymized hash
    event_time = models.DateTimeField(default=timezone.now, db_index=True)
    event_type = models.CharField(max_length=50, db_index=True)
    url = models.URLField(max_length=2000, null=True, blank=True)
    referrer = models.URLField(max_length=2000, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["tenant_id", "event_time"]),
        ]
        verbose_name_plural = "raw events"

    def __str__(self):
        return f"{self.event_type} at {self.event_time}"


class PageStats(models.Model):
    """
    Aggregated daily statistics per page.
    """
    date = models.DateField(db_index=True)
    tenant_id = models.ForeignKey(
        "core.Tenant", on_delete=models.CASCADE, related_name="page_stats"
    )
    url = models.URLField(max_length=2000, db_index=True)
    pageviews = models.IntegerField(default=0)
    unique_visitors = models.IntegerField(default=0)
    avg_time_on_page = models.FloatField(default=0.0)  # In seconds
    actions_per_visit = models.FloatField(default=0.0)
    bounce_rate = models.FloatField(default=0.0)  # Percentage
    exit_rate = models.FloatField(default=0.0)    # Percentage

    class Meta:
        unique_together = ("date", "tenant_id", "url")
        indexes = [
            models.Index(fields=["tenant_id", "date"]),
        ]
        verbose_name_plural = "page stats"


class ConversionStats(models.Model):
    """
    Aggregated daily statistics for conversion goals.
    """
    date = models.DateField(db_index=True)
    tenant_id = models.ForeignKey(
        "core.Tenant", on_delete=models.CASCADE, related_name="conversion_stats"
    )
    goal_name = models.CharField(max_length=100, db_index=True)
    impressions = models.IntegerField(default=0)
    conversions = models.IntegerField(default=0)
    conversion_rate = models.FloatField(default=0.0)  # Percentage

    class Meta:
        unique_together = ("date", "tenant_id", "goal_name")
        indexes = [
            models.Index(fields=["tenant_id", "date"]),
        ]
        verbose_name_plural = "conversion stats"


class Experiment(models.Model):
    """
    Definition of an A/B testing experiment.
    """
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("running", "Running"),
        ("paused", "Paused"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant_id = models.ForeignKey(
        "core.Tenant", on_delete=models.CASCADE, related_name="experiments"
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    goal_metric = models.CharField(max_length=100)  # e.g., 'conversion', 'click'

    def __str__(self):
        return self.name


class Variant(models.Model):
    """
    A specific variation in an A/B test.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    experiment = models.ForeignKey(
        Experiment, on_delete=models.CASCADE, related_name="variants"
    )
    name = models.CharField(max_length=255)
    allocation_percent = models.IntegerField(default=50)  # 0-100
    metadata = models.JSONField(default=dict, blank=True)  # Store variant configuration

    def __str__(self):
        return f"{self.experiment.name} - {self.name}"


class Assignment(models.Model):
    """
    Logs which user was assigned to which variant.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    experiment = models.ForeignKey(Experiment, on_delete=models.CASCADE)
    variant = models.ForeignKey(Variant, on_delete=models.CASCADE)
    user_id = models.CharField(max_length=255, db_index=True)
    assigned_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("experiment", "user_id")


class ExperimentMetric(models.Model):
    """
    Cached or aggregated metrics for an experiment variant.
    """
    variant = models.ForeignKey(
        Variant, on_delete=models.CASCADE, related_name="metrics"
    )
    metric_name = models.CharField(max_length=100)
    value = models.FloatField(default=0.0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("variant", "metric_name")

