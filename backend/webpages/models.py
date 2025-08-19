"""
Web Page Publishing System Models

This module defines the core models for the hierarchical web page management system:
- WebPage: Core page entity with hierarchy support and code-based layouts
- PageVersion: Version control for pages
- PageTheme: Theme configurations for styling
- Widget types are now code-based (see widgets.py)
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


class WebPage(models.Model):
    """
    Core page entity supporting hierarchical organization and inheritance.
    Pages can have parent-child relationships for content organization.
    Root pages (without parent) can be associated with hostnames for multi-site support.
    """

    # Hierarchy support
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )
    sort_order = models.IntegerField(default=0)

    # Basic page information
    title = models.CharField(max_length=255, default="")
    description = models.TextField(blank=True, default="")
    slug = models.SlugField(max_length=255, unique=False, null=True, blank=True)
    # Page-level CSS injection controls (kept for backward compatibility and manual overrides)
    enable_css_injection = models.BooleanField(
        default=True,
        help_text="Whether to enable dynamic CSS injection for this page",
    )
    page_css_variables = models.JSONField(
        default=dict,
        blank=True,
        help_text="Page-specific CSS variables that override theme variables",
    )
    page_custom_css = models.TextField(
        blank=True, help_text="Page-specific custom CSS injected after theme CSS"
    )

    # Multi-site support for root pages
    hostnames = ArrayField(
        models.CharField(max_length=255),
        default=list,
        blank=True,
        help_text="List of hostnames this root page serves (only for pages without parent)",
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
        ordering = [
            "sort_order",
            "id",
        ]  # Use id instead of title since title is now a property
        indexes = [
            models.Index(fields=["slug"], name="webpages_slug_idx"),
            GinIndex(fields=["hostnames"], name="webpages_hostnames_gin_idx"),
        ]

    def get_latest_version(self):
        """Get the latest version of this page"""
        return self.versions.order_by("-version_number").first()

    def __str__(self):
        return self.slug

    def get_absolute_url(self):
        """Generate the public URL for this page"""
        if self.parent:
            parent_url = (self.parent.get_absolute_url() or "/").rstrip("/")
            slug_part = (self.slug or "").strip("/")
            return f"{parent_url}/{slug_part}/"
        slug_part = (self.slug or "").strip("/")
        return f"/{slug_part}/"

    def is_root_page(self):
        """Check if this is a root page (no parent)"""
        return self.parent is None

    @classmethod
    def normalize_hostname(cls, hostname):
        """
        Normalize hostname with support for IPv6, IDN, and proper port handling.

        Security: Validates input length and format to prevent ReDoS attacks.

        Examples:
        - "http://example.com/path" -> "example.com"
        - "https://localhost:8000" -> "localhost:8000"
        - "[::1]:8080" -> "[::1]:8080"
        - "2001:db8::1" -> "[2001:db8::1]"
        - "münchen.de" -> "xn--mnchen-3ya.de"
        """
        if not hostname or not isinstance(hostname, str):
            return ""

        hostname = hostname.strip()

        # Security: Prevent extremely long hostnames that could cause DoS
        if len(hostname) > 253:  # RFC 1035 hostname length limit
            return ""

        # Security: Basic character validation to prevent injection
        import re

        # Allow protocol prefixes, alphanumeric chars, dots, dashes, brackets, colons, slashes, query params
        if not re.match(r"^[a-zA-Z0-9\[\]:._\-/\?#%]+$", hostname):
            return ""

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

        # Handle different hostname formats
        try:
            # Handle IPv6 addresses in brackets: [::1]:8080 or [::1]
            if hostname.startswith("[") and "]" in hostname:
                bracket_end = hostname.find("]")
                ipv6_part = hostname[1:bracket_end]

                # Validate IPv6 address (but preserve original case)
                import ipaddress

                # Validate without modifying case
                ipaddress.ip_address(ipv6_part)

                # Check for port after bracket
                remaining = hostname[bracket_end + 1 :]
                if remaining.startswith(":"):
                    port_part = remaining[1:]
                    if port_part:
                        # Validate port
                        port = int(port_part)
                        if not (1 <= port <= 65535):
                            raise ValueError(f"Invalid port: {port}")
                        return f"[{ipv6_part}]:{port}"  # Preserve original case
                    else:
                        # Just brackets with colon but no port
                        return f"[{ipv6_part}]"  # Preserve original case
                else:
                    return f"[{ipv6_part}]"  # Preserve original case

            # Check if this could be a bare IPv6 address (no brackets)
            elif ":" in hostname and hostname.count(":") > 1:
                # Multiple colons might indicate IPv6
                try:
                    import ipaddress

                    # Validate it's a valid IPv6 address
                    ipaddress.ip_address(hostname)
                    # Return with original case preserved
                    return f"[{hostname}]"  # Normalize to bracketed form, preserve case
                except ValueError:
                    # Not a valid IPv6, continue with regular processing
                    pass

            # Handle internationalized domain names (IDN)
            if any(ord(char) > 127 for char in hostname):
                # Convert IDN to ASCII (punycode)
                try:
                    hostname = hostname.encode("idna").decode("ascii")
                except (UnicodeError, UnicodeDecodeError):
                    # If IDN encoding fails, keep original but log warning
                    import logging

                    logger = logging.getLogger(__name__)
                    logger.warning(f"Failed to encode IDN hostname: {hostname}")

            # Regular hostname processing (IPv4 or domain name with optional port)
            # Only lowercase domain names, not IPv6 addresses
            if ":" in hostname and hostname.count(":") > 1:
                # Likely IPv6 address - preserve case for hex digits
                hostname = hostname.strip()
            else:
                # Regular domain name - safe to lowercase
                hostname = hostname.lower().strip()

            # Validate port if present in regular hostname:port format
            if ":" in hostname and hostname.count(":") == 1:
                # Standard host:port format (not IPv6)
                host_part, port_part = hostname.rsplit(":", 1)
                if port_part:
                    try:
                        port = int(port_part)
                        if not (1 <= port <= 65535):
                            raise ValueError(f"Invalid port: {port}")
                        return f"{host_part}:{port}"
                    except ValueError:
                        # Port part is not a valid number, treat as part of hostname
                        # This handles edge cases like "my:host:name"
                        pass

            return hostname

        except Exception as e:
            # If normalization fails, log the error and return basic normalization
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Hostname normalization failed for '{hostname}': {e}")

            # Fallback to basic normalization
            return hostname.lower().strip()

    def _extract_port_from_hostname(self, hostname):
        """
        Extract port from hostname, handling IPv6 addresses correctly.

        Returns:
            int or None: Port number if present, None if no port specified

        Raises:
            ValidationError: If port format is invalid
        """
        if not hostname:
            return None

        try:
            # Handle IPv6 addresses in brackets: [::1]:8080
            if hostname.startswith("["):
                if "]:" in hostname:
                    bracket_end = hostname.find("]:")
                    port_str = hostname[bracket_end + 2 :]
                    if port_str:
                        return int(port_str)
                return None

            # Handle regular hostnames: example.com:8080
            if ":" in hostname:
                # Make sure this isn't an IPv6 address without brackets
                parts = hostname.split(":")

                # If more than 2 parts, likely IPv6 without brackets (invalid but handle gracefully)
                if len(parts) > 2:
                    # Could be IPv6 like ::1 or 2001:db8::1
                    # If it's a valid IPv6, no port is specified
                    try:
                        import ipaddress

                        ipaddress.ip_address(hostname)
                        return None  # Valid IPv6 address, no port
                    except ValueError:
                        # Not a valid IPv6, might be malformed
                        raise ValidationError(
                            f"Invalid hostname format (possible IPv6 without brackets): {hostname}"
                        )

                # Standard host:port format
                host_part, port_str = parts
                if port_str:
                    return int(port_str)

            return None

        except ValueError as e:
            raise ValidationError(
                f"Invalid port format in hostname: {hostname} - {str(e)}"
            )

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
            # Security: Limit number of hostnames to prevent abuse
            if len(self.hostnames) >= 50:  # Reasonable limit
                raise ValidationError("Maximum number of hostnames (50) exceeded")
            self.hostnames.append(normalized_hostname)
            self.save()
        return True

    def remove_hostname(self, hostname):
        """Remove a hostname from this root page"""
        # Normalize for comparison
        normalized_hostname = self.normalize_hostname(hostname)

        if normalized_hostname in self.hostnames:
            try:
                self.hostnames.remove(normalized_hostname)
                self.save()
            except (ValueError, TypeError) as e:
                # Handle array corruption gracefully
                import logging

                logger = logging.getLogger(__name__)
                logger.warning(
                    f"Hostname array corruption detected for page {self.id}: {e}"
                )
                # Clean and rebuild the hostnames array
                self.hostnames = [
                    h for h in self.hostnames if h and h != normalized_hostname
                ]
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
            return pages.select_related("parent").first()

        # Fallback: look for wildcard or default patterns using array overlap
        wildcard_pages = cls.objects.filter(
            parent__isnull=True, hostnames__overlap=["*", "default"]
        )

        if wildcard_pages.exists():
            return wildcard_pages.select_related("parent").first()

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

        # Check for code-based layout from current version
        current_version = self.get_current_published_version()
        if not current_version:
            current_version = self.get_latest_version()

        if current_version and current_version.code_layout:
            code_layout_instance = layout_registry.get_layout(
                current_version.code_layout
            )
            if code_layout_instance:
                return code_layout_instance
            # If code layout is specified but not found, log warning
            import logging

            logger = logging.getLogger(__name__)
            # Get title for logging (fallback to slug if no version data)
            title = "Unknown"
            if (
                current_version
                and current_version.page_data
                and current_version.page_data.get("title")
            ):
                title = current_version.page_data["title"]
            elif hasattr(current_version, "meta_title") and current_version.meta_title:
                title = current_version.meta_title
            elif self.slug:
                title = self.slug

            logger.warning(
                f"Code layout '{current_version.code_layout}' not found for page '{title}'."
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
        # Get code_layout from current version
        current_version = self.get_current_published_version()
        if not current_version:
            current_version = self.get_latest_version()

        if current_version and current_version.code_layout:
            from .layout_registry import layout_registry

            if layout_registry.is_registered(current_version.code_layout):
                return "code"
        if self.parent:
            return "inherited"
        return None

    def get_effective_theme(self):
        """Get the theme for this page, inheriting from parent if needed"""
        # Get theme from current published version
        current_version = self.get_current_published_version()
        if current_version and current_version.theme:
            return current_version.theme
        elif self.parent:
            return self.parent.get_effective_theme()
        return None

    def is_published(self, now=None):
        """
        Check if this page should be visible to the public.

        NEW: Page is published if it has a currently published version (date-based).
        """
        current_version = self.get_current_published_version(now)
        return current_version is not None

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

                # Warn about wildcard hostname usage
                if normalized_hostname == "*":
                    import logging

                    logger = logging.getLogger(__name__)
                    logger.warning(
                        f"SECURITY WARNING: Page '{self.title}' (ID: {self.id}) contains wildcard hostname (*). "
                        f"This allows access from ANY domain and significantly reduces security. "
                        f"Consider using specific hostnames for production environments."
                    )

                if normalized_hostname not in ["*", "default"]:
                    # Hostname validation supporting domains, IPv6, and optional ports
                    import re

                    # Pattern allows:
                    # - Domain names: example.com, localhost:8000, sub.domain.com:3000
                    # - IPv6 addresses: [::1], [::1]:8080, [2001:db8::1]:443
                    ipv6_pattern = (
                        r"\[[0-9a-fA-F:]+\](:[0-9]{1,5})?"  # IPv6 with optional port
                    )
                    domain_pattern = (
                        r"[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?"  # First part
                        r"(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*"  # Domain parts
                        r"(:[0-9]{1,5})?"  # Optional port number (1-5 digits)
                    )

                    hostname_pattern = f"^({ipv6_pattern}|{domain_pattern})$"

                    if not re.match(hostname_pattern, normalized_hostname):
                        raise ValidationError(
                            f"Invalid hostname format: {hostname} (normalized: {normalized_hostname})"
                        )

                    # Validate port range if present (handle IPv6 properly)
                    port = self._extract_port_from_hostname(normalized_hostname)
                    if port is not None:
                        if not (1 <= port <= 65535):
                            raise ValidationError(
                                f"Port number must be between 1-65535: {hostname}"
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
            # Get code_layout from current page's current version
            current_version = current.get_current_published_version()
            if not current_version:
                current_version = current.get_latest_version()

            page_code_layout = current_version.code_layout if current_version else None

            # Check what layout this page has
            page_layout_info = {
                "page": current,
                "code_layout": page_code_layout,
                "is_override": bool(page_code_layout),
            }

            inheritance_info["inheritance_chain"].append(page_layout_info)

            # Determine effective layout (code-based only)
            effective_layout = None
            layout_type = None

            if page_code_layout:
                code_layout_instance = layout_registry.get_layout(page_code_layout)
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
                # Get current published version for this page
                current_version = current.get_current_published_version()
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
        # TODO: Update this method to work with PageVersion model
        # Since theme and code_layout are now stored in PageVersion,
        # this method needs to create a new version with the override
        # For now, disable functionality to prevent errors
        raise NotImplementedError(
            "apply_inheritance_override needs to be updated to work with PageVersion model"
        )

    def get_canonical_url(self):
        """Get the canonical URL for this page"""
        return self.get_absolute_url()

    def create_version(self, user, version_title=""):
        """Create a new version snapshot of the current page state"""
        from django.utils import timezone
        from django.db import transaction

        # Use atomic transaction to prevent race conditions
        with transaction.atomic():
            # Get the latest version number with row-level locking
            latest_version = (
                self.versions.select_for_update().order_by("-version_number").first()
            )
            version_number = (
                (latest_version.version_number + 1) if latest_version else 1
            )

            # Serialize current page state (excluding widgets and publishing dates)
            page_data = {}

            # Get widgets from the most recent version with widgets (preserve widgets by default)
            widgets_data = {}

            # First try to get current published version
            current_version = self.get_current_published_version()
            if current_version and current_version.widgets:
                widgets_data = current_version.widgets.copy()
            else:
                # Fallback: get the most recent version with widgets (published or draft)
                latest_version_with_widgets = (
                    self.versions.exclude(widgets__isnull=True)
                    .exclude(widgets={})
                    .exclude(widgets=[])
                    .order_by("-version_number")
                    .first()
                )

                if latest_version_with_widgets and latest_version_with_widgets.widgets:
                    widgets_data = latest_version_with_widgets.widgets.copy()

            # If still no widgets found, use empty dict (not list - the model should use dict as default)
            if not widgets_data:
                widgets_data = {}

            # Create new version (no legacy status fields)
            version = PageVersion.objects.create(
                page=self,
                version_number=version_number,
                version_title=version_title,
                page_data={},
                widgets=widgets_data,
                created_by=user,
            )
            return version

    def get_current_published_version(self, now=None):
        """
        Get the currently published version of this page using date-based logic.

        Returns the latest version that:
        - Has effective_date <= now
        - Has no expiry_date OR expiry_date > now
        """
        if now is None:
            from django.utils import timezone

            now = timezone.now()

        return (
            self.versions.filter(effective_date__lte=now)
            .filter(models.Q(expiry_date__isnull=True) | models.Q(expiry_date__gt=now))
            .order_by("-effective_date", "-version_number")
            .first()
        )

    def get_latest_version(self):
        """Get the latest version of this page (regardless of publication status)"""
        return self.versions.order_by("-version_number").first()

    def has_newer_versions(self):
        """Check if there are versions newer than the current published version"""
        current = self.get_current_published_version()
        if not current:
            return self.versions.exists()

        return self.versions.filter(version_number__gt=current.version_number).exists()

    def get_latest_published_version(self):
        """Get the latest published version by effective date"""
        from django.utils import timezone

        now = timezone.now()

        return (
            self.versions.filter(effective_date__lte=now)
            .filter(models.Q(expiry_date__isnull=True) | models.Q(expiry_date__gt=now))
            .order_by("-effective_date", "-version_number")
            .first()
        )

    @classmethod
    def normalize_sort_orders(cls, parent_id=None):
        """
        Normalize sort orders for all siblings under the same parent.
        Assigns sort orders starting from 10, incrementing by 10 (10, 20, 30, etc.)

        Args:
            parent_id: ID of parent page, or None for root pages
        """
        if parent_id:
            siblings = cls.objects.filter(parent_id=parent_id).order_by(
                "sort_order", "title"
            )
        else:
            siblings = cls.objects.filter(parent__isnull=True).order_by(
                "sort_order", "title"
            )

        # Update sort orders with proper spacing
        for index, page in enumerate(siblings):
            new_sort_order = (index + 1) * 10  # 10, 20, 30, 40, etc.
            if page.sort_order != new_sort_order:
                page.sort_order = new_sort_order
                page.save(update_fields=["sort_order"])

    def normalize_siblings_sort_orders(self):
        """Normalize sort orders for this page's siblings"""
        self.__class__.normalize_sort_orders(self.parent_id)

    def get_effective_css_data(self):
        """
        Get all CSS data for this page including theme, page-specific, and widget CSS.

        Returns:
            Dictionary with all CSS data needed for injection
        """
        # Prefer current published version data; fall back to latest version; then to page fields
        current_version = self.get_current_published_version()
        if not current_version:
            current_version = self.get_latest_version()

        version_page_css_variables = (
            getattr(current_version, "page_css_variables", None) or {}
        )
        version_page_custom_css = getattr(current_version, "page_custom_css", None)
        version_enable_css_injection = (
            getattr(current_version, "enable_css_injection", None)
            if current_version is not None
            else None
        )

        css_data = {
            "theme_css_variables": {},
            "theme_custom_css": "",
            "page_css_variables": (
                version_page_css_variables
                if version_page_css_variables
                else (self.page_css_variables or {})
            ),
            "page_custom_css": (
                version_page_custom_css
                if version_page_custom_css is not None
                else (self.page_custom_css or "")
            ),
            # CSS injection priority: version-level setting > page-level setting
            "enable_css_injection": (
                version_enable_css_injection
                if version_enable_css_injection is not None
                else (
                    self.enable_css_injection
                    if self.enable_css_injection is not None
                    else True
                )
            ),
            "layout_css": "",
            "widgets_css": {},
            "css_dependencies": [],
        }

        # Safety override: explicit page-level disable always wins
        if self.enable_css_injection is False:
            css_data["enable_css_injection"] = False

        # Get theme CSS
        effective_theme = self.get_effective_theme()
        if effective_theme:
            css_data["theme_css_variables"] = effective_theme.css_variables or {}
            css_data["theme_custom_css"] = effective_theme.custom_css or ""

        # Get layout CSS
        effective_layout = self.get_effective_layout()
        if effective_layout and hasattr(effective_layout, "css_classes"):
            css_data["layout_css"] = effective_layout.css_classes or ""

        # Merge CSS variables (page overrides theme)
        merged_variables = css_data["theme_css_variables"].copy()
        merged_variables.update(css_data["page_css_variables"])
        css_data["merged_css_variables"] = merged_variables

        return css_data

    def get_widget_css_data(self):
        """
        Get CSS data from all widgets on this page.

        Returns:
            Dictionary with widget CSS data organized by slot and widget
        """
        from .css_validation import css_injection_manager

        widgets_css = {}
        css_dependencies = []

        # Get widgets for this page (you might need to adjust this based on your widget model)
        try:
            widgets = self.widgets.all() if hasattr(self, "widgets") else []

            for widget in widgets:
                widget_type = widget.widget_type
                if hasattr(widget_type, "get_css_for_injection"):
                    scope_id = css_injection_manager.generate_css_scope_id(
                        widget_id=str(widget.id),
                        page_id=str(self.id),
                        slot_name=widget.slot_name,
                    )

                    css_data = widget_type.get_css_for_injection(widget, scope_id)

                    if css_data.get("enable_injection") and css_data.get("widget_css"):
                        slot_name = widget.slot_name
                        if slot_name not in widgets_css:
                            widgets_css[slot_name] = []

                        widgets_css[slot_name].append(
                            {
                                "widget_id": widget.id,
                                "widget_type": widget_type.name,
                                "css_data": css_data,
                            }
                        )

                    # Collect CSS dependencies
                    dependencies = css_data.get("css_dependencies", [])
                    css_dependencies.extend(dependencies)

        except Exception as e:
            # Handle gracefully if widget system isn't fully integrated yet
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(f"Could not load widget CSS data: {e}")

        return {
            "widgets_css": widgets_css,
            "css_dependencies": list(set(css_dependencies)),  # Remove duplicates
        }

    def validate_page_css(self):
        """
        Validate all CSS content on this page.

        Returns:
            Tuple of (is_valid, errors, warnings)
        """
        from .css_validation import css_injection_manager

        all_errors = []
        all_warnings = []

        # Validate page custom CSS
        if self.page_custom_css:
            is_valid, _, errors = css_injection_manager.validate_and_inject_css(
                self.page_custom_css, context=f"Page: {self.title}"
            )
            if not is_valid:
                all_errors.extend([f"Page CSS: {error}" for error in errors])

        # Validate theme CSS if we have one
        effective_theme = self.get_effective_theme()
        if effective_theme and effective_theme.custom_css:
            is_valid, _, errors = css_injection_manager.validate_and_inject_css(
                effective_theme.custom_css, context=f"Theme: {effective_theme.name}"
            )
            if not is_valid:
                all_errors.extend([f"Theme CSS: {error}" for error in errors])

        # Validate widget CSS
        widget_css_data = self.get_widget_css_data()
        for slot_name, widgets in widget_css_data["widgets_css"].items():
            for widget_info in widgets:
                css_data = widget_info["css_data"]
                if css_data.get("widget_css"):
                    is_valid, _, errors = css_injection_manager.validate_and_inject_css(
                        css_data["widget_css"],
                        context=f"Widget: {widget_info['widget_type']}",
                    )
                    if not is_valid:
                        all_errors.extend(
                            [
                                f"Widget {widget_info['widget_type']}: {error}"
                                for error in errors
                            ]
                        )

        return len(all_errors) == 0, all_errors, all_warnings

    def generate_complete_css(self, include_scoping=True):
        """
        Generate complete CSS for this page including all sources.

        Args:
            include_scoping: Whether to apply CSS scoping

        Returns:
            Complete CSS string for injection
        """
        from .css_validation import css_injection_manager

        css_parts = []
        css_data = self.get_effective_css_data()

        # Add CSS variables
        if css_data["merged_css_variables"]:
            variables_css = ":root {\n"
            for key, value in css_data["merged_css_variables"].items():
                if not key.startswith("--"):
                    key = f"--{key}"
                variables_css += f"  {key}: {value};\n"
            variables_css += "}\n"
            css_parts.append(variables_css)

        # Add theme custom CSS
        if css_data["theme_custom_css"]:
            css_parts.append(f"/* Theme CSS */\n{css_data['theme_custom_css']}")

        # Add layout CSS
        if css_data["layout_css"]:
            css_parts.append(f"/* Layout CSS */\n{css_data['layout_css']}")

        # Add page custom CSS
        if css_data["page_custom_css"]:
            if include_scoping:
                scope_id = css_injection_manager.generate_css_scope_id(
                    page_id=str(self.id)
                )
                scoped_css = css_injection_manager.scope_css(
                    css_data["page_custom_css"], scope_id, "page"
                )
                css_parts.append(f"/* Page CSS */\n{scoped_css}")
            else:
                css_parts.append(f"/* Page CSS */\n{css_data['page_custom_css']}")

        # Add widget CSS
        widget_css_data = self.get_widget_css_data()
        for slot_name, widgets in widget_css_data["widgets_css"].items():
            for widget_info in widgets:
                css_data = widget_info["css_data"]
                if css_data.get("widget_css"):
                    if include_scoping and css_data.get("scope") != "global":
                        (
                            is_valid,
                            scoped_css,
                            _,
                        ) = css_injection_manager.validate_and_inject_css(
                            css_data["widget_css"],
                            css_data.get("scope_id"),
                            css_data.get("scope", "widget"),
                            f"Widget: {widget_info['widget_type']}",
                        )
                        if is_valid:
                            css_parts.append(
                                f"/* Widget: {widget_info['widget_type']} */\n{scoped_css}"
                            )
                    else:
                        css_parts.append(
                            f"/* Widget: {widget_info['widget_type']} */\n{css_data['widget_css']}"
                        )

        return "\n\n".join(css_parts)

    def save(self, *args, **kwargs):
        """Override save to clear hostname cache when hostnames change."""
        # Check if hostnames are being changed (for cache invalidation)
        hostname_changed = False
        if self.pk:  # Only check for existing objects
            try:
                old_instance = WebPage.objects.get(pk=self.pk)
                if old_instance.hostnames != self.hostnames:
                    hostname_changed = True
            except WebPage.DoesNotExist:
                pass
        elif self.hostnames:  # New object with hostnames
            hostname_changed = True

        super().save(*args, **kwargs)

        # Clear hostname cache if hostnames changed
        if hostname_changed:
            self._clear_hostname_cache()

    def delete(self, *args, **kwargs):
        """Override delete to clear hostname cache if page had hostnames."""
        had_hostnames = bool(self.hostnames)
        super().delete(*args, **kwargs)

        if had_hostnames:
            self._clear_hostname_cache()

    def _clear_hostname_cache(self):
        """Clear the hostname cache when hostnames are updated."""
        try:
            from django.core.cache import cache

            cache.delete("webpages_allowed_hosts")

            # Also try to import and use the middleware method if available
            try:
                from .middleware import DynamicHostValidationMiddleware

                DynamicHostValidationMiddleware.clear_hostname_cache()
            except ImportError:
                pass

        except Exception:
            # Don't fail if cache is not available
            pass


