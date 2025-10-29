"""
WebPage Model

Core page entity supporting hierarchical organization and inheritance.
"""

from django.db import models, transaction
from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.core.exceptions import ValidationError


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

    # URL pattern matching for dynamic object publishing
    # Uses secure registry-based patterns instead of arbitrary regex
    path_pattern_key = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Select a predefined pattern for dynamic path matching. "
        "Patterns are defined in code for security. See path_pattern_registry for available patterns.",
        db_column="path_pattern",  # Keep same DB column to avoid migration issues
    )

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

    # Site branding (for root pages)
    site_icon = models.ImageField(
        upload_to="site_icons/",
        null=True,
        blank=True,
        help_text="Site icon/favicon for this root page. Will be resized to multiple sizes using imgproxy. Only available for root pages (pages without parent).",
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

    # Soft delete support
    is_deleted = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Whether this page is marked as deleted (soft delete for reversibility)",
    )
    deleted_at = models.DateTimeField(
        null=True, blank=True, help_text="When this page was marked as deleted"
    )
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="deleted_pages",
        null=True,
        blank=True,
        help_text="User who deleted this page",
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

        # Root page: if it has hostnames, slug is silent (returns "/")
        if self.hostnames:
            return "/"

        # Root page without hostnames: include slug
        slug_part = (self.slug or "").strip("/")
        return f"/{slug_part}/"

    def is_root_page(self):
        """Check if this is a root page (no parent)"""
        return self.parent is None

    def get_root_page(self):
        """Get the root page for this page (traverses up the hierarchy)"""
        if self.is_root_page():
            return self

        current = self.parent
        while current and current.parent:
            current = current.parent
        return current

    def has_silent_slug(self):
        """Check if this page's slug should be silent (not appear in URLs)"""
        return self.is_root_page() and bool(self.hostnames)

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
        from ..layout_registry import layout_registry

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
            from ..layout_registry import layout_registry

            if layout_registry.is_registered(current_version.code_layout):
                return "code"
        if self.parent:
            return "inherited"
        return None

    def get_effective_theme(self):
        """Get the theme for this page, inheriting from parent if needed"""
        # Avoid circular import
        from .page_theme import PageTheme

        # Check current published version theme
        current_version = self.get_current_published_version()
        if current_version and current_version.theme:
            return current_version.theme

        # Check parent theme (recursive)
        if self.parent:
            parent_theme = self.parent.get_effective_theme()
            if parent_theme:
                return parent_theme

        # Fall back to default theme
        default_theme = PageTheme.get_default_theme()
        if default_theme:
            return default_theme

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

    def _slug_exists_for_parent(self, slug, parent):
        """Check if a slug already exists for siblings (same parent)"""
        if not slug:
            return False

        queryset = WebPage.objects.filter(parent=parent, slug=slug, is_deleted=False)

        # Exclude self if this is an update operation
        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        return queryset.exists()

    def _get_unique_slug(self, slug, parent):
        """
        Get a unique slug for the given parent by appending numeric suffix if needed.

        Returns:
            tuple: (unique_slug, was_modified)
        """
        if not slug:
            return slug, False

        # Check if original slug is available
        if not self._slug_exists_for_parent(slug, parent):
            return slug, False

        # Find next available numeric suffix
        base_slug = slug
        counter = 2

        while self._slug_exists_for_parent(slug, parent):
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug, True

    def ensure_unique_slug(self):
        """
        Ensure slug is unique within parent by auto-renaming if needed.

        Returns:
            dict: Contains 'modified' (bool) and 'original_slug' (str) if modified
        """
        if not self.slug:
            return {"modified": False, "original_slug": None}

        original_slug = self.slug
        self.slug, was_modified = self._get_unique_slug(self.slug, self.parent)

        if was_modified:
            return {
                "modified": True,
                "original_slug": original_slug,
                "new_slug": self.slug,
            }

        return {"modified": False, "original_slug": None}

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

        # Validate site_icon assignment
        if self.site_icon and self.parent is not None:
            raise ValidationError(
                "Only root pages (pages without a parent) can have a site icon."
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

        # Validate path_pattern_key against registry
        if self.path_pattern_key:
            from ..path_pattern_registry import path_pattern_registry

            if not path_pattern_registry.is_registered(self.path_pattern_key):
                raise ValidationError(
                    f"Invalid path pattern key: '{self.path_pattern_key}'. "
                    f"Must be one of: {', '.join(path_pattern_registry.list_pattern_keys())}"
                )

        # Validate HTTP error code slugs (400-599)
        if self.slug and self.slug.isdigit():
            error_code = int(self.slug)
            if 400 <= error_code <= 599:
                # This is an error page
                if self.parent is None:
                    raise ValidationError(
                        "Error pages must be under a root page (not at root level). "
                        f"Slug '{self.slug}' is reserved for HTTP error pages."
                    )
                if self.parent.parent is not None:
                    raise ValidationError(
                        "Error pages must be direct children of root pages. "
                        f"Slug '{self.slug}' is reserved for HTTP error pages."
                    )

                # Ensure uniqueness of error code within the same parent (site)
                conflicting_error_pages = WebPage.objects.filter(
                    parent=self.parent, slug=self.slug, is_deleted=False
                ).exclude(pk=self.pk)

                if conflicting_error_pages.exists():
                    raise ValidationError(
                        f"An error page with code '{self.slug}' already exists for this site."
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
        from ..layout_registry import layout_registry

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
        from .page_theme import PageTheme

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
        """
        Get detailed information about widget inheritance for all slots.

        Supports two inheritance modes:
        - MERGE: Inherited widgets + local widgets (inherited first)
        - REPLACE: Local widgets replace all inherited widgets

        Widget visibility controlled by:
        - is_published: On/off switch
        - publish_effective_date/publish_expire_date: Temporal visibility
        - inheritance_level: How many levels deep widget inherits (-1 = infinite, 0 = page only)
        - inherit_from_parent: Master on/off for inheritance
        """
        from django.utils import timezone

        inheritance_info = {}

        # Get all slots from effective layout
        effective_layout = self.get_effective_layout()
        if not effective_layout or not effective_layout.slot_configuration:
            return inheritance_info

        slots = effective_layout.slot_configuration.get("slots", [])

        for slot in slots:
            slot_name = slot["name"]

            # Get slot configuration for inheritance rules
            slot_allows_inheritance = slot.get(
                "allows_inheritance", slot_name in ["header", "footer", "sidebar"]
            )
            # Support new allow_merge field (preferred) and fallback to old naming for compatibility
            slot_allow_merge = slot.get(
                "allow_merge",
                not slot.get(
                    "allows_replacement_only", slot.get("requires_local", False)
                ),
            )
            # Get inheritable widget types (empty list means inherit all types)
            slot_inheritable_types = slot.get("inheritable_types", [])

            inheritance_info[slot_name] = {
                "widgets": [],
                "inheritance_chain": [],
                "can_override": True,
                "merge_mode": slot_allows_inheritance and slot_allow_merge,
                "inheritable_types": slot_inheritable_types,  # NEW
            }

            # If slot doesn't allow inheritance at all, only get local widgets
            if not slot_allows_inheritance:
                current_version = (
                    self.get_current_published_version() or self.get_latest_version()
                )
                if current_version and current_version.widgets:
                    local_widgets = self._filter_published_widgets(
                        current_version.widgets.get(slot_name, [])
                    )
                    # Use array position as order - no need to sort
                    for widget_data in local_widgets:
                        inheritance_info[slot_name]["widgets"].append(
                            {
                                "widget": widget_data,
                                "page": self,
                                "inherited_from": None,
                                "is_override": widget_data.get(
                                    "override_parent", False
                                ),
                                "allows_inheritance": widget_data.get(
                                    "inherit_from_parent", True
                                ),
                            }
                        )
                continue

            # Collect widgets from inheritance chain with level tracking
            current = self
            depth = 0
            slot_has_local_widgets = False
            inherited_widgets_found = False
            local_widgets = []
            inherited_widgets = []
            all_inherited_widgets = (
                []
            )  # Collect ALL inherited for API (not filtered by logic)

            while current:
                # Get current published version, or fallback to latest version for editor
                current_version = current.get_current_published_version()
                if not current_version:
                    current_version = current.get_latest_version()

                page_widgets = []
                has_overrides = False

                if current_version and current_version.widgets:
                    # Get widgets for this slot from JSON data
                    widgets_data = current_version.widgets
                    raw_widgets = widgets_data.get(slot_name, [])

                    # Filter by publishing status and dates
                    published_widgets = self._filter_published_widgets(raw_widgets)

                    # Filter by inheritance level
                    page_widgets = [
                        w
                        for w in published_widgets
                        if self._widget_inheritable_at_depth(w, depth)
                    ]

                    # Use array position as order - no need to sort

                    # Check if current page (self) has widgets in this slot
                    if current == self and len(page_widgets) > 0:
                        slot_has_local_widgets = True
                        local_widgets = page_widgets

                    # Process widgets from this level
                    for widget_data in page_widgets:
                        # Check if widget type is allowed for inheritance (if inheritable_types is specified)
                        inheritable_types = inheritance_info[slot_name].get(
                            "inheritable_types", []
                        )
                        widget_type = widget_data.get("widget_type") or widget_data.get(
                            "type"
                        )

                        # If inheritable_types is specified and widget is from parent, filter by type
                        is_from_parent = current != self
                        if (
                            is_from_parent
                            and inheritable_types
                            and widget_type not in inheritable_types
                        ):
                            # Skip this widget - type not in inheritable list
                            continue

                        widget_info = {
                            "widget": widget_data,
                            "page": current,
                            "inherited_from": current if current != self else None,
                            "is_override": widget_data.get("override_parent", False),
                            "allows_inheritance": widget_data.get(
                                "inherit_from_parent", True
                            ),
                            "inheritance_level": widget_data.get(
                                "inheritance_level", 0
                            ),
                            "depth": depth,
                        }

                        is_from_current = current == self

                        # Collect ALL inherited widgets for API (regardless of merge logic)
                        if not is_from_current and widget_info.get("inherited_from"):
                            all_inherited_widgets.append(widget_info)

                        # MERGE MODE: Collect both inherited and local widgets
                        if inheritance_info[slot_name]["merge_mode"]:
                            if is_from_current:
                                # Will add local widgets at the end
                                pass
                            elif not inherited_widgets_found and widget_data.get(
                                "inherit_from_parent", True
                            ):
                                # First parent level with inheritable widgets
                                inherited_widgets.append(widget_info)
                        else:
                            # REPLACE MODE: Original behavior
                            is_from_parent_and_inheritable = (
                                current != self
                                and not slot_has_local_widgets
                                and widget_data.get("inherit_from_parent", True)
                            )

                            should_include = (
                                is_from_current or is_from_parent_and_inheritable
                            )

                            if should_include:
                                inheritance_info[slot_name]["widgets"].append(
                                    widget_info
                                )

                    # Check for overrides in this page's widgets
                    has_overrides = any(
                        w.get("override_parent", False) for w in page_widgets
                    )

                    # Mark that we found inheritable widgets at this level
                    if (
                        current != self
                        and len(page_widgets) > 0
                        and not inherited_widgets_found
                    ):
                        inherited_widgets_found = True

                inheritance_info[slot_name]["inheritance_chain"].append(
                    {
                        "page": current,
                        "widgets_count": len(page_widgets),
                        "has_overrides": has_overrides,
                        "depth": depth,
                    }
                )

                # REPLACE MODE: If current page has widgets, stop walking up the chain
                if (
                    not inheritance_info[slot_name]["merge_mode"]
                    and slot_has_local_widgets
                ):
                    break

                # MERGE MODE: Stop after finding first inheritable parent widgets
                if (
                    inheritance_info[slot_name]["merge_mode"]
                    and inherited_widgets_found
                    and slot_has_local_widgets
                ):
                    break

                current = current.parent
                depth += 1

            # TYPE-BASED REPLACEMENT: If local widgets match inheritable_types, skip all inherited
            if slot_inheritable_types and local_widgets:
                local_types = {
                    w.get("widget_type") or w.get("type") for w in local_widgets
                }
                # If any local widget type matches inheritable_types, clear inherited widgets
                if local_types & set(slot_inheritable_types):
                    inherited_widgets = []

            # MERGE MODE: Combine widgets based on inheritance behavior
            if inheritance_info[slot_name]["merge_mode"]:
                from ..json_models import WidgetInheritanceBehavior

                # Categorize local widgets by inheritance behavior
                before_widgets = []
                override_widgets = []
                after_widgets = []

                for widget_data in local_widgets:
                    widget_info = {
                        "widget": widget_data,
                        "page": self,
                        "inherited_from": None,
                        "is_override": widget_data.get("override_parent", False),
                        "allows_inheritance": widget_data.get(
                            "inherit_from_parent", True
                        ),
                        "inheritance_level": widget_data.get("inheritance_level", 0),
                        "depth": 0,
                    }

                    # Determine behavior (with backward compatibility)
                    behavior = widget_data.get("inheritance_behavior")
                    if not behavior:
                        if widget_data.get("override_parent", False):
                            behavior = WidgetInheritanceBehavior.OVERRIDE_PARENT
                        else:
                            behavior = WidgetInheritanceBehavior.INSERT_AFTER_PARENT

                    if behavior == WidgetInheritanceBehavior.OVERRIDE_PARENT:
                        override_widgets.append(widget_info)
                    elif behavior == WidgetInheritanceBehavior.INSERT_BEFORE_PARENT:
                        before_widgets.append(widget_info)
                    else:  # INSERT_AFTER_PARENT
                        after_widgets.append(widget_info)

                # Build final widget list: before + inherited + after
                # Override widgets replace ALL inherited widgets FOR RENDERING
                if override_widgets:
                    inheritance_info[slot_name]["widgets"] = override_widgets
                else:
                    final_widgets = before_widgets + inherited_widgets + after_widgets
                    inheritance_info[slot_name]["widgets"] = final_widgets

                # CRITICAL: Store ALL inherited widgets separately for API access
                # The API needs to always return inherited widgets, even when overridden
                inheritance_info[slot_name][
                    "inherited_widgets_raw"
                ] = all_inherited_widgets
            else:
                # REPLACE MODE: Store inherited widgets for API (even though they won't render)
                inheritance_info[slot_name][
                    "inherited_widgets_raw"
                ] = all_inherited_widgets

        return inheritance_info

    def _filter_published_widgets(self, widgets):
        """Filter widgets by publishing status and date range"""
        from django.utils import timezone

        now = timezone.now()
        published = []

        for widget in widgets:
            # Check is_published flag (default to True for backward compatibility)
            if not widget.get("is_published", True):
                continue

            # Check effective date
            effective_date = widget.get("publish_effective_date")
            if effective_date:
                from datetime import datetime

                if isinstance(effective_date, str):
                    effective_date = datetime.fromisoformat(
                        effective_date.replace("Z", "+00:00")
                    )
                if effective_date > now:
                    continue

            # Check expire date
            expire_date = widget.get("publish_expire_date")
            if expire_date:
                from datetime import datetime

                if isinstance(expire_date, str):
                    expire_date = datetime.fromisoformat(
                        expire_date.replace("Z", "+00:00")
                    )
                if expire_date < now:
                    continue

            published.append(widget)

        return published

    def _widget_inheritable_at_depth(self, widget, depth):
        """Check if widget should be inherited at the given depth"""
        from ..json_models import WidgetInheritanceBehavior

        # Get inheritance behavior (with backward compatibility)
        inheritance_behavior = widget.get("inheritance_behavior")
        if not inheritance_behavior:
            # Backward compatibility: convert old boolean fields
            inherit_from_parent = widget.get("inherit_from_parent", True)
            override_parent = widget.get("override_parent", False)

            if not inherit_from_parent:
                return depth == 0  # Only on its own page
            elif override_parent:
                inheritance_behavior = WidgetInheritanceBehavior.OVERRIDE_PARENT
            else:
                inheritance_behavior = WidgetInheritanceBehavior.INSERT_AFTER_PARENT

        # Check inheritance_level depth limits
        inheritance_level = widget.get("inheritance_level", 0)

        # -1 means infinite inheritance
        if inheritance_level == -1:
            return True

        # 0 means this page only
        if inheritance_level == 0:
            return depth == 0

        # Otherwise check if depth is within level
        return depth <= inheritance_level

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

            # Import PageVersion here to avoid circular import
            from .page_version import PageVersion

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
        from ..css_validation import css_injection_manager

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
        from ..css_validation import css_injection_manager

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
        from ..css_validation import css_injection_manager

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

    def soft_delete(self, user, recursive=False):
        """
        Mark this page as deleted (soft delete).

        Args:
            user: User performing the deletion
            recursive: If True, also soft delete all descendant pages

        Returns:
            int: Number of pages deleted
        """
        from django.utils import timezone

        count = 0

        if recursive:
            # Get all descendants
            descendants = self.get_all_descendants()
            for descendant in descendants:
                if not descendant.is_deleted:
                    descendant.is_deleted = True
                    descendant.deleted_at = timezone.now()
                    descendant.deleted_by = user
                    descendant.save(
                        update_fields=["is_deleted", "deleted_at", "deleted_by"]
                    )
                    count += 1

        # Delete the page itself
        if not self.is_deleted:
            self.is_deleted = True
            self.deleted_at = timezone.now()
            self.deleted_by = user
            self.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])
            count += 1

        return count

    def restore(self, user, recursive=False):
        """
        Restore a soft-deleted page.

        Args:
            user: User performing the restoration
            recursive: If True, also restore all descendant pages

        Returns:
            int: Number of pages restored
        """
        count = 0

        if recursive:
            # Get all descendants
            descendants = self.get_all_descendants(include_deleted=True)
            for descendant in descendants:
                if descendant.is_deleted:
                    descendant.is_deleted = False
                    descendant.deleted_at = None
                    descendant.deleted_by = None
                    descendant.last_modified_by = user
                    descendant.save(
                        update_fields=[
                            "is_deleted",
                            "deleted_at",
                            "deleted_by",
                            "last_modified_by",
                        ]
                    )
                    count += 1

        # Restore the page itself
        if self.is_deleted:
            self.is_deleted = False
            self.deleted_at = None
            self.deleted_by = None
            self.last_modified_by = user
            self.save(
                update_fields=[
                    "is_deleted",
                    "deleted_at",
                    "deleted_by",
                    "last_modified_by",
                ]
            )
            count += 1

        return count

    def get_all_descendants(self, include_deleted=False):
        """
        Get all descendant pages recursively.

        Args:
            include_deleted: If True, include soft-deleted pages in results

        Returns:
            QuerySet: All descendant pages
        """
        descendants = []

        def collect_descendants(page):
            queryset = page.children.all()
            if not include_deleted:
                queryset = queryset.filter(is_deleted=False)

            for child in queryset:
                descendants.append(child)
                collect_descendants(child)

        collect_descendants(self)
        return descendants

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
                from ..middleware import DynamicHostValidationMiddleware

                DynamicHostValidationMiddleware.clear_hostname_cache()
            except ImportError:
                pass

        except Exception:
            # Don't fail if cache is not available
            pass
