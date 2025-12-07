# Copyright (C) 2025 Johan Mats Fred Karlsson
#
# This file is part of easy_v4.
#
# This program is licensed under the Server Side Public License, version 1,
# as published by MongoDB, Inc. See the LICENSE file for details.

"""
Page-related serializers for the Web Page Publishing System
"""

from typing import TYPE_CHECKING
from rest_framework import serializers
from ..models import WebPage
from .base import UserSerializer
from .theme import PageThemeSerializer

if TYPE_CHECKING:
    from .version import PageVersionSerializer


class WebPageSimpleSerializer(serializers.ModelSerializer):
    """Page serializer with version management support"""

    parent_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )

    created_by = UserSerializer(read_only=True)
    last_modified_by = UserSerializer(read_only=True)

    # Computed fields (page-level only)
    absolute_url = serializers.SerializerMethodField()
    breadcrumbs = serializers.SerializerMethodField()
    effective_layout = serializers.SerializerMethodField()
    effective_theme = serializers.SerializerMethodField()
    layout_inheritance_info = serializers.SerializerMethodField()
    theme_inheritance_info = serializers.SerializerMethodField()
    available_code_layouts = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    is_deleted = serializers.SerializerMethodField()
    deleted_at = serializers.SerializerMethodField()
    deleted_by = serializers.SerializerMethodField()

    # Version management fields
    publication_status = serializers.SerializerMethodField()
    code_layout = serializers.SerializerMethodField()

    # Published version information
    published_version_id = serializers.SerializerMethodField()
    published_version_number = serializers.SerializerMethodField()
    published_effective_date = serializers.SerializerMethodField()

    # Latest draft version information
    latest_version_number = serializers.SerializerMethodField()
    latest_draft_version_id = serializers.SerializerMethodField()
    latest_draft_version_number = serializers.SerializerMethodField()
    has_unpublished_changes = serializers.SerializerMethodField()

    # Scheduled version information
    scheduled_version_id = serializers.SerializerMethodField()
    scheduled_version_number = serializers.SerializerMethodField()
    scheduled_effective_date = serializers.SerializerMethodField()
    
    # Short title from page_data
    short_title = serializers.SerializerMethodField()

    class Meta:
        model = WebPage
        fields = [
            "id",
            "slug",
            "title",
            "description",
            "parent_id",
            "sort_order",
            "hostnames",
            "site_icon",
            "path_pattern_key",
            "cached_path",
            "cached_root_id",
            "cached_root_hostnames",
            # Cached publication fields
            "is_currently_published",
            "cached_effective_date",
            "cached_expiry_date",
            "cache_updated_at",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "absolute_url",
            "breadcrumbs",
            "effective_layout",
            "effective_theme",
            "layout_inheritance_info",
            "theme_inheritance_info",
            "available_code_layouts",
            "children_count",
            "is_deleted",
            "deleted_at",
            "deleted_by",
            # Version management fields
            "publication_status",
            "code_layout",
            # Published version
            "published_version_id",
            "published_version_number",
            "published_effective_date",
            # Latest/draft version
            "latest_version_number",
            "latest_draft_version_id",
            "latest_draft_version_number",
            "has_unpublished_changes",
            # Scheduled version
            "scheduled_version_id",
            "scheduled_version_number",
            "scheduled_effective_date",
            # Short title
            "short_title",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "is_deleted",
            "deleted_at",
            "deleted_by",
        ]

    def __init__(self, *args, **kwargs):
        """Allow callers to include version info on demand.

        If `include_version_info=True` is passed either as a kwarg or via
        serializer context, two additional computed fields will be exposed:
        - is_published
        - current_published_version
        """
        include_version_info = kwargs.pop("include_version_info", None)
        super().__init__(*args, **kwargs)

        if include_version_info is None:
            include_version_info = self.context.get("include_version_info", False)

        if include_version_info:
            # Add fields dynamically so the Meta.fields list remains unchanged
            self.fields["is_published"] = serializers.SerializerMethodField()
            self.fields["current_published_version"] = (
                serializers.SerializerMethodField()
            )

    def get_absolute_url(self, obj):
        return obj.get_absolute_url()

    def get_is_published(self, obj):
        return obj.is_published()

    def get_breadcrumbs(self, obj):
        breadcrumbs = obj.get_breadcrumbs()
        return [
            {"id": page.id, "title": page.title, "slug": page.slug}
            for page in breadcrumbs
        ]

    def get_effective_layout(self, obj):
        """Get the effective layout as a unified dictionary regardless of type"""
        return obj.get_effective_layout_dict()

    def get_effective_theme(self, obj):
        theme = obj.get_effective_theme()
        return PageThemeSerializer(theme).data if theme else None

    def get_layout_type(self, obj):
        """Get the type of layout: 'code', 'database', 'inherited', or None"""
        return obj.get_layout_type()

    def get_layout_inheritance_info(self, obj):
        """Get detailed layout inheritance information"""
        inheritance_info = obj.get_layout_inheritance_info()

        # Serialize the inheritance chain for API consumption
        serialized_chain = []
        for chain_item in inheritance_info["inheritance_chain"]:
            page = chain_item["page"]
            serialized_chain.append(
                {
                    "page_id": page.id,
                    "page_title": page.title,
                    "code_layout": chain_item["code_layout"],
                    "is_override": chain_item["is_override"],
                }
            )

        serialized_inheritance_info = {
            "effective_layout": (
                inheritance_info["effective_layout"].to_dict()
                if inheritance_info["effective_layout"]
                else None
            ),
            "effective_layout_dict": inheritance_info["effective_layout_dict"],
            "inherited_from": (
                {
                    "id": inheritance_info["inherited_from"].id,
                    "title": obj.title,
                }
                if inheritance_info["inherited_from"]
                else None
            ),
            "inheritance_chain": serialized_chain,
            "override_options": {
                "code_layouts": [
                    layout.to_dict()
                    for layout in inheritance_info["override_options"]["code_layouts"]
                ]
            },
        }

        return serialized_inheritance_info

    def get_theme_inheritance_info(self, obj):
        """Get detailed theme inheritance information"""
        inheritance_info = obj.get_theme_inheritance_info()

        # Serialize the inheritance chain for API consumption
        serialized_chain = []
        for chain_item in inheritance_info["inheritance_chain"]:
            page = chain_item["page"]
            theme = chain_item["theme"]
            serialized_chain.append(
                {
                    "page_id": page.id,
                    "page_title": page.title,
                    "theme_id": theme.id if theme else None,
                    "theme_name": theme.name if theme else None,
                    "is_override": chain_item["is_override"],
                }
            )

        # Serialize effective theme
        effective_theme = inheritance_info["effective_theme"]
        serialized_effective_theme = None
        if effective_theme:
            serialized_effective_theme = {
                "id": effective_theme.id,
                "name": effective_theme.name,
                "description": effective_theme.description,
                "is_default": effective_theme.is_default,
            }

        # Serialize inherited_from page
        inherited_from = inheritance_info["inherited_from"]
        serialized_inherited_from = None
        if inherited_from:
            serialized_inherited_from = {
                "id": inherited_from.id,
                "title": inherited_from.title,
                "slug": inherited_from.slug,
            }

        # Serialize override options
        serialized_override_options = []
        for theme in inheritance_info["override_options"]:
            serialized_override_options.append(
                {
                    "id": theme.id,
                    "name": theme.name,
                    "description": theme.description,
                    "is_default": theme.is_default,
                }
            )

        serialized_inheritance_info = {
            "effective_theme": serialized_effective_theme,
            "inherited_from": serialized_inherited_from,
            "inheritance_chain": serialized_chain,
            "override_options": serialized_override_options,
        }

        return serialized_inheritance_info

    def get_available_code_layouts(self, obj):
        """Get list of available code layouts"""
        from ..layout_registry import layout_registry

        return [
            layout.to_dict()
            for layout in layout_registry.list_layouts(active_only=True)
        ]

    def get_children_count(self, obj):
        return obj.children.filter(is_deleted=False).count()

    def get_is_deleted(self, obj):
        """Get is_deleted field (safe if migration not run)"""
        return getattr(obj, "is_deleted", False)

    def get_deleted_at(self, obj):
        """Get deleted_at field (safe if migration not run)"""
        return getattr(obj, "deleted_at", None)

    def get_deleted_by(self, obj):
        """Get deleted_by field (safe if migration not run)"""
        deleted_by = getattr(obj, "deleted_by", None)
        if deleted_by:
            return UserSerializer(deleted_by).data
        return None

    # Version management methods
    def get_code_layout(self, obj):
        """Get code layout from published version"""
        if hasattr(obj, "_published_versions_list") and obj._published_versions_list:
            return obj._published_versions_list[0].code_layout or ""
        published_version = obj.get_current_published_version()
        if published_version:
            return published_version.code_layout or ""
        return ""

    def get_publication_status(self, obj):
        """Get publication status from current published version"""
        if hasattr(obj, "_published_versions_list") and obj._published_versions_list:
            return obj._published_versions_list[0].get_publication_status()

        published_version = obj.get_current_published_version()
        if published_version:
            return published_version.get_publication_status()

        # No published version - check for drafts
        if hasattr(obj, "_all_versions_list") and obj._all_versions_list:
            return obj._all_versions_list[0].get_publication_status()

        latest_version = obj.get_latest_version()
        if latest_version:
            return latest_version.get_publication_status()

        return "unpublished"

    # Published version methods
    def get_published_version_id(self, obj):
        """Get the ID of currently published version"""
        if hasattr(obj, "_published_versions_list") and obj._published_versions_list:
            return obj._published_versions_list[0].id
        published_version = obj.get_current_published_version()
        return published_version.id if published_version else None

    def get_published_version_number(self, obj):
        """Get the version number of currently published version"""
        if hasattr(obj, "_published_versions_list") and obj._published_versions_list:
            return obj._published_versions_list[0].version_number
        published_version = obj.get_current_published_version()
        return published_version.version_number if published_version else None

    def get_published_effective_date(self, obj):
        """Get the effective date of published version"""
        if hasattr(obj, "_published_versions_list") and obj._published_versions_list:
            return obj._published_versions_list[0].effective_date
        published_version = obj.get_current_published_version()
        return published_version.effective_date if published_version else None

    # Latest/draft version methods
    def get_latest_version_number(self, obj):
        """Get the latest version number (including drafts)"""
        if hasattr(obj, "_all_versions_list") and obj._all_versions_list:
            return obj._all_versions_list[0].version_number
        latest_version = obj.get_latest_version()
        return latest_version.version_number if latest_version else None

    def get_latest_draft_version_id(self, obj):
        """Get the ID of latest draft (unpublished) version"""
        if hasattr(obj, "_all_versions_list") and obj._all_versions_list:
            latest = obj._all_versions_list[0]
            if latest.get_publication_status() in ["draft", "unpublished"]:
                return latest.id
        else:
            latest_version = obj.get_latest_version()
            if latest_version and latest_version.get_publication_status() in [
                "draft",
                "unpublished",
            ]:
                return latest_version.id
        return None

    def get_latest_draft_version_number(self, obj):
        """Get the version number of latest draft"""
        if hasattr(obj, "_all_versions_list") and obj._all_versions_list:
            latest = obj._all_versions_list[0]
            if latest.get_publication_status() in ["draft", "unpublished"]:
                return latest.version_number
        else:
            latest_version = obj.get_latest_version()
            if latest_version and latest_version.get_publication_status() in [
                "draft",
                "unpublished",
            ]:
                return latest_version.version_number
        return None

    def get_has_unpublished_changes(self, obj):
        """Check if there are unpublished changes"""
        published_version = None
        latest_version = None

        if hasattr(obj, "_published_versions_list") and obj._published_versions_list:
            published_version = obj._published_versions_list[0]
        else:
            published_version = obj.get_current_published_version()

        if hasattr(obj, "_all_versions_list") and obj._all_versions_list:
            latest_version = obj._all_versions_list[0]
        else:
            latest_version = obj.get_latest_version()

        if not latest_version:
            return False

        if not published_version:
            # Has versions but none published
            return True

        # Has unpublished changes if latest version is newer than published
        return latest_version.version_number > published_version.version_number

    def get_short_title(self, obj):
        """Get short title from page_data if available"""
        # Try to get from current published version
        current_version = obj.get_current_published_version()
        if not current_version:
            # Fall back to latest version for editor
            current_version = obj.get_latest_version()
        
        if current_version and current_version.page_data:
            # Check both camelCase and snake_case
            short_title = current_version.page_data.get("shortTitle") or current_version.page_data.get("short_title")
            if short_title:
                # Guard against responsive breakpoint objects - only return if it's a string
                if isinstance(short_title, str):
                    return short_title
        
        return None

    # Scheduled version methods
    def get_scheduled_version_id(self, obj):
        """Get the ID of next scheduled version"""
        if hasattr(obj, "_scheduled_versions_list") and obj._scheduled_versions_list:
            return obj._scheduled_versions_list[0].id
        scheduled_version = self._get_scheduled_version(obj)
        return scheduled_version.id if scheduled_version else None

    def get_scheduled_version_number(self, obj):
        """Get the version number of next scheduled version"""
        if hasattr(obj, "_scheduled_versions_list") and obj._scheduled_versions_list:
            return obj._scheduled_versions_list[0].version_number
        scheduled_version = self._get_scheduled_version(obj)
        return scheduled_version.version_number if scheduled_version else None

    def get_scheduled_effective_date(self, obj):
        """Get the scheduled publication date"""
        if hasattr(obj, "_scheduled_versions_list") and obj._scheduled_versions_list:
            return obj._scheduled_versions_list[0].effective_date
        scheduled_version = self._get_scheduled_version(obj)
        return scheduled_version.effective_date if scheduled_version else None

    def _get_scheduled_version(self, obj):
        """Helper to get the next scheduled version"""
        from django.utils import timezone

        now = timezone.now()

        # Find the next version that will be published
        scheduled = (
            obj.versions.filter(effective_date__gt=now)
            .order_by("effective_date")
            .first()
        )

        return scheduled

    def validate(self, attrs):
        """Validate WebPage data including site_icon restrictions"""
        # Validate site_icon is only used for root pages
        if "site_icon" in attrs and attrs["site_icon"]:
            # Check if this is an update or create
            parent_id = attrs.get("parent_id")
            if parent_id is not None:  # Has a parent, not a root page
                raise serializers.ValidationError(
                    {
                        "site_icon": "Only root pages (pages without a parent) can have a site icon."
                    }
                )
            # For updates, check if the instance has a parent
            if self.instance and self.instance.parent_id is not None:
                raise serializers.ValidationError(
                    {
                        "site_icon": "Only root pages (pages without a parent) can have a site icon."
                    }
                )

        return super().validate(attrs)

    def create(self, validated_data):
        """Create a new WebPage with auto-slug uniqueness"""
        # Extract parent_id and set parent
        parent_id = validated_data.pop("parent_id", None)
        if parent_id:
            validated_data["parent"] = WebPage.objects.get(pk=parent_id)

        # Create the page instance (don't save yet)
        page = WebPage(**validated_data)

        # Ensure unique slug and track if modified
        slug_info = page.ensure_unique_slug()

        # Save the page
        page.save()

        # Store slug modification info in context for to_representation
        if slug_info["modified"]:
            self.context["slug_warning"] = {
                "field": "slug",
                "message": f"Slug '{slug_info['original_slug']}' was modified to '{slug_info['new_slug']}' to ensure uniqueness",
                "original_value": slug_info["original_slug"],
            }

        return page

    def update(self, instance, validated_data):
        """Update a WebPage with auto-slug uniqueness"""
        # Extract parent_id and set parent if provided
        parent_id = validated_data.pop("parent_id", None)
        if parent_id is not None:
            validated_data["parent"] = (
                WebPage.objects.get(pk=parent_id) if parent_id else None
            )

        # Update instance fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Ensure unique slug if slug was changed
        if "slug" in validated_data:
            slug_info = instance.ensure_unique_slug()

            # Store slug modification info in context for to_representation
            if slug_info["modified"]:
                self.context["slug_warning"] = {
                    "field": "slug",
                    "message": f"Slug '{slug_info['original_slug']}' was modified to '{slug_info['new_slug']}' to ensure uniqueness",
                    "original_value": slug_info["original_slug"],
                }

        # Save the instance
        instance.save()

        return instance

    def to_representation(self, instance):
        """Add warnings to representation if slug was modified"""
        data = super().to_representation(instance)

        # Add warnings if slug was auto-renamed
        if "slug_warning" in self.context:
            data["warnings"] = [self.context["slug_warning"]]
            # Clean up context to avoid leaking to other serializations
            del self.context["slug_warning"]

        return data