class PageVersion(models.Model):
    """
    Version control system for pages. Stores complete page state snapshots.
    Enables rollback, comparison, and change tracking with draft/published workflow.
    """

    page = models.ForeignKey(WebPage, on_delete=models.CASCADE, related_name="versions")
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
        PageTheme,
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

    # Timestamps and ownership
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    class Meta:
        ordering = ["-version_number"]
        unique_together = ["page", "version_number"]

    def __str__(self):
        return f"{self.version_title} v{self.version_number}"

    def clean(self):
        """Validate the version data"""
        super().clean()

        # Validate effective and expiry dates
        if (
            self.effective_date
            and self.expiry_date
            and self.effective_date >= self.expiry_date
        ):
            from django.core.exceptions import ValidationError

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

    # def to_dict(self):
    #     """Convert version to dictionary representation"""
    #     return {
    #         "id": self.id,
    #         "page_id": self.page_id,
    #         "version_number": self.version_number,
    #         "version_title": self.version_title,
    #         "change_summary": self.change_summary,
    #         "meta_title": self.meta_title,
    #         "meta_description": self.meta_description,
    #         "slug": self.page.slug,
    #         "hostnames": self.page.hostnames,
    #         "code_layout": self.code_layout,
    #         "theme": self.theme,
    #         "page_css_variables": self.page_css_variables,
    #         "page_custom_css": self.page_custom_css,
    #         "enable_css_injection": self.enable_css_injection,
    #         "effective_date": self.effective_date,
    #         "expiry_date": self.expiry_date,
    #         # New date-based publishing status
    #         "publication_status": self.get_publication_status(),
    #         "is_published": self.is_published(),
    #         "is_current_published": self.is_current_published(),
    #         "created_at": self.created_at.isoformat() if self.created_at else None,
    #         "created_by": self.created_by.username if self.created_by else None,
    #         "page_data": self.page_data,
    #         "widgets": self.widgets,
    #     }


