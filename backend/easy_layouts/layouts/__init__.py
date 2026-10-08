"""
Layout classes for easy_layouts app.

All layout classes automatically register themselves when imported.
"""

from .error_layouts import Error403Layout, Error404Layout, Error500Layout, Error503Layout, ErrorLayout
from .landing_page import LandingPageLayout
from .main_layout import MainLayoutLayout

__all__ = [
    "LandingPageLayout",
    "MainLayoutLayout",
    "ErrorLayout",
    "Error404Layout",
    "Error500Layout",
    "Error403Layout",
    "Error503Layout",
]
