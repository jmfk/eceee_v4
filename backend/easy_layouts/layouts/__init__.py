"""
Layout classes for easy_layouts app.

All layout classes automatically register themselves when imported.
"""

from .landing_page import LandingPageLayout
from .main_layout import MainLayoutLayout

__all__ = [
    "LandingPageLayout",
    "MainLayoutLayout",
]
