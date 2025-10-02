"""
Widget implementations for eceee_widgets.

This module contains individual widget implementations organized into separate files.
"""

# Import all widget classes to make them available when the module is imported
from .content import ContentWidget
from .image import ImageWidget
from .table import TableWidget
from .footer import FooterWidget
from .header import HeaderWidget
from .navigation import NavigationWidget
from .sidebar import SidebarWidget
from .forms import FormsWidget
from .two_columns import TwoColumnsWidget
from .three_columns import ThreeColumnsWidget

# Make all widgets available at the package level
__all__ = [
    "ContentWidget",
    "ImageWidget",
    "TableWidget",
    "FooterWidget",
    "HeaderWidget",
    "NavigationWidget",
    "SidebarWidget",
    "FormsWidget",
    "TwoColumnsWidget",
    "ThreeColumnsWidget",
]