class PageDataSchema(models.Model):
    """
    Stores JSON Schema definitions for validating and driving page_data forms.

    Two types:
    - system: Single base schema applied to all pages (singleton, no name needed)
    - layout: Additional schema fields for specific layouts (extends system schema)
    """

    SCOPE_SYSTEM = "system"
    SCOPE_LAYOUT = "layout"
    SCOPE_CHOICES = (
        (SCOPE_SYSTEM, "System"),
        (SCOPE_LAYOUT, "Layout"),
    )

    # name is only used for layout schemas, system schema doesn't need a name
    name = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default=SCOPE_SYSTEM)
    layout_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of the code-based layout this schema applies to (scope=layout)",
    )
    schema = models.JSONField(help_text="JSON Schema draft-07+ definition")
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    class Meta:
        indexes = [
            models.Index(
                fields=["scope", "layout_name", "is_active"],
                name="pds_scope_layout_active_idx",
            ),
            models.Index(fields=["is_active"], name="pds_active_idx"),
        ]
        ordering = ["-updated_at", "name"]
        constraints = [
            # Only one active system schema allowed
            models.UniqueConstraint(
                fields=["scope"],
                condition=models.Q(scope="system", is_active=True),
                name="unique_active_system_schema",
            ),
            # Only one active layout schema per layout
            models.UniqueConstraint(
                fields=["scope", "layout_name"],
                condition=models.Q(scope="layout", is_active=True),
                name="unique_active_layout_schema",
            ),
        ]

    def clean(self):
        super().clean()
        if self.scope == self.SCOPE_SYSTEM:
            # System schema doesn't need name or layout_name
            self.name = ""
            self.layout_name = ""
        elif self.scope == self.SCOPE_LAYOUT:
            # Layout schema requires layout_name
            if not self.layout_name:
                raise ValidationError("Layout schema must specify a layout_name")
            if not self.name:
                self.name = f"{self.layout_name} Schema"

    def __str__(self):
        if self.scope == self.SCOPE_LAYOUT:
            return f"{self.layout_name} Layout Schema"
        return "System Schema"

    @classmethod
    def get_effective_schema_for_layout(cls, layout_name: str | None):
        """
        Compute the effective JSON Schema for a given layout name.

        The system schema is the base, and layout schemas extend it.
        System schema fields are mandatory and cannot be removed.

        Returns the merged schema or just system schema if no layout-specific schema exists.
        """
        from django.db.models import Q

        # Get the single active system schema
        system_schema_obj = cls.objects.filter(
            scope=cls.SCOPE_SYSTEM, is_active=True
        ).first()

        layout_schema_obj = None
        if layout_name:
            layout_schema_obj = cls.objects.filter(
                scope=cls.SCOPE_LAYOUT, layout_name=layout_name, is_active=True
            ).first()

        if not system_schema_obj:
            # If no system schema, return layout schema if available
            return layout_schema_obj.schema if layout_schema_obj else None

        system_schema = system_schema_obj.schema

        if not layout_schema_obj:
            # Just return system schema
            return system_schema

        # Merge system schema (base) with layout schema (extensions)
        layout_schema = layout_schema_obj.schema

        # Create merged schema
        merged_properties = {}
        merged_required = []

        # Start with system schema properties (these are mandatory)
        if system_schema.get("properties"):
            merged_properties.update(system_schema["properties"])
        if system_schema.get("required"):
            merged_required.extend(system_schema["required"])

        # Add layout-specific properties (cannot override system properties)
        if layout_schema.get("properties"):
            for prop_name, prop_def in layout_schema["properties"].items():
                if (
                    prop_name not in merged_properties
                ):  # Don't allow override of system fields
                    merged_properties[prop_name] = prop_def

        # Add layout-specific required fields
        if layout_schema.get("required"):
            for req_field in layout_schema["required"]:
                if req_field not in merged_required:
                    merged_required.append(req_field)

        merged_schema = {"type": "object", "properties": merged_properties}

        if merged_required:
            merged_schema["required"] = merged_required

        # Normalize the merged schema to ensure consistent case
        return cls._normalize_schema_case(merged_schema)

    @classmethod
    def _normalize_schema_case(cls, schema):
        """
        Normalize schema to use consistent snake_case for properties and required fields.
        This handles both camelCase and snake_case schemas for backwards compatibility.
        """
        if not isinstance(schema, dict):
            return schema

        normalized_schema = {}

        for key, value in schema.items():
            if key == "properties" and isinstance(value, dict):
                # Normalize property names to snake_case
                normalized_properties = {}
                for prop_key, prop_value in value.items():
                    snake_key = cls._camel_to_snake(prop_key)
                    normalized_properties[snake_key] = prop_value
                normalized_schema["properties"] = normalized_properties

            elif key == "required" and isinstance(value, list):
                # Normalize required field names to snake_case
                normalized_schema["required"] = [
                    cls._camel_to_snake(field) for field in value
                ]

            elif key in ["property_order", "propertyOrder"] and isinstance(value, list):
                # Normalize property order field names to snake_case and use snake_case key
                normalized_schema["property_order"] = [
                    cls._camel_to_snake(field) for field in value
                ]

            else:
                normalized_schema[key] = value

        return normalized_schema

    @classmethod
    def _camel_to_snake(cls, name):
        """Convert camelCase to snake_case"""
        import re

        # Handle the case where name is already snake_case
        if "_" in name and name.islower():
            return name
        s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
        return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()

    @classmethod
    def _snake_to_camel(cls, name):
        """Convert snake_case to camelCase"""
        if "_" not in name:
            return name
        components = name.split("_")
        return components[0] + "".join(word.capitalize() for word in components[1:])

    @classmethod
    def _convert_camel_to_snake_keys(cls, obj):
        """Convert object keys from camelCase to snake_case recursively"""
        if obj is None or not isinstance(obj, dict):
            return obj

        converted = {}
        for key, value in obj.items():
            snake_key = cls._camel_to_snake(key)
            if isinstance(value, dict):
                converted[snake_key] = cls._convert_camel_to_snake_keys(value)
            elif isinstance(value, list):
                converted[snake_key] = [
                    (
                        cls._convert_camel_to_snake_keys(item)
                        if isinstance(item, dict)
                        else item
                    )
                    for item in value
                ]
            else:
                converted[snake_key] = value
        return converted
