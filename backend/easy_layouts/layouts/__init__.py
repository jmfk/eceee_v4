"""
Layout classes for easy_layouts app.

All layout classes automatically register themselves when imported.
"""

from .landing_page import LandingPageLayout
from .main_layout import MainLayoutLayout
from .minimal import MinimalLayout
from .sidebar_layout import SidebarLayout
from .three_column import ThreeColumnLayout
from .two_column import TwoColumnLayout

__all__ = [
    "LandingPageLayout",
    "MainLayoutLayout",
    "MinimalLayout",
    "SidebarLayout",
    "ThreeColumnLayout",
    "TwoColumnLayout",
]