class PageHierarchySerializer(serializers.ModelSerializer):
    """Recursive serializer for complete page hierarchy"""

    title = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()
    publication_status = serializers.SerializerMethodField()
    effective_date = serializers.SerializerMethodField()
    expiry_date = serializers.SerializerMethodField()

    class Meta:
        model = WebPage
        fields = [
            "id",
            "title",
            "slug",
            "sort_order",
            "hostnames",
            "cached_path",
            "cached_root_id",
            "cached_root_hostnames",
            "publication_status",
            "effective_date",
            "expiry_date",
            "children",
        ]

    def get_title(self, obj):
        """Get title from WebPage model - for version title use PageVersionSerializer"""
        return obj.title or obj.slug or f"Page {obj.id}"

    def get_children(self, obj):
        # Filter children that are published based on their versions
        published_children = []
        for child in obj.children.order_by("sort_order"):
            if child.is_published():
                published_children.append(child)
        return PageHierarchySerializer(
            published_children, many=True, context=self.context
        ).data

    def get_publication_status(self, obj):
        """DEPRECATED: Get publication status from PageVersionSerializer instead"""
        return "unknown"

    def get_effective_date(self, obj):
        """DEPRECATED: Get dates from PageVersionSerializer instead"""
        return None

    def get_expiry_date(self, obj):
        """DEPRECATED: Get dates from PageVersionSerializer instead"""
        return None

    def get_current_published_version(self, obj):
        """DEPRECATED: Get version info via PageVersionViewSet instead"""
        return None


