"""
Web Page Publishing System Models

This module defines the core models for the hierarchical web page management system:
- WebPage: Core page entity with hierarchy support
- PageVersion: Version control for pages
- PageLayout: Layout templates with slot definitions
- PageTheme: Theme configurations for styling
- WidgetType: Available widget types with schemas
- PageWidget: Widget instances on pages
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.urls import reverse
from django.core.exceptions import ValidationError
import json


class PageLayout(models.Model):
    """
    Layout templates that define the structure and slots available on pages.
    Layouts can be inherited through the page hierarchy.
    """

    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    slot_configuration = models.JSONField(
        help_text="JSON defining available slots and their properties"
    )
    css_classes = models.TextField(
        blank=True, help_text="CSS classes to apply to pages using this layout"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class PageTheme(models.Model):
    """
    Theme configurations for page styling including colors, fonts, and CSS.
    Themes can be inherited through the page hierarchy.
    """

    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    css_variables = models.JSONField(help_text="JSON object with CSS custom properties")
    custom_css = models.TextField(
        blank=True, help_text="Additional custom CSS for this theme"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class WidgetType(models.Model):
    """
    Defines available widget types with their JSON schemas for validation.
    Widget types determine what fields are available for content input.
    """

    name = models.CharField(max_length=255, unique=True)
    description = models.TextField()
    json_schema = models.JSONField(
        help_text="JSON schema defining the widget's configuration fields"
    )
    template_name = models.CharField(
        max_length=255, help_text="Template file used to render this widget type"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class WebPage(models.Model):
    """
    Core page entity supporting hierarchical organization and inheritance.
    Pages can have parent-child relationships for content organization.
    """

    PUBLICATION_STATUS_CHOICES = [
        ("unpublished", "Unpublished"),
        ("scheduled", "Scheduled"),
        ("published", "Published"),
        ("expired", "Expired"),
    ]

    # Basic page information
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True)

    # Hierarchy support
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )
    sort_order = models.IntegerField(default=0)

    # Layout and theme (with inheritance)
    layout = models.ForeignKey(
        PageLayout,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        help_text="Leave blank to inherit from parent",
    )
    theme = models.ForeignKey(
        PageTheme,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        help_text="Leave blank to inherit from parent",
    )

    # Publishing control
    publication_status = models.CharField(
        max_length=20, choices=PUBLICATION_STATUS_CHOICES, default="unpublished"
    )
    effective_date = models.DateTimeField(
        null=True, blank=True, help_text="When this page should become public"
    )
    expiry_date = models.DateTimeField(
        null=True, blank=True, help_text="When this page should no longer be public"
    )

    # SEO and metadata
    meta_title = models.CharField(max_length=255, blank=True)
    meta_description = models.TextField(blank=True)
    meta_keywords = models.CharField(max_length=500, blank=True)

    # Object publishing support
    linked_object_type = models.CharField(
        max_length=50, blank=True, help_text="Content type for object-based pages"
    )
    linked_object_id = models.PositiveIntegerField(
        null=True, blank=True, help_text="ID of the linked object"
    )

    # Timestamps and ownership
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="created_pages"
    )
    last_modified_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="modified_pages"
    )

    class Meta:
        ordering = ["sort_order", "title"]
        unique_together = ["parent", "slug"]

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        """Generate the public URL for this page"""
        if self.parent:
            return f"{self.parent.get_absolute_url()}/{self.slug}/"
        return f"/{self.slug}/"

    def get_effective_layout(self):
        """Get the layout for this page, inheriting from parent if needed"""
        if self.layout:
            return self.layout
        elif self.parent:
            return self.parent.get_effective_layout()
        return None

    def get_effective_theme(self):
        """Get the theme for this page, inheriting from parent if needed"""
        if self.theme:
            return self.theme
        elif self.parent:
            return self.parent.get_effective_theme()
        return None

    def is_published(self):
        """Check if this page should be visible to the public"""
        now = timezone.now()

        if self.publication_status != "published":
            return False

        if self.effective_date and self.effective_date > now:
            return False

        if self.expiry_date and self.expiry_date <= now:
            return False

        return True

    def get_breadcrumbs(self):
        """Get list of pages from root to this page for breadcrumb navigation"""
        breadcrumbs = []
        current = self
        while current:
            breadcrumbs.insert(0, current)
            current = current.parent
        return breadcrumbs

    def clean(self):
        """Validate the page data"""
        super().clean()

        # Prevent circular parent relationships
        if self.parent:
            current = self.parent
            while current:
                if current == self:
                    raise ValidationError("A page cannot be its own ancestor.")
                current = current.parent

        # Validate effective and expiry dates
        if (
            self.effective_date
            and self.expiry_date
            and self.effective_date >= self.expiry_date
        ):
            raise ValidationError("Effective date must be before expiry date.")


class PageVersion(models.Model):
    """
    Version control system for pages. Stores complete page state snapshots.
    Enables rollback, comparison, and change tracking.
    """

    page = models.ForeignKey(WebPage, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()

    # Snapshot of page data at this version
    page_data = models.JSONField(
        help_text="Complete serialized page data including widgets"
    )

    # Version metadata
    description = models.TextField(
        blank=True, help_text="Description of changes in this version"
    )
    is_current = models.BooleanField(
        default=False, help_text="Whether this is the currently active version"
    )

    # Timestamps and ownership
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    class Meta:
        ordering = ["-version_number"]
        unique_together = ["page", "version_number"]

    def __str__(self):
        return f"{self.page.title} v{self.version_number}"

    def restore(self, user):
        """Restore this version as the current version of the page"""
        # Create a new version from current state first
        self.page.create_version(
            user, "Restored from version {}".format(self.version_number)
        )

        # Apply the stored page data
        page_data = self.page_data
        for field, value in page_data.items():
            if hasattr(self.page, field):
                setattr(self.page, field, value)

        self.page.last_modified_by = user
        self.page.save()


class PageWidget(models.Model):
    """
    Widget instances placed on pages. Supports inheritance from parent pages.
    """

    page = models.ForeignKey(WebPage, on_delete=models.CASCADE, related_name="widgets")
    widget_type = models.ForeignKey(WidgetType, on_delete=models.CASCADE)

    # Widget placement
    slot_name = models.CharField(
        max_length=100, help_text="Layout slot where this widget is placed"
    )
    sort_order = models.IntegerField(default=0)

    # Widget configuration
    configuration = models.JSONField(help_text="Widget-specific configuration data")

    # Inheritance control
    inherit_from_parent = models.BooleanField(
        default=True, help_text="Whether child pages inherit this widget"
    )
    override_parent = models.BooleanField(
        default=False, help_text="Whether this widget overrides a parent widget"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    class Meta:
        ordering = ["slot_name", "sort_order"]
        unique_together = ["page", "slot_name", "sort_order"]

    def __str__(self):
        return f"{self.page.title} - {self.widget_type.name} in {self.slot_name}"

    def clean(self):
        """Validate widget configuration against schema"""
        super().clean()

        # TODO: Implement JSON schema validation
        # This would validate self.configuration against self.widget_type.json_schema
        pass


# Add methods to WebPage for version management
def create_version(self, user, description=""):
    """Create a new version snapshot of the current page state"""
    # Get the latest version number
    latest_version = self.versions.order_by("-version_number").first()
    version_number = (latest_version.version_number + 1) if latest_version else 1

    # Serialize current page state
    page_data = {
        "title": self.title,
        "slug": self.slug,
        "description": self.description,
        "layout_id": self.layout_id,
        "theme_id": self.theme_id,
        "publication_status": self.publication_status,
        "effective_date": (
            self.effective_date.isoformat() if self.effective_date else None
        ),
        "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
        "meta_title": self.meta_title,
        "meta_description": self.meta_description,
        "meta_keywords": self.meta_keywords,
        "linked_object_type": self.linked_object_type,
        "linked_object_id": self.linked_object_id,
        # Include widgets
        "widgets": [
            {
                "widget_type_id": w.widget_type_id,
                "slot_name": w.slot_name,
                "sort_order": w.sort_order,
                "configuration": w.configuration,
                "inherit_from_parent": w.inherit_from_parent,
                "override_parent": w.override_parent,
            }
            for w in self.widgets.all()
        ],
    }

    # Mark all previous versions as not current
    self.versions.update(is_current=False)

    # Create new version
    version = PageVersion.objects.create(
        page=self,
        version_number=version_number,
        page_data=page_data,
        description=description,
        is_current=True,
        created_by=user,
    )

    return version


# Add the method to the WebPage model
WebPage.create_version = create_version
