"""
Web Page Publishing System Models

This module defines the core models for the hierarchical web page management system:
- WebPage: Core page entity with hierarchy support and code-based layouts
- PageVersion: Version control for pages
- PageTheme: Theme configurations for styling
- WidgetType: Available widget types with schemas
- PageWidget: Widget instances on pages

Note: Layout templates are now defined as code-based classes, not database models.
"""

from django.db import models, transaction
from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.utils import timezone
from django.urls import reverse
from django.core.exceptions import ValidationError
import json


# PageLayout model removed - now using code-based layouts only


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

    def to_dict(self):
        """Convert theme to dictionary representation"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "css_variables": self.css_variables,
            "custom_css": self.custom_css,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by.username if self.created_by else None,
        }


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

    def validate_configuration(self, configuration):
        """
        Validate a configuration dictionary against this widget type's schema.
        Returns (is_valid, errors) tuple.
        """
        try:
            import jsonschema
            from jsonschema import ValidationError

            if not self.json_schema:
                return True, []

            jsonschema.validate(instance=configuration, schema=self.json_schema)
            return True, []

        except ImportError:
            # jsonschema not installed, skip validation
            return True, ["JSON Schema validation library not available"]
        except ValidationError as e:
            return False, [e.message]
        except Exception as e:
            return False, [f"Validation error: {str(e)}"]

    def get_configuration_defaults(self):
        """Extract default values from the JSON schema"""
        defaults = {}

        if not self.json_schema or "properties" not in self.json_schema:
            return defaults

        for field_name, field_schema in self.json_schema.get("properties", {}).items():
            if "default" in field_schema:
                defaults[field_name] = field_schema["default"]

        return defaults

    def to_dict(self):
        """Convert widget type to dictionary representation"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "json_schema": self.json_schema,
            "template_name": self.template_name,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by.username if self.created_by else None,
        }


