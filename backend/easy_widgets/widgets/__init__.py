"""
Widget implementations for easy_widgets.

This module contains individual widget implementations organized into separate files.
"""

from .banner import BannerWidget
from .bio import BioWidget

# Import all widget classes to make them available when the module is imported
from .content import ContentWidget
from .content_card import ContentCardWidget
from .footer import FooterWidget
from .forms import FormsWidget
from .header import HeaderWidget
from .headline import HeadlineWidget
from .hero import HeroWidget
from .image import ImageWidget
from .navbar import NavbarWidget
from .navigation import NavigationWidget
from .news_detail import NewsDetailWidget
from .news_flash import NewsFlashWidget
from .news_list import NewsListWidget
from .path_debug import PathDebugWidget
from .section import SectionWidget
from .sidebar import SidebarWidget
from .sidebar_top_news import SidebarTopNewsWidget
from .table import TableWidget
from .three_columns import ThreeColumnsWidget
from .top_news_plug import TopNewsPlugWidget
from .two_columns import TwoColumnsWidget

# Make all widgets available at the package level
__all__ = [
    "ContentWidget",
    "ContentCardWidget",
    "BannerWidget",
    "BioWidget",
    "ImageWidget",
    "TableWidget",
    "FooterWidget",
    "HeaderWidget",
    "HeadlineWidget",
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
    "NewsFlashWidget",
    "NewsDetailWidget",
    "TopNewsPlugWidget",
    "SidebarTopNewsWidget",
]
