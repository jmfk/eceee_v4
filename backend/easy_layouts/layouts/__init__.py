"""
Layout classes for easy_layouts app.

All layout classes automatically register themselves when imported.
"""

from .landing_page import LandingPageLayout
from .main_layout import MainLayoutLayout
from .error_layouts import Error404Layout, Error500Layout, Error403Layout, Error503Layout

__all__ = [
    "LandingPageLayout",
    "MainLayoutLayout",
    "Error404Layout",
    "Error500Layout",
    "Error403Layout",
    "Error503Layout",
]