class WebPage(models.Model):
    """
    Core page entity supporting hierarchical organization and inheritance.
    Pages can have parent-child relationships for content organization.
    Root pages (without parent) can be associated with hostnames for multi-site support.
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

    # Multi-site support for root pages
    hostnames = ArrayField(
        models.CharField(max_length=255),
        default=list,
        blank=True,
        help_text="List of hostnames this root page serves (only for pages without parent)",
    )

    # Layout and theme (with inheritance)
    # Code-based layout
    code_layout = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of code-based layout class. Leave blank to inherit from parent",
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
        max_length=20,
        choices=PUBLICATION_STATUS_CHOICES,
        default="unpublished",
        db_index=True,
    )
    effective_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this page should become public",
        db_index=True,
    )
    expiry_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this page should no longer be public",
        db_index=True,
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
        indexes = [
            models.Index(fields=["slug"], name="webpages_slug_idx"),
            GinIndex(fields=["hostnames"], name="webpages_hostnames_gin_idx"),
        ]

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        """Generate the public URL for this page"""
        if self.parent:
            return f"{self.parent.get_absolute_url()}/{self.slug}/"
        return f"/{self.slug}/"

    def is_root_page(self):
        """Check if this is a root page (no parent)"""
        return self.parent is None

    @classmethod
    def normalize_hostname(cls, hostname):
        """
        Normalize hostname by stripping protocols, paths, and cleaning format.

        Examples:
        - "http://example.com/path" -> "example.com"
        - "https://localhost:8000" -> "localhost:8000"
        - "www.example.com:443/" -> "www.example.com:443"
        - "EXAMPLE.COM" -> "example.com"
        """
        if not hostname or not isinstance(hostname, str):
            return ""

        hostname = hostname.strip()

        # Convert to lowercase for protocol detection
        hostname_lower = hostname.lower()

        # Remove protocol prefixes (case insensitive)
        if hostname_lower.startswith("http://"):
            hostname = hostname[7:]  # Remove 'http://'
        elif hostname_lower.startswith("https://"):
            hostname = hostname[8:]  # Remove 'https://'

        # Remove path components (everything after first /)
        if "/" in hostname:
            hostname = hostname.split("/", 1)[0]

        # Remove query parameters and fragments
        for separator in ["?", "#"]:
            if separator in hostname:
                hostname = hostname.split(separator, 1)[0]

        # Convert to lowercase and strip whitespace
        hostname = hostname.lower().strip()

        return hostname

    def get_hostname_display(self):
        """Get a readable display of associated hostnames"""
        if not self.hostnames:
            return "No hostnames"
        return ", ".join(self.hostnames)

    def add_hostname(self, hostname):
        """Add a hostname to this root page with automatic normalization"""
        if not self.is_root_page():
            raise ValidationError("Only root pages can have hostnames")

        # Normalize the hostname
        normalized_hostname = self.normalize_hostname(hostname)

        if normalized_hostname and normalized_hostname not in self.hostnames:
            self.hostnames.append(normalized_hostname)
            self.save()
        return True

    def remove_hostname(self, hostname):
        """Remove a hostname from this root page"""
        # Normalize for comparison
        normalized_hostname = self.normalize_hostname(hostname)

        if normalized_hostname in self.hostnames:
            self.hostnames.remove(normalized_hostname)
            self.save()
        return True

    def serves_hostname(self, hostname):
        """Check if this page serves the given hostname"""
        if not self.is_root_page():
            return False

        # Normalize for comparison
        normalized_hostname = self.normalize_hostname(hostname)
        return normalized_hostname in [
            self.normalize_hostname(h) for h in self.hostnames
        ]

    @classmethod
    def get_root_page_for_hostname(cls, hostname):
        """Get the root page that serves the given hostname"""
        normalized_hostname = cls.normalize_hostname(hostname)

        # Look for exact hostname match in array field
        pages = cls.objects.filter(
            parent__isnull=True, hostnames__contains=[normalized_hostname]
        )

        if pages.exists():
            return pages.select_related("layout", "theme", "parent").first()

        # Fallback: look for wildcard or default patterns using array overlap
        wildcard_pages = cls.objects.filter(
            parent__isnull=True, hostnames__overlap=["*", "default"]
        )

        if wildcard_pages.exists():
            return wildcard_pages.select_related("layout", "theme", "parent").first()

        return None

    @classmethod
    def get_all_hostnames(cls):
        """Get all hostnames used across all root pages"""
        hostnames = set()
        for page in cls.objects.filter(parent__isnull=True, hostnames__isnull=False):
            if page.hostnames:
                hostnames.update(page.hostnames)
        return sorted(list(hostnames))

    def get_effective_layout(self):
        """
        Get the code-based layout for this page.
        Inherits from parent if no layout is specified.

        Returns:
            BaseLayout instance for code layouts, or None
        """
        # Import here to avoid circular imports
        from .layout_registry import layout_registry

        # Check for code-based layout
        if self.code_layout:
            code_layout_instance = layout_registry.get_layout(self.code_layout)
            if code_layout_instance:
                return code_layout_instance
            # If code layout is specified but not found, log warning
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(
                f"Code layout '{self.code_layout}' not found for page '{self.title}'."
            )

        # Inherit from parent
        if self.parent:
            return self.parent.get_effective_layout()

        return None

    def get_effective_layout_dict(self):
        """
        Get the effective layout as a dictionary representation.
        This provides a unified interface for both code and database layouts.
        """
        effective_layout = self.get_effective_layout()
        if effective_layout:
            if hasattr(effective_layout, "to_dict"):  # Both types have this method
                return effective_layout.to_dict()
        return None

    def get_layout_type(self):
        """Get the type of layout being used: 'code' or 'inherited'"""
        if self.code_layout:
            from .layout_registry import layout_registry

            if layout_registry.is_registered(self.code_layout):
                return "code"
        if self.parent:
            return "inherited"
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

    def get_publication_schedule(self):
        """Get the publication schedule for this page as a value object."""
        from .publishing import PublicationSchedule

        return PublicationSchedule(self.effective_date, self.expiry_date)

    def should_be_published_now(self, now=None):
        """
        Tell, Don't Ask: Let the page tell us if it should be published now.

        This addresses the code smell where external code was asking the page
        about its state and then making decisions.
        """
        if now is None:
            now = timezone.now()

        return (
            self.publication_status == "scheduled"
            and self.get_publication_schedule().should_be_published_at(now)
        )

    def should_be_expired_now(self, now=None):
        """
        Tell, Don't Ask: Let the page tell us if it should be expired now.
        """
        if now is None:
            now = timezone.now()

        return (
            self.publication_status == "published"
            and self.get_publication_schedule().should_be_expired_at(now)
        )

    def publish(self, user, change_summary="Page published"):
        """
        Tell, Don't Ask: Let the page publish itself.

        Returns True if publication was successful, False otherwise.
        """
        if self.publication_status == "published":
            return False  # Already published

        try:
            with transaction.atomic():
                self.publication_status = "published"
                self.last_modified_by = user
                self.save()

                # Create version record if the method exists
                if hasattr(self, "create_version"):
                    self.create_version(
                        user,
                        change_summary,
                        status="published",
                        auto_publish=True,
                    )

                return True
        except Exception:
            return False

    def expire(self, user, change_summary="Page expired"):
        """
        Tell, Don't Ask: Let the page expire itself.

        Returns True if expiration was successful, False otherwise.
        """
        if self.publication_status != "published":
            return False  # Not currently published

        try:
            with transaction.atomic():
                self.publication_status = "expired"
                self.last_modified_by = user
                self.save()

                # Create version record if the method exists
                if hasattr(self, "create_version"):
                    self.create_version(
                        user,
                        change_summary,
                        status="draft",
                    )

                return True
        except Exception:
            return False

    def schedule(self, schedule, user, change_summary="Page scheduled"):
        """
        Tell, Don't Ask: Let the page schedule itself with a PublicationSchedule.

        Returns True if scheduling was successful, False otherwise.
        """
        if not schedule.is_valid():
            return False

        try:
            with transaction.atomic():
                self.publication_status = "scheduled"
                self.effective_date = schedule.effective_date
                self.expiry_date = schedule.expiry_date
                self.last_modified_by = user
                self.save()

                # Create version record if the method exists
                if hasattr(self, "create_version"):
                    self.create_version(
                        user,
                        change_summary,
                        status="draft",
                    )

                return True
        except Exception:
            return False

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

        # Validate hostname assignment
        if self.hostnames and self.parent is not None:
            raise ValidationError(
                "Only root pages (pages without a parent) can have hostnames."
            )

        # Validate hostname format
        if self.hostnames:
            for hostname in self.hostnames:
                if not isinstance(hostname, str) or not hostname.strip():
                    raise ValidationError("All hostnames must be non-empty strings.")

                # Normalize and validate hostname
                normalized_hostname = self.normalize_hostname(hostname)
                if not normalized_hostname:
                    raise ValidationError(f"Invalid hostname format: {hostname}")

                if normalized_hostname not in ["*", "default"]:
                    # Hostname validation supporting domains with optional ports
                    import re

                    # Pattern allows domain names with optional port numbers
                    # Examples: example.com, localhost:8000, sub.domain.com:3000
                    hostname_pattern = (
                        r"^"
                        r"[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?"  # First part
                        r"(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*"  # Domain parts
                        r"(:[0-9]{1,5})?"  # Optional port number (1-5 digits)
                        r"$"
                    )

                    if not re.match(hostname_pattern, normalized_hostname):
                        raise ValidationError(
                            f"Invalid hostname format: {hostname} (normalized: {normalized_hostname})"
                        )

                    # Validate port range if present
                    if ":" in normalized_hostname:
                        try:
                            port = int(normalized_hostname.split(":")[1])
                            if not (1 <= port <= 65535):
                                raise ValidationError(
                                    f"Port number must be between 1-65535: {hostname}"
                                )
                        except (ValueError, IndexError):
                            raise ValidationError(
                                f"Invalid port format in hostname: {hostname}"
                            )

        # Check for hostname conflicts with other root pages
        if self.hostnames and self.parent is None:
            for hostname in self.hostnames:
                # Use normalized hostname for conflict checking
                normalized_hostname = self.normalize_hostname(hostname)
                conflicting_pages = WebPage.objects.filter(
                    parent__isnull=True, hostnames__contains=[normalized_hostname]
                ).exclude(pk=self.pk)

                if conflicting_pages.exists():
                    conflicting_page = conflicting_pages.first()
                    raise ValidationError(
                        f"Hostname '{hostname}' is already used by page: {conflicting_page.title}"
                    )

    def get_inheritance_chain(self):
        """Get the complete inheritance chain from root to this page"""
        chain = []
        current = self
        while current:
            chain.insert(0, current)
            current = current.parent
        return chain

    def get_layout_inheritance_info(self):
        """Get detailed information about code-based layout inheritance"""
        from .layout_registry import layout_registry

        inheritance_info = {
            "effective_layout": None,
            "effective_layout_dict": None,
            "layout_type": None,
            "inherited_from": None,
            "inheritance_chain": [],
            "override_options": {
                "code_layouts": [],
            },
        }

        # Find where the effective layout comes from
        current = self
        while current:
            # Check what layout this page has
            page_layout_info = {
                "page": current,
                "code_layout": current.code_layout,
                "is_override": bool(current.code_layout),
            }

            inheritance_info["inheritance_chain"].append(page_layout_info)

            # Determine effective layout (code-based only)
            effective_layout = None
            layout_type = None

            if current.code_layout:
                code_layout_instance = layout_registry.get_layout(current.code_layout)
                if code_layout_instance:
                    effective_layout = code_layout_instance
                    layout_type = "code"

            if effective_layout:
                inheritance_info["effective_layout"] = effective_layout
                inheritance_info["effective_layout_dict"] = (
                    effective_layout.to_dict()
                    if hasattr(effective_layout, "to_dict")
                    else None
                )
                inheritance_info["layout_type"] = layout_type
                inheritance_info["inherited_from"] = (
                    current if current != self else None
                )
                break

            current = current.parent

        # Get available code layouts for override
        inheritance_info["override_options"]["code_layouts"] = (
            layout_registry.list_layouts(active_only=True)
        )

        return inheritance_info

    def get_theme_inheritance_info(self):
        """Get detailed information about theme inheritance"""
        inheritance_info = {
            "effective_theme": None,
            "inherited_from": None,
            "inheritance_chain": [],
            "override_options": [],
        }

        # Find where the effective theme comes from
        current = self
        while current:
            inheritance_info["inheritance_chain"].append(
                {
                    "page": current,
                    "theme": current.theme,
                    "is_override": current.theme is not None,
                }
            )

            if current.theme:
                inheritance_info["effective_theme"] = current.theme
                inheritance_info["inherited_from"] = (
                    current if current != self else None
                )
                break

            current = current.parent

        # Get available themes for override
        inheritance_info["override_options"] = PageTheme.objects.filter(is_active=True)

        return inheritance_info

    def get_widgets_inheritance_info(self):
        """Get detailed information about widget inheritance for all slots"""
        inheritance_info = {}

        # Get all slots from effective layout
        effective_layout = self.get_effective_layout()
        if not effective_layout or not effective_layout.slot_configuration:
            return inheritance_info

        slots = effective_layout.slot_configuration.get("slots", [])

        for slot in slots:
            slot_name = slot["name"]
            inheritance_info[slot_name] = {
                "widgets": [],
                "inheritance_chain": [],
                "can_override": True,
            }

            # Collect widgets from inheritance chain using PageVersion data
            current = self
            while current:
                # Get current version for this page
                current_version = current.get_current_version()
                page_widgets = []
                has_overrides = False

                if current_version and current_version.widgets:
                    # Filter widgets for this slot from JSON data
                    widgets_data = current_version.widgets
                    page_widgets = [
                        w for w in widgets_data if w.get("slot_name") == slot_name
                    ]
                    # Sort by sort_order
                    page_widgets = sorted(
                        page_widgets, key=lambda w: w.get("sort_order", 0)
                    )

                    for widget_data in page_widgets:
                        widget_info = {
                            "widget": widget_data,  # JSON data instead of model instance
                            "page": current,
                            "inherited_from": current if current != self else None,
                            "is_override": widget_data.get("override_parent", False),
                            "allows_inheritance": widget_data.get(
                                "inherit_from_parent", False
                            ),
                        }

                        # If this is the original page or widget allows inheritance
                        if current == self or widget_data.get(
                            "inherit_from_parent", False
                        ):
                            # If this widget overrides, replace all previous widgets
                            if (
                                widget_data.get("override_parent", False)
                                and current == self
                            ):
                                inheritance_info[slot_name]["widgets"] = [widget_info]
                            else:
                                inheritance_info[slot_name]["widgets"].append(
                                    widget_info
                                )

                    # Check for overrides in this page's widgets
                    has_overrides = any(
                        w.get("override_parent", False) for w in page_widgets
                    )

                inheritance_info[slot_name]["inheritance_chain"].append(
                    {
                        "page": current,
                        "widgets_count": len(page_widgets),
                        "has_overrides": has_overrides,
                    }
                )

                current = current.parent

        return inheritance_info

    def can_inherit_from(self, ancestor_page):
        """Check if this page can inherit from the specified ancestor"""
        if not ancestor_page:
            return False

        # Check if ancestor_page is actually an ancestor
        current = self.parent
        while current:
            if current == ancestor_page:
                return True
            current = current.parent

        return False

    def get_inheritance_conflicts(self):
        """Identify any inheritance conflicts or issues"""
        conflicts = []

        # Check for circular references (should be prevented by clean())
        try:
            self.get_inheritance_chain()
        except Exception as e:
            conflicts.append(
                {
                    "type": "circular_reference",
                    "message": "Circular reference detected in page hierarchy",
                }
            )

        # Check for widget inheritance conflicts
        widgets_info = self.get_widgets_inheritance_info()
        for slot_name, slot_info in widgets_info.items():
            overrides = [w for w in slot_info["widgets"] if w["is_override"]]
            if len(overrides) > 1:
                conflicts.append(
                    {
                        "type": "multiple_overrides",
                        "slot": slot_name,
                        "message": f"Multiple widget overrides detected in slot {slot_name}",
                    }
                )

        # Check for broken layout inheritance
        layout_info = self.get_layout_inheritance_info()
        if not layout_info["effective_layout"]:
            conflicts.append(
                {
                    "type": "missing_layout",
                    "message": "No layout found in inheritance chain",
                }
            )

        return conflicts

    def apply_inheritance_override(self, override_type, override_value=None):
        """Apply an inheritance override for layout, theme, or widgets"""
        if override_type == "layout":
            self.code_layout = override_value
        elif override_type == "theme":
            self.theme = override_value
        elif override_type == "clear_layout":
            self.code_layout = ""
        elif override_type == "clear_theme":
            self.theme = None

        self.save()
        return True

    # Object Publishing Methods

    def is_object_page(self):
        """Check if this page is linked to an object"""
        return bool(self.linked_object_type and self.linked_object_id)

    def get_linked_object(self):
        """Get the linked object instance"""
        if not self.is_object_page():
            return None

        from .object_publishing import ObjectPublishingService

        service = ObjectPublishingService(self)
        return service.get_linked_object()

    def get_object_content(self):
        """Get content from the linked object for display"""
        from .object_publishing import ObjectPublishingService

        service = ObjectPublishingService(self)
        return service.get_formatted_content()

    def link_to_object(self, object_type, object_id, user=None):
        """Link this page to an object"""
        from .object_publishing import ObjectPublishingService

        service = ObjectPublishingService(self)
        return service.link_object(object_type, object_id, user)

    def unlink_object(self, user=None):
        """Remove the object link from this page"""
        from .object_publishing import ObjectPublishingService

        service = ObjectPublishingService(self)
        return service.unlink_object(user)

    def get_canonical_url(self):
        """Get the canonical URL for this page, considering object links"""
        if self.is_object_page():
            # For object pages, use the object's canonical URL
            linked_object = self.get_linked_object()
            if linked_object and hasattr(linked_object, "get_absolute_url"):
                return linked_object.get_absolute_url()

        # Use the page's normal URL
        return self.get_absolute_url()

    @classmethod
    def get_supported_object_types(cls):
        """Get list of supported object types for publishing"""
        return [
            {"value": "news", "label": "News Article"},
            {"value": "event", "label": "Event"},
            {"value": "libraryitem", "label": "Library Item"},
            {"value": "member", "label": "Member Profile"},
        ]

    def sync_with_object(self, user=None):
        """Sync page metadata with the linked object"""
        from .object_publishing import ObjectPublishingService

        service = ObjectPublishingService(self)
        return service.sync_with_object(user)

    def create_version(self, user, description="", status="draft", auto_publish=False):
        """Create a new version snapshot of the current page state"""
        from django.utils import timezone

        # Get the latest version number
        latest_version = self.versions.order_by("-version_number").first()
        version_number = (latest_version.version_number + 1) if latest_version else 1

        # Serialize current page state (excluding widgets)
        page_data = {
            "title": self.title,
            "slug": self.slug,
            "description": self.description,
            "hostnames": self.hostnames,
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
            "parent_id": self.parent_id,
            "sort_order": self.sort_order,
        }

        # Get widgets from current version (if exists) or start with empty list
        current_version = self.get_current_version()
        widgets_data = []
        if current_version and current_version.widgets:
            # Copy widgets from current version
            widgets_data = current_version.widgets.copy()
        # If no current version exists, widgets_data remains an empty list

        # Prepare version fields
        version_fields = {
            "page": self,
            "version_number": version_number,
            "page_data": page_data,
            "widgets": widgets_data,
            "description": description,
            "status": status,
            "created_by": user,
        }

        # Handle auto-publish
        if auto_publish or status == "published":
            # Mark all previous versions as not current
            self.versions.update(is_current=False)
            version_fields.update(
                {
                    "status": "published",
                    "is_current": True,
                    "published_at": timezone.now(),
                    "published_by": user,
                }
            )

        # Create new version
        version = PageVersion.objects.create(**version_fields)
        return version

    def get_current_version(self):
        """Get the current published version of this page"""
        return self.versions.filter(is_current=True, status="published").first()

    def get_latest_draft(self):
        """Get the latest draft version of this page"""
        return self.versions.filter(status="draft").order_by("-version_number").first()

    def has_unpublished_changes(self):
        """Check if there are draft versions newer than the current published version"""
        current = self.get_current_version()
        if not current:
            return self.versions.filter(status="draft").exists()

        return self.versions.filter(
            status="draft", version_number__gt=current.version_number
        ).exists()

    def get_latest_published_version(self):
        """Get the latest published version by version number"""
        return (
            self.versions.filter(status="published").order_by("-version_number").first()
        )


class PageVersion(models.Model):
    """
    Version control system for pages. Stores complete page state snapshots.
    Enables rollback, comparison, and change tracking with draft/published workflow.
    """

    VERSION_STATUS_CHOICES = [
        ("draft", "Draft"),
        ("published", "Published"),
        ("archived", "Archived"),
    ]

    page = models.ForeignKey(WebPage, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()

    # Snapshot of page data at this version
    page_data = models.JSONField(help_text="Serialized page data (excluding widgets)")

    # Widget data for this version
    widgets = models.JSONField(
        default=list, help_text="Widget configuration data for this version"
    )

    # Version workflow
    status = models.CharField(
        max_length=20,
        choices=VERSION_STATUS_CHOICES,
        default="draft",
        help_text="Current status of this version",
    )
    is_current = models.BooleanField(
        default=False, help_text="Whether this is the currently active version"
    )
    published_at = models.DateTimeField(
        null=True, blank=True, help_text="When this version was published"
    )
    published_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="published_versions",
        help_text="User who published this version",
    )

    # Version metadata
    description = models.TextField(
        blank=True, help_text="Description of changes in this version"
    )
    change_summary = models.JSONField(
        default=dict,
        blank=True,
        help_text="Summary of specific changes made in this version",
    )

    # Timestamps and ownership
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    class Meta:
        ordering = ["-version_number"]
        unique_together = ["page", "version_number"]

    def __str__(self):
        return f"{self.page.title} v{self.version_number}"

    def publish(self, user):
        """Publish this version, making it the current live version"""
        from django.utils import timezone

        # Mark all other versions as not current
        self.page.versions.update(is_current=False)

        # Update this version
        self.status = "published"
        self.is_current = True
        self.published_at = timezone.now()
        self.published_by = user
        self.save()

        # Apply the stored page data to the page
        self._apply_version_data()
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

    def create_draft_from_published(self, user, description=""):
        """Create a new draft version based on this published version"""
        if self.status != "published":
            raise ValueError("Can only create drafts from published versions")

        # Get next version number
        latest_version = self.page.versions.order_by("-version_number").first()
        version_number = (latest_version.version_number + 1) if latest_version else 1

        # Create new draft version
        draft = PageVersion.objects.create(
            page=self.page,
            version_number=version_number,
            page_data=self.page_data.copy(),
            widgets=self.widgets.copy() if self.widgets else [],
            status="draft",
            description=description or f"Draft based on version {self.version_number}",
            created_by=user,
        )

        return draft

    def to_dict(self):
        """Convert version to dictionary representation"""
        return {
            "id": self.id,
            "page_id": self.page_id,
            "page_title": self.page.title,
            "version_number": self.version_number,
            "page_data": self.page_data,
            "widgets": self.widgets,
            "status": self.status,
            "is_current": self.is_current,
            "published_at": (
                self.published_at.isoformat() if self.published_at else None
            ),
            "published_by": self.published_by.username if self.published_by else None,
            "description": self.description,
            "change_summary": self.change_summary,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "created_by": self.created_by.username if self.created_by else None,
        }