class DeletedPageSerializer(serializers.ModelSerializer):
    """Serializer for deleted pages with restoration metadata"""

    deleted_by_username = serializers.CharField(
        source="deleted_by.username", read_only=True
    )
    parent_path = serializers.SerializerMethodField()
    children_count = serializers.SerializerMethodField()
    can_restore = serializers.SerializerMethodField()
    restoration_warnings = serializers.SerializerMethodField()

    class Meta:
        model = WebPage
        fields = [
            "id",
            "title",
            "slug",
            "deleted_at",
            "deleted_by_username",
            "deletion_metadata",
            "parent_path",
            "children_count",
            "can_restore",
            "restoration_warnings",
        ]
        read_only_fields = fields

    def get_parent_path(self, obj):
        """Get formatted parent path from deletion metadata"""
        if obj.deletion_metadata:
            return obj.deletion_metadata.get("parent_path_display", "Unknown")
        return "Unknown"

    def get_children_count(self, obj):
        """Get number of deleted children"""
        return obj.children.filter(is_deleted=True).count()

    def get_can_restore(self, obj):
        """Check if page can be restored (parent exists or can be relocated)"""
        if not obj.deletion_metadata:
            return True  # No metadata, assume can restore to current location

        original_parent_id = obj.deletion_metadata.get("parent_id")

        # Root page can always be restored
        if not original_parent_id:
            return True

        # Check if original parent exists
        if WebPage.objects.filter(id=original_parent_id, is_deleted=False).exists():
            return True

        # Check if any ancestor in chain exists
        parent_chain = obj.deletion_metadata.get("parent_id_chain", [])
        for ancestor_id in parent_chain:
            if WebPage.objects.filter(id=ancestor_id, is_deleted=False).exists():
                return True

        # Can restore as root page
        return True

    def get_restoration_warnings(self, obj):
        """Get warnings about restoration (missing parent, slug conflicts)"""
        warnings = []

        if not obj.deletion_metadata:
            return warnings

        original_parent_id = obj.deletion_metadata.get("parent_id")

        # Check parent status
        if original_parent_id:
            if not WebPage.objects.filter(
                id=original_parent_id, is_deleted=False
            ).exists():
                # Find if alternative parent exists
                parent_chain = obj.deletion_metadata.get("parent_id_chain", [])
                alternative_found = False

                for ancestor_id in parent_chain:
                    try:
                        ancestor = WebPage.objects.get(id=ancestor_id, is_deleted=False)
                        warnings.append(
                            f"Original parent no longer exists. Will be restored under '{ancestor.title or ancestor.slug}'"
                        )
                        alternative_found = True
                        break
                    except WebPage.DoesNotExist:
                        continue

                if not alternative_found:
                    warnings.append(
                        "Original parent no longer exists. Will be restored as root page"
                    )

        # Check for slug conflicts
        target_parent_id = original_parent_id
        if (
            original_parent_id
            and not WebPage.objects.filter(
                id=original_parent_id, is_deleted=False
            ).exists()
        ):
            # Need to find alternative parent for slug check
            parent_chain = obj.deletion_metadata.get("parent_id_chain", [])
            for ancestor_id in parent_chain:
                if WebPage.objects.filter(id=ancestor_id, is_deleted=False).exists():
                    target_parent_id = ancestor_id
                    break
            else:
                target_parent_id = None

        # Check if slug conflicts with existing pages under target parent
        if obj.slug:
            conflicts = WebPage.objects.filter(
                parent_id=target_parent_id, slug=obj.slug, is_deleted=False
            ).exclude(id=obj.id)

            if conflicts.exists():
                warnings.append(
                    f"Slug '{obj.slug}' conflicts with existing page. Will be auto-renamed"
                )

        return warnings

