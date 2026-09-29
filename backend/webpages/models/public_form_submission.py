import uuid

from django.db import models


class PublicFormSubmission(models.Model):
    """A validated submission received by the standalone public publisher."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "core.Tenant",
        on_delete=models.CASCADE,
        related_name="public_form_submissions",
    )
    page = models.ForeignKey(
        "webpages.WebPage",
        on_delete=models.CASCADE,
        related_name="public_form_submissions",
    )
    # Keep the published version identity even when routine version compaction
    # deletes the corresponding PageVersion row.
    page_version_id = models.PositiveBigIntegerField()
    widget_id = models.CharField(max_length=255)
    form_title = models.CharField(max_length=255, blank=True, default="")
    data = models.JSONField(default=dict)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=["tenant", "-submitted_at"], name="form_submit_tenant_time_idx"),
            models.Index(fields=["page", "widget_id", "-submitted_at"], name="form_submit_page_widget_idx"),
        ]

    def __str__(self):
        return f"{self.page_id}:{self.widget_id}:{self.id}"
