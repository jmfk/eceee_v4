"""Immutable snapshots of a theme's design configuration."""

from django.conf import settings
from django.db import models


class ThemeVersion(models.Model):
    theme = models.ForeignKey("webpages.PageTheme", on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()
    name = models.CharField(max_length=160, blank=True)
    sync_version = models.PositiveIntegerField()
    snapshot = models.JSONField()
    content_hash = models.CharField(max_length=64, db_index=True)
    source = models.CharField(max_length=32, default="web")
    source_label = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_theme_versions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version_number"]
        constraints = [models.UniqueConstraint(fields=["theme", "version_number"], name="unique_theme_version_number")]

    def __str__(self):
        return f"{self.theme.name} v{self.version_number}"
