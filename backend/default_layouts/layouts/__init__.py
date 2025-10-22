"""
Layout implementations for default_layouts.

This module contains individual layout implementations organized into separate files.
"""

# Import all layout classes to make them available when the module is imported
from .single_column import SingleColumnLayout
from .error_layouts import (
    Error404Layout,
    Error500Layout,
    Error403Layout,
    Error503Layout,
)

# Additional layouts would be imported here as they are created:
# from .two_column import TwoColumnLayout
# from .three_column import ThreeColumnLayout
# from .landing_page import LandingPageLayout
# from .minimal import MinimalLayout
# from .sidebar import SidebarLayout

# Make all layouts available at the package level
__all__ = [
    "SingleColumnLayout",
    "Error404Layout",
    "Error500Layout",
    "Error403Layout",
    "Error503Layout",
    # Additional layouts would be added here
]
