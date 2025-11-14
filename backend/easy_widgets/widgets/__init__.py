"""
Widget implementations for easy_widgets.

This module contains individual widget implementations organized into separate files.
"""

# Import all widget classes to make them available when the module is imported
from .content import ContentWidget
from .content_card import ContentCardWidget
from .banner import BannerWidget
from .image import ImageWidget
from .table import TableWidget
from .footer import FooterWidget
from .header import HeaderWidget
from .hero import HeroWidget
from .navbar import NavbarWidget
from .navigation import NavigationWidget
from .sidebar import SidebarWidget
from .forms import FormsWidget
from .two_columns import TwoColumnsWidget
from .three_columns import ThreeColumnsWidget
from .section import SectionWidget
from .path_debug import PathDebugWidget
from .news_list import NewsListWidget
from .news_detail import NewsDetailWidget
from .top_news_plug import TopNewsPlugWidget
from .sidebar_top_news import SidebarTopNewsWidget

# Make all widgets available at the package level
__all__ = [
    "ContentWidget",
    "ContentCardWidget",
    "BannerWidget",
    "ImageWidget",
    "TableWidget",
    "FooterWidget",
    "HeaderWidget",
    "HeroWidget",
    "NavbarWidget",
    "NavigationWidget",
    "SidebarWidget",
    "FormsWidget",
    "TwoColumnsWidget",
    "ThreeColumnsWidget",
    "SectionWidget",
    "PathDebugWidget",
    "NewsListWidget",
    "NewsDetailWidget",
    "TopNewsPlugWidget",
    "SidebarTopNewsWidget",
]
