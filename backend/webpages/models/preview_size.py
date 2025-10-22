"""
PreviewSize Model

Global preview size configurations for the page editor preview system.
"""

from django.db import models


class PreviewSize(models.Model):
    """
    Preview size configurations for page editor previews.
    Stores viewport dimensions for different device types.
    """

    name = models.CharField(
        max_length=100,
        help_text="Display name for this preview size (e.g., 'Desktop', 'iPhone 14')",
    )
    width = models.IntegerField(help_text="Viewport width in pixels")
    height = models.IntegerField(
        null=True,
        blank=True,
        help_text="Viewport height in pixels (optional for responsive heights)",
    )
    sort_order = models.IntegerField(
        default=0, help_text="Display order in UI (lower numbers first)"
    )
    is_default = models.BooleanField(
        default=False, help_text="Mark as a default/system preview size"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "Preview Size"
        verbose_name_plural = "Preview Sizes"

    def __str__(self):
        if self.height:
            return f"{self.name} ({self.width}x{self.height})"
        return f"{self.name} ({self.width}px wide)"
