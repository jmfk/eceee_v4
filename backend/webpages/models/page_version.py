"""
PageVersion Model

Version control system for pages. Stores complete page state snapshots.
"""

from django.db import models
from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError


class PageVersion(models.Model):
    """
    Version control system for pages. Stores complete page state snapshots.
    Enables rollback, comparison, and change tracking with draft/published workflow.
    """

    page = models.ForeignKey(
        "WebPage", on_delete=models.CASCADE, related_name="versions"
    )
    version_number = models.PositiveIntegerField()
    version_title = models.TextField(
        blank=True, help_text="Description of changes in this version"
    )

    change_summary = models.JSONField(
        default=dict,
        blank=True,
        help_text="Summary of specific changes made in this version",
    )

    meta_title = models.TextField(blank=True, help_text="Meta Title")
    meta_description = models.TextField(
        blank=True, default="", help_text="Meta Description"
    )
    code_layout = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of code-based layout class. Leave blank to inherit from parent",
    )

    # Snapshot of page data at this version
    page_data = models.JSONField(help_text="Serialized page data (excluding widgets)")

    # Widget data for this version
    widgets = models.JSONField(
        default=dict,
        help_text="Widget configuration data for this version (slot_name -> widgets array)",
    )

    theme = models.ForeignKey(
        "PageTheme",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        help_text="Leave blank to inherit from parent",
    )

    # Enhanced CSS injection system
    page_css_variables = models.JSONField(
        default=dict,
        blank=True,
        help_text="Page-specific CSS variables that override theme variables",
    )
    page_custom_css = models.TextField(
        blank=True, help_text="Page-specific custom CSS injected after theme CSS"
    )
    enable_css_injection = models.BooleanField(
        default=True, help_text="Whether to enable dynamic CSS injection for this page"
    )

    # Publishing dates (new date-based system)
    effective_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this version becomes live/published",
        db_index=True,
    )
    expiry_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this version should no longer be live",
        db_index=True,
    )

    # Tags for content organization
    tags = ArrayField(
        models.CharField(max_length=50),
        default=list,
        blank=True,
        help_text="List of tag names for organizing and categorizing page versions",
    )

    # Timestamps and ownership
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    class Meta:
        ordering = ["-version_number"]
        unique_together = ["page", "version_number"]

    def __str__(self):
        return f"{self.version_title} v{self.version_number}"

    def extract_widget_content(self):
        """
        Extract all HTML content from widgets in this version.

        Returns:
            str: Combined HTML content from all widgets
        """
        html_content = []

        # Handle both dict and list formats for widgets
        if isinstance(self.widgets, dict):
            for slot_widgets in self.widgets.values():
                for widget in slot_widgets:
                    # Extract content from widget data based on widget type
                    if widget.get("type") == "Content":
                        if "content" in widget.get("data", {}):
                            html_content.append(widget["data"]["content"])
                    # Add other widget types that may contain HTML content here
        elif isinstance(self.widgets, list):
            for widget in self.widgets:
                # Extract content from widget data based on widget type
                if widget.get("type") == "Content":
                    if "content" in widget.get("data", {}):
                        html_content.append(widget["data"]["content"])
                # Add other widget types that may contain HTML content here

        return "\n".join(html_content)

    def update_media_references(self):
        """
        Update media references for this version's content.
        Should be called whenever widget content changes.
        """
        from file_manager.utils import update_media_references

        # Get old content before save
        if self.pk:
            old_version = PageVersion.objects.get(pk=self.pk)
            old_content = old_version.extract_widget_content()
        else:
            old_content = ""

        new_content = self.extract_widget_content()

        # Update references
        update_media_references(
            content_type="webpage",
            content_id=str(self.page.id),
            old_content=old_content,
            new_content=new_content,
        )

    def save(self, *args, **kwargs):
        """Override save to handle media references"""
        # First do the actual save
        super().save(*args, **kwargs)

        # Then update media references
        self.update_media_references()

    def clean(self):
        """Validate the version data"""
        super().clean()

        # Validate effective and expiry dates
        if (
            self.effective_date
            and self.expiry_date
            and self.effective_date >= self.expiry_date
        ):
            raise ValidationError("Effective date must be before expiry date.")

    # New date-based publishing methods
    def is_published(self, now=None):
        """
        Check if this version is currently published based on dates.

        A version is published if:
        - It has an effective_date that has passed
        - It either has no expiry_date or the expiry_date hasn't passed
        """
        if now is None:
            from django.utils import timezone

            now = timezone.now()

        # Must have an effective date that has passed
        if not self.effective_date or self.effective_date > now:
            return False

        # Must not be expired
        if self.expiry_date and self.expiry_date <= now:
            return False

        return True

    def is_current_published(self, now=None):
        """
        Check if this is the current published version for its page.

        The current published version is the latest published version by effective_date.
        """
        if not self.is_published(now):
            return False

        current_version = self.page.get_current_published_version(now)
        return current_version == self

    def get_publication_status(self, now=None):
        """
        Get a human-readable publication status based on dates.

        Returns: 'draft', 'scheduled', 'published', 'expired'
        """
        if now is None:
            from django.utils import timezone

            now = timezone.now()

        if not self.effective_date:
            return "draft"

        if self.effective_date > now:
            return "scheduled"

        if self.expiry_date and self.expiry_date <= now:
            return "expired"

        return "published"

    def publish(self, user):
        """Publish this version by setting effective_date to now"""
        from django.utils import timezone

        # Set effective_date to now to make this version live
        self.effective_date = timezone.now()
        # Clear expiry_date to make it indefinite (unless already set)
        # Don't override existing expiry_date as it might be intentional
        self.save(update_fields=["effective_date"])

        # Apply the stored page data to the page
        self._apply_version_data()
        if user:  # Only set last_modified_by if user is provided
            self.page.last_modified_by = user
        self.page.save()

        return self

    def _apply_version_data(self):
        """Apply the stored page data to the actual page instance"""
        page_data = self.page_data.copy()

        # Apply page fields
        for field, value in page_data.items():
            if hasattr(self.page, field) and field not in [
                "id",
                "created_at",
                "updated_at",
            ]:
                if field in ["effective_date", "expiry_date"] and value:
                    from django.utils.dateparse import parse_datetime

                    value = parse_datetime(value)
                setattr(self.page, field, value)

        # Note: Widgets are no longer stored as separate model objects
        # They exist only in PageVersion.widgets as JSON data

    def restore(self, user):
        """Restore this version as the current version of the page"""
        # Create a new version from current state first
        self.page.create_version(
            user, "Restored from version {}".format(self.version_number)
        )

        # Apply the stored page data
        self._apply_version_data()
        self.page.last_modified_by = user
        self.page.save()

    def compare_with(self, other_version):
        """Compare this version with another version"""
        if not isinstance(other_version, PageVersion):
            return None

        changes = {
            "fields_changed": [],
            "widgets_added": [],
            "widgets_removed": [],
            "widgets_modified": [],
        }

        # Compare page fields
        for field, value in self.page_data.items():
            if field == "widgets":
                continue
            other_value = other_version.page_data.get(field)
            if value != other_value:
                changes["fields_changed"].append(
                    {"field": field, "old_value": other_value, "new_value": value}
                )

        # Compare widgets
        self_widgets = {(w["slot_name"], w["sort_order"]): w for w in self.widgets}
        other_widgets = {
            (w["slot_name"], w["sort_order"]): w for w in other_version.widgets
        }

        # Find added widgets
        for key, widget in self_widgets.items():
            if key not in other_widgets:
                changes["widgets_added"].append(widget)
            elif widget != other_widgets[key]:
                changes["widgets_modified"].append(
                    {"old": other_widgets[key], "new": widget}
                )

        # Find removed widgets
        for key, widget in other_widgets.items():
            if key not in self_widgets:
                changes["widgets_removed"].append(widget)

        return changes

    def create_draft_from_published(self, user, version_title=""):
        """Create a new draft version based on this published version"""
        if not self.is_published():
            raise ValueError("Can only create drafts from published versions")

        # Get next version number
        latest_version = self.page.versions.order_by("-version_number").first()
        version_number = (latest_version.version_number + 1) if latest_version else 1

        # Create new draft version (no effective_date = draft)
        draft = PageVersion.objects.create(
            page=self.page,
            version_number=version_number,
            version_title=version_title
            or f"Draft based on version {self.version_number}",
            page_data=self.page_data.copy(),
            widgets=self.widgets.copy() if self.widgets else {},
            created_by=user,
        )

        return draft
