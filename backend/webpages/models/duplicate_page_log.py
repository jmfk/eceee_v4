"""
Model for tracking duplicate page occurrences.

This model logs when multiple pages with the same slug are found under the same parent,
which can happen in the system now that unique_together constraint has been relaxed.
"""

from django.db import models
from django.utils import timezone


class DuplicatePageLog(models.Model):
    """
    Track instances where multiple pages with the same slug exist under the same parent.

    Used for monitoring data quality and generating administrative reports.
    """

    parent = models.ForeignKey(
        "WebPage",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="duplicate_logs",
        help_text="Parent page where duplicates were found (null for root pages)",
    )

    slug = models.CharField(max_length=255, help_text="The slug that has duplicates")

    page_ids = models.JSONField(
        help_text="List of page IDs that were found as duplicates"
    )

    first_seen = models.DateTimeField(
        auto_now_add=True, help_text="When this duplicate was first detected"
    )

    last_seen = models.DateTimeField(
        auto_now=True, help_text="Most recent time this duplicate was encountered"
    )

    occurrence_count = models.IntegerField(
        default=1, help_text="Number of times this duplicate has been encountered"
    )

    resolved = models.BooleanField(
        default=False,
        help_text="Whether this duplicate has been resolved (e.g., pages merged or deleted)",
    )

    email_sent = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When an email notification was last sent about this duplicate",
    )

    notes = models.TextField(
        blank=True, help_text="Administrative notes about this duplicate"
    )

    class Meta:
        db_table = "webpages_duplicate_page_log"
        verbose_name = "Duplicate Page Log"
        verbose_name_plural = "Duplicate Page Logs"
        ordering = ["-last_seen"]
        indexes = [
            models.Index(fields=["slug", "parent"]),
            models.Index(fields=["resolved", "-last_seen"]),
            models.Index(fields=["-email_sent"]),
        ]

    def __str__(self):
        parent_info = (
            f"under parent {self.parent.title}" if self.parent else "at root level"
        )
        return f"Duplicate slug '{self.slug}' {parent_info} ({self.occurrence_count} occurrences)"

    def mark_resolved(self, notes=""):
        """Mark this duplicate as resolved with optional notes."""
        self.resolved = True
        if notes:
            self.notes = notes
        self.save(update_fields=["resolved", "notes"])

    def increment_occurrence(self, page_ids=None):
        """Increment the occurrence count and update page_ids if provided."""
        self.occurrence_count += 1
        self.last_seen = timezone.now()
        if page_ids is not None:
            self.page_ids = page_ids
        self.save(update_fields=["occurrence_count", "last_seen", "page_ids"])

    @classmethod
    def log_duplicate(cls, slug, parent=None, page_ids=None):
        """
        Log a duplicate page occurrence.

        Args:
            slug: The slug that has duplicates
            parent: The parent page (None for root level)
            page_ids: List of page IDs that were found

        Returns:
            DuplicatePageLog instance
        """
        # Try to find existing log entry
        log_entry, created = cls.objects.get_or_create(
            slug=slug,
            parent=parent,
            resolved=False,
            defaults={"page_ids": page_ids or []},
        )

        if not created:
            # Update existing entry
            log_entry.increment_occurrence(page_ids)

        return log_entry
