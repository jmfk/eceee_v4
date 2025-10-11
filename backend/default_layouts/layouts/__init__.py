"""
Layout implementations for default_layouts.

This module contains individual layout implementations organized into separate files.
"""

# Import all layout classes to make them available when the module is imported
from .single_column import SingleColumnLayout

# Additional layouts would be imported here as they are created:
# from .two_column import TwoColumnLayout
# from .three_column import ThreeColumnLayout
# from .landing_page import LandingPageLayout
# from .minimal import MinimalLayout
# from .sidebar import SidebarLayout

# Make all layouts available at the package level
__all__ = [
    "SingleColumnLayout",
    # Additional layouts would be added here
]
