"""
EASY Layouts App

This app contains layout implementations for the easy_v4 CMS.
Layouts are automatically registered when this app is imported.
"""

# Import the layout registry to ensure all layouts are registered
from . import layout_registry

# Import all layout classes to trigger their registration
from .layouts import (
    MainLayoutLayout,
    LandingPageLayout,
)
