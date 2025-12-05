# Copyright (C) 2025 Johan Mats Fred Karlsson
#
# This file is part of easy_v4.
#
# This program is licensed under the Server Side Public License, version 1,
# as published by MongoDB, Inc. See the LICENSE file for details.

"""
DEPRECATED: Import from webpages.serializers package instead

This file has been refactored into a modular package structure:
- webpages.serializers.base - UserSerializer
- webpages.serializers.theme - Theme and PreviewSize serializers
- webpages.serializers.layout - LayoutSerializer
- webpages.serializers.page - Page-related serializers
- webpages.serializers.version - Version and update serializers
- webpages.serializers.schema - PageDataSchemaSerializer

This file is kept for backward compatibility only.
All imports from 'webpages.serializers' continue to work unchanged.
"""

# Re-export all serializers from the package
from .serializers import *  # noqa: F401, F403

# Maintain backward compatibility for direct imports
__all__ = [
    # Base
    "UserSerializer",
    # Theme
    "PreviewSizeSerializer",
    "PageThemeSerializer",
    # Layout
    "LayoutSerializer",
    # Page
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
]
