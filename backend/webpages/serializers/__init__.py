# Copyright (C) 2025 Johan Mats Fred Karlsson
#
# This file is part of easy_v4.
#
# This program is licensed under the Server Side Public License, version 1,
# as published by MongoDB, Inc. See the LICENSE file for details.

"""
Web Page Publishing System Serializers

Re-exports all serializers for backward compatibility.
This package has been split from a single monolithic file into focused modules.
"""

# Base serializers
from .base import UserSerializer

# Layout serializers
from .layout import LayoutSerializer

# Page serializers
from .page import DeletedPageSerializer, PageHierarchySerializer, WebPageListSerializer, WebPageSimpleSerializer

# Schema serializers
from .schema import PageDataSchemaSerializer
from .site_package import (
    RemoteSiteImportCreateSerializer,
    RemoteSiteListSerializer,
    SitePackageAssessmentSerializer,
    SitePackageExportCreateSerializer,
    SitePackageImportCreateSerializer,
    SitePackageJobSerializer,
)

# Theme serializers
from .theme import PageThemeSerializer, PreviewSizeSerializer

# Version serializers
from .version import (
    MetadataUpdateSerializer,
    PageDataUpdateSerializer,
    PageVersionComparisonSerializer,
    PageVersionListSerializer,
    PageVersionSerializer,
    PublishingUpdateSerializer,
    WidgetUpdateSerializer,
)

__all__ = [
    # Base
    "UserSerializer",
    # Theme
    "PreviewSizeSerializer",
    "PageThemeSerializer",
    # Layout
    "LayoutSerializer",
    # Page
    "WebPageListSerializer",
    "WebPageSimpleSerializer",
    "PageHierarchySerializer",
    "DeletedPageSerializer",
    # Version
    "PageVersionSerializer",
    "PageVersionListSerializer",
    "PageVersionComparisonSerializer",
    "WidgetUpdateSerializer",
    "PageDataUpdateSerializer",
    "MetadataUpdateSerializer",
    "PublishingUpdateSerializer",
    # Schema
    "PageDataSchemaSerializer",
    "SitePackageExportCreateSerializer",
    "SitePackageAssessmentSerializer",
    "SitePackageImportCreateSerializer",
    "SitePackageJobSerializer",
    "RemoteSiteListSerializer",
    "RemoteSiteImportCreateSerializer",
]
