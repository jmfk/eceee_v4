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

    def get_inheritance_chain(self):
        """Get the complete inheritance chain from root to this page"""
        chain = []
        current = self
        while current:
            chain.insert(0, current)
            current = current.parent
        return chain

    def get_layout_inheritance_info(self):
        """Get detailed information about layout inheritance"""
        inheritance_info = {
            "effective_layout": None,
            "inherited_from": None,
            "inheritance_chain": [],
            "override_options": [],
        }

        # Find where the effective layout comes from
        current = self
        while current:
            inheritance_info["inheritance_chain"].append(
                {
                    "page": current,
                    "layout": current.layout,
                    "is_override": current.layout is not None,
                }
            )

            if current.layout:
                inheritance_info["effective_layout"] = current.layout
                inheritance_info["inherited_from"] = (
                    current if current != self else None
                )
                break

            current = current.parent

        # Get available layouts for override
        inheritance_info["override_options"] = PageLayout.objects.filter(is_active=True)

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

            # Collect widgets from inheritance chain
            current = self
            while current:
                page_widgets = current.widgets.filter(slot_name=slot_name).order_by(
                    "sort_order"
                )

                for widget in page_widgets:
                    widget_info = {
                        "widget": widget,
                        "page": current,
                        "inherited_from": current if current != self else None,
                        "is_override": widget.override_parent,
                        "allows_inheritance": widget.inherit_from_parent,
                    }

                    # If this is the original page or widget allows inheritance
                    if current == self or widget.inherit_from_parent:
                        # If this widget overrides, replace all previous widgets
                        if widget.override_parent and current == self:
                            inheritance_info[slot_name]["widgets"] = [widget_info]
                        else:
                            inheritance_info[slot_name]["widgets"].append(widget_info)

                inheritance_info[slot_name]["inheritance_chain"].append(
                    {
                        "page": current,
                        "widgets_count": page_widgets.count(),
                        "has_overrides": page_widgets.filter(
                            override_parent=True
                        ).exists(),
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
            self.layout = override_value
        elif override_type == "theme":
            self.theme = override_value
        elif override_type == "clear_layout":
            self.layout = None
        elif override_type == "clear_theme":
            self.theme = None

        self.save()
        return True


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
    page_data = models.JSONField(
        help_text="Complete serialized page data including widgets"
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
        widgets_data = page_data.pop("widgets", [])

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

        # Clear existing widgets and recreate from version data
        self.page.widgets.all().delete()
        for widget_data in widgets_data:
            PageWidget.objects.create(
                page=self.page,
                widget_type_id=widget_data["widget_type_id"],
                slot_name=widget_data["slot_name"],
                sort_order=widget_data["sort_order"],
                configuration=widget_data["configuration"],
                inherit_from_parent=widget_data["inherit_from_parent"],
                override_parent=widget_data["override_parent"],
                created_by=self.created_by,
            )

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
        self_widgets = {
            (w["slot_name"], w["sort_order"]): w
            for w in self.page_data.get("widgets", [])
        }
        other_widgets = {
            (w["slot_name"], w["sort_order"]): w
            for w in other_version.page_data.get("widgets", [])
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
            status="draft",
            description=description or f"Draft based on version {self.version_number}",
            created_by=user,
        )

        return draft


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

    # Phase 6: Enhanced Inheritance Controls
    inherit_from_parent = models.BooleanField(
        default=True, help_text="Whether child pages inherit this widget"
    )
    override_parent = models.BooleanField(
        default=False, help_text="Whether this widget overrides a parent widget"
    )

    # Granular inheritance settings
    INHERITANCE_CHOICES = [
        ("inherit", "Inherit from Parent"),
        ("override", "Override Parent Widget"),
        ("supplement", "Add to Parent Widgets"),
        ("block", "Block Inheritance"),
        ("conditional", "Conditional Inheritance"),
    ]

    inheritance_behavior = models.CharField(
        max_length=20,
        choices=INHERITANCE_CHOICES,
        default="inherit",
        help_text="How this widget handles inheritance",
    )

    # Conditional inheritance settings
    inheritance_conditions = models.JSONField(
        default=dict,
        blank=True,
        help_text="JSON conditions for when inheritance applies",
    )

    # Widget priority for ordering when multiple widgets exist in same slot
    priority = models.IntegerField(
        default=0,
        help_text="Higher priority widgets appear first (0 = normal priority)",
    )

    # Visibility controls
    is_visible = models.BooleanField(
        default=True, help_text="Whether this widget is visible on the page"
    )

    # Inheritance depth limit
    max_inheritance_depth = models.IntegerField(
        null=True,
        blank=True,
        help_text="Maximum depth this widget can be inherited (null = unlimited)",
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    class Meta:
        ordering = ["slot_name", "-priority", "sort_order"]
        unique_together = ["page", "slot_name", "sort_order"]

    def __str__(self):
        return f"{self.page.title} - {self.widget_type.name} in {self.slot_name}"

    def clean(self):
        """Validate widget configuration against schema"""
        super().clean()

        # Phase 6: Implement JSON schema validation
        if self.widget_type and self.widget_type.json_schema and self.configuration:
            self._validate_configuration_schema()

    def _validate_configuration_schema(self):
        """Validate widget configuration against its widget type's JSON schema"""
        try:
            import jsonschema
            from jsonschema import ValidationError

            # Validate the configuration against the widget type's schema
            jsonschema.validate(
                instance=self.configuration, schema=self.widget_type.json_schema
            )

        except ImportError:
            # jsonschema not installed, skip validation
            pass
        except ValidationError as e:
            from django.core.exceptions import ValidationError as DjangoValidationError

            raise DjangoValidationError(
                f"Widget configuration validation failed: {e.message}"
            )
        except Exception as e:
            from django.core.exceptions import ValidationError as DjangoValidationError

            raise DjangoValidationError(
                f"Widget configuration validation error: {str(e)}"
            )

    def should_inherit_to_page(self, target_page):
        """
        Determine if this widget should be inherited by the target page
        based on inheritance behavior and conditions.
        """
        if not self.inherit_from_parent:
            return False

        if self.inheritance_behavior == "block":
            return False

        # Check inheritance depth limit
        if self.max_inheritance_depth is not None:
            depth = self._calculate_inheritance_depth(target_page)
            if depth > self.max_inheritance_depth:
                return False

        # Check conditional inheritance
        if self.inheritance_behavior == "conditional" and self.inheritance_conditions:
            return self._evaluate_inheritance_conditions(target_page)

        return True

    def _calculate_inheritance_depth(self, target_page):
        """Calculate the inheritance depth from this widget's page to target page"""
        depth = 0
        current_page = target_page

        while current_page and current_page != self.page:
            current_page = current_page.parent
            depth += 1

        return depth

    def _evaluate_inheritance_conditions(self, target_page):
        """
        Evaluate inheritance conditions against target page.
        Conditions format: {
            "page_type": "specific_type",
            "depth_max": 3,
            "custom_field": "value"
        }
        """
        if not self.inheritance_conditions:
            return True

        for condition_key, condition_value in self.inheritance_conditions.items():
            if condition_key == "depth_max":
                depth = self._calculate_inheritance_depth(target_page)
                if depth > condition_value:
                    return False
            elif condition_key == "page_type":
                # This could be extended to check custom page types
                if (
                    hasattr(target_page, "page_type")
                    and target_page.page_type != condition_value
                ):
                    return False
            # Add more condition types as needed

        return True

    @classmethod
    def get_effective_widgets_for_page(cls, page, slot_name=None):
        """
        Get all effective widgets for a page considering inheritance rules.
        Returns widgets ordered by priority and sort_order.
        """
        from collections import defaultdict

        # Collect widgets from page hierarchy
        widgets_by_slot = defaultdict(list)
        inheritance_chain = page.get_inheritance_chain()

        for ancestor_page in inheritance_chain:
            page_widgets = cls.objects.filter(page=ancestor_page, is_visible=True)

            if slot_name:
                page_widgets = page_widgets.filter(slot_name=slot_name)

            for widget in page_widgets:
                if widget.should_inherit_to_page(page):
                    # Handle different inheritance behaviors
                    if widget.inheritance_behavior == "override":
                        # Override: clear existing widgets in this slot
                        widgets_by_slot[widget.slot_name] = [widget]
                    elif widget.inheritance_behavior == "supplement":
                        # Supplement: add to existing widgets
                        widgets_by_slot[widget.slot_name].append(widget)
                    elif widget.inheritance_behavior == "inherit":
                        # Normal inheritance: add if not overridden
                        if not any(
                            w.inheritance_behavior == "override"
                            for w in widgets_by_slot[widget.slot_name]
                        ):
                            widgets_by_slot[widget.slot_name].append(widget)

        # Sort widgets within each slot by priority and sort_order
        for slot, widgets in widgets_by_slot.items():
            widgets.sort(key=lambda w: (-w.priority, w.sort_order))

        if slot_name:
            return widgets_by_slot.get(slot_name, [])

        return dict(widgets_by_slot)


# Add methods to WebPage for version management
def create_version(self, user, description="", status="draft", auto_publish=False):
    """Create a new version snapshot of the current page state"""
    from django.utils import timezone

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
        "parent_id": self.parent_id,
        "sort_order": self.sort_order,
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

    # Prepare version fields
    version_fields = {
        "page": self,
        "version_number": version_number,
        "page_data": page_data,
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


# Add the methods to the WebPage model
WebPage.create_version = create_version
WebPage.get_current_version = get_current_version
WebPage.get_latest_draft = get_latest_draft
WebPage.has_unpublished_changes = has_unpublished_changes
