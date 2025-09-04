"""
Built-in widget type implementations for the eceee_v4 CMS.

These widget types replace the database-defined WidgetType model and use
pydantic for configuration validation.
"""

from typing import Type
from pydantic import BaseModel

from webpages.widget_registry import BaseWidget, register_widget_type
from .widget_models import (
    ContentConfig,
    ImageConfig,
    TableConfig,
    FooterConfig,
    HeaderConfig,
    NavigationConfig,
    SidebarConfig,
    FormsConfig,
)


@register_widget_type
class ContentWidget(BaseWidget):
    """Content widget that contains HTML"""

    name = "Content"
    description = "Content widget that contains HTML"
    template_name = "webpages/widgets/content.html"

    widget_css = """
    .content-widget {
        font-family: var(--content-font, inherit);
        line-height: var(--content-line-height, 1.6);
        color: var(--content-color, inherit);
    }
    
    .content-widget h1, .content-widget h2, .content-widget h3,
    .content-widget h4, .content-widget h5, .content-widget h6 {
        margin-top: var(--heading-margin-top, 1.5rem);
        margin-bottom: var(--heading-margin-bottom, 0.5rem);
        font-weight: var(--heading-font-weight, 600);
    }
    
    .content-widget p {
        margin-bottom: var(--paragraph-margin, 1rem);
    }
    
    .content-widget ul, .content-widget ol {
        margin-bottom: var(--list-margin, 1rem);
        padding-left: var(--list-padding, 1.5rem);
    }
    
    .content-widget blockquote {
        border-left: var(--blockquote-border, 4px solid #e5e7eb);
        padding-left: var(--blockquote-padding, 1rem);
        margin: var(--blockquote-margin, 1.5rem 0);
        font-style: italic;
        color: var(--blockquote-color, #6b7280);
    }
    
    .content-widget code {
        background-color: var(--code-bg, #f3f4f6);
        padding: var(--code-padding, 0.125rem 0.25rem);
        border-radius: var(--code-radius, 0.25rem);
        font-family: var(--code-font, monospace);
        font-size: var(--code-font-size, 0.875rem);
    }
    
    .content-widget pre {
        background-color: var(--pre-bg, #1f2937);
        color: var(--pre-color, #f9fafb);
        padding: var(--pre-padding, 1rem);
        border-radius: var(--pre-radius, 0.5rem);
        overflow-x: auto;
        margin: var(--pre-margin, 1.5rem 0);
    }
    
    .content-widget pre code {
        background-color: transparent;
        padding: 0;
        color: inherit;
    }
    """

    css_variables = {
        "content-font": "inherit",
        "content-line-height": "1.6",
        "content-color": "inherit",
        "heading-margin-top": "1.5rem",
        "heading-margin-bottom": "0.5rem",
        "heading-font-weight": "600",
        "paragraph-margin": "1rem",
        "list-margin": "1rem",
        "list-padding": "1.5rem",
        "blockquote-border": "4px solid #e5e7eb",
        "blockquote-padding": "1rem",
        "blockquote-margin": "1.5rem 0",
        "blockquote-color": "#6b7280",
        "code-bg": "#f3f4f6",
        "code-padding": "0.125rem 0.25rem",
        "code-radius": "0.25rem",
        "code-font": "monospace",
        "code-font-size": "0.875rem",
        "pre-bg": "#1f2937",
        "pre-color": "#f9fafb",
        "pre-padding": "1rem",
        "pre-radius": "0.5rem",
        "pre-margin": "1.5rem 0",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ContentConfig


@register_widget_type
class ImageWidget(BaseWidget):
    """Image widget that contains image, image gallery, or video"""

    name = "Image"
    description = "Image widget that contains image, image gallery, or video"
    template_name = "webpages/widgets/image.html"

    widget_css = """
    .image-widget {
        display: block;
        text-align: var(--image-alignment, center);
    }
    
    .image-widget img {
        max-width: 100%;
        height: auto;
        border-radius: var(--image-radius, 0);
        box-shadow: var(--image-shadow, none);
        border: var(--image-border, none);
    }
    
    .image-widget video {
        max-width: 100%;
        height: auto;
        border-radius: var(--video-radius, 0.5rem);
        box-shadow: var(--video-shadow, 0 4px 6px rgba(0, 0, 0, 0.1));
    }
    
    .image-widget .caption {
        margin-top: var(--caption-margin-top, 0.5rem);
        font-size: var(--caption-font-size, 0.875rem);
        color: var(--caption-color, #6b7280);
        font-style: var(--caption-style, italic);
        text-align: var(--caption-alignment, center);
    }
    
    .image-widget .gallery {
        display: grid;
        grid-template-columns: repeat(var(--gallery-columns, 3), 1fr);
        gap: var(--gallery-gap, 1rem);
        margin: var(--gallery-margin, 1rem 0);
    }
    
    .image-widget .gallery img {
        width: 100%;
        height: var(--gallery-item-height, 200px);
        object-fit: cover;
        cursor: pointer;
        transition: transform 0.2s ease-in-out;
    }
    
    .image-widget .gallery img:hover {
        transform: scale(1.05);
    }
    
    .image-widget.size-small img,
    .image-widget.size-small video {
        max-width: var(--size-small, 300px);
    }
    
    .image-widget.size-medium img,
    .image-widget.size-medium video {
        max-width: var(--size-medium, 600px);
    }
    
    .image-widget.size-large img,
    .image-widget.size-large video {
        max-width: var(--size-large, 900px);
    }
    
    .image-widget.size-full img,
    .image-widget.size-full video {
        max-width: 100%;
        width: 100%;
    }
    """

    css_variables = {
        "image-alignment": "center",
        "image-radius": "0",
        "image-shadow": "none",
        "image-border": "none",
        "video-radius": "0.5rem",
        "video-shadow": "0 4px 6px rgba(0, 0, 0, 0.1)",
        "caption-margin-top": "0.5rem",
        "caption-font-size": "0.875rem",
        "caption-color": "#6b7280",
        "caption-style": "italic",
        "caption-alignment": "center",
        "gallery-columns": "3",
        "gallery-gap": "1rem",
        "gallery-margin": "1rem 0",
        "gallery-item-height": "200px",
        "size-small": "300px",
        "size-medium": "600px",
        "size-large": "900px",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ImageConfig


@register_widget_type
class TableWidget(BaseWidget):
    """Table widget with configurable columns and rows"""

    name = "Table"
    description = "Table widget with configurable columns and rows, cell styling, and spanning capabilities"
    template_name = "webpages/widgets/table.html"

    widget_css = """
    .table-widget {
        overflow-x: auto;
        margin: var(--table-margin, 1rem 0);
    }
    
    .table-widget table {
        width: 100%;
        border-collapse: collapse;
        font-family: var(--table-font, inherit);
        background-color: var(--table-bg, transparent);
    }
    
    .table-widget th {
        background-color: var(--header-bg, #f3f4f6);
        color: var(--header-color, #1f2937);
        font-weight: var(--header-font-weight, 600);
        text-align: var(--header-alignment, left);
        padding: var(--header-padding, 0.75rem);
        border: var(--header-border, 1px solid #d1d5db);
    }
    
    .table-widget td {
        padding: var(--cell-padding, 0.75rem);
        border: var(--cell-border, 1px solid #d1d5db);
        text-align: var(--cell-alignment, left);
        vertical-align: var(--cell-vertical-alignment, top);
        background-color: var(--cell-bg, transparent);
        color: var(--cell-color, inherit);
    }
    
    .table-widget tr:nth-child(even) td {
        background-color: var(--row-even-bg, #f9fafb);
    }
    
    .table-widget tr:hover td {
        background-color: var(--row-hover-bg, #f3f4f6);
    }
    
    .table-widget .cell-center {
        text-align: center;
    }
    
    .table-widget .cell-right {
        text-align: right;
    }
    
    .table-widget .cell-bold {
        font-weight: bold;
    }
    
    .table-widget .cell-italic {
        font-style: italic;
    }
    
    .table-widget .cell-highlight {
        background-color: var(--cell-highlight-bg, #fef3c7) !important;
    }
    
    .table-widget .cell-success {
        background-color: var(--cell-success-bg, #dcfce7) !important;
        color: var(--cell-success-color, #166534);
    }
    
    .table-widget .cell-warning {
        background-color: var(--cell-warning-bg, #fef3c7) !important;
        color: var(--cell-warning-color, #92400e);
    }
    
    .table-widget .cell-error {
        background-color: var(--cell-error-bg, #fee2e2) !important;
        color: var(--cell-error-color, #991b1b);
    }
    
    @media (max-width: 768px) {
        .table-widget {
            font-size: var(--mobile-font-size, 0.875rem);
        }
        
        .table-widget th,
        .table-widget td {
            padding: var(--mobile-cell-padding, 0.5rem);
        }
    }
    """

    css_variables = {
        "table-margin": "1rem 0",
        "table-font": "inherit",
        "table-bg": "transparent",
        "header-bg": "#f3f4f6",
        "header-color": "#1f2937",
        "header-font-weight": "600",
        "header-alignment": "left",
        "header-padding": "0.75rem",
        "header-border": "1px solid #d1d5db",
        "cell-padding": "0.75rem",
        "cell-border": "1px solid #d1d5db",
        "cell-alignment": "left",
        "cell-vertical-alignment": "top",
        "cell-bg": "transparent",
        "cell-color": "inherit",
        "row-even-bg": "#f9fafb",
        "row-hover-bg": "#f3f4f6",
        "cell-highlight-bg": "#fef3c7",
        "cell-success-bg": "#dcfce7",
        "cell-success-color": "#166534",
        "cell-warning-bg": "#fef3c7",
        "cell-warning-color": "#92400e",
        "cell-error-bg": "#fee2e2",
        "cell-error-color": "#991b1b",
        "mobile-font-size": "0.875rem",
        "mobile-cell-padding": "0.5rem",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return TableConfig


@register_widget_type
class FooterWidget(BaseWidget):
    """Footer widget with background and text styling options"""

    name = "Footer"
    description = "Footer widget with background image/color and text color options"
    template_name = "webpages/widgets/footer.html"

    widget_css = """
    .footer-widget {
        background-color: var(--footer-bg-color, #1f2937);
        background-image: var(--footer-bg-image, none);
        background-size: var(--footer-bg-size, cover);
        background-position: var(--footer-bg-position, center);
        background-repeat: var(--footer-bg-repeat, no-repeat);
        color: var(--footer-text-color, #f9fafb);
        padding: var(--footer-padding, 2rem 1rem);
        margin-top: auto;
    }
    
    .footer-widget .footer-content {
        max-width: var(--footer-max-width, 1200px);
        margin: 0 auto;
        text-align: var(--footer-text-align, center);
    }
    
    .footer-widget h1, .footer-widget h2, .footer-widget h3,
    .footer-widget h4, .footer-widget h5, .footer-widget h6 {
        color: var(--footer-heading-color, inherit);
        margin-bottom: var(--footer-heading-margin, 1rem);
    }
    
    .footer-widget p {
        margin-bottom: var(--footer-paragraph-margin, 0.5rem);
        line-height: var(--footer-line-height, 1.6);
    }
    
    .footer-widget a {
        color: var(--footer-link-color, #60a5fa);
        text-decoration: none;
        transition: color 0.2s ease-in-out;
    }
    
    .footer-widget a:hover {
        color: var(--footer-link-hover-color, #93c5fd);
        text-decoration: underline;
    }
    
    .footer-widget ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    
    .footer-widget ul li {
        margin-bottom: var(--footer-list-item-margin, 0.5rem);
    }
    """

    css_variables = {
        "footer-bg-color": "#1f2937",
        "footer-bg-image": "none",
        "footer-bg-size": "cover",
        "footer-bg-position": "center",
        "footer-bg-repeat": "no-repeat",
        "footer-text-color": "#f9fafb",
        "footer-padding": "2rem 1rem",
        "footer-max-width": "1200px",
        "footer-text-align": "center",
        "footer-heading-color": "inherit",
        "footer-heading-margin": "1rem",
        "footer-paragraph-margin": "0.5rem",
        "footer-line-height": "1.6",
        "footer-link-color": "#60a5fa",
        "footer-link-hover-color": "#93c5fd",
        "footer-list-item-margin": "0.5rem",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return FooterConfig


@register_widget_type
class HeaderWidget(BaseWidget):
    """Header widget with background and text styling options"""

    name = "Header"
    description = "Header widget with background image/color and text color options"
    template_name = "webpages/widgets/header.html"

    widget_css = """
    .header-widget {
        background-color: var(--header-bg-color, #ffffff);
        background-image: var(--header-bg-image, none);
        background-size: var(--header-bg-size, cover);
        background-position: var(--header-bg-position, center);
        background-repeat: var(--header-bg-repeat, no-repeat);
        color: var(--header-text-color, #1f2937);
        padding: var(--header-padding, 2rem 1rem);
        position: relative;
        overflow: hidden;
    }
    
    .header-widget .header-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--header-overlay-color, transparent);
        opacity: var(--header-overlay-opacity, 0.5);
    }
    
    .header-widget .header-content {
        position: relative;
        z-index: 1;
        max-width: var(--header-max-width, 1200px);
        margin: 0 auto;
        text-align: var(--header-text-align, center);
    }
    
    .header-widget h1 {
        font-size: var(--header-h1-size, 3rem);
        font-weight: var(--header-h1-weight, 700);
        margin-bottom: var(--header-h1-margin, 1rem);
        color: var(--header-h1-color, inherit);
        line-height: var(--header-h1-line-height, 1.2);
    }
    
    .header-widget h2 {
        font-size: var(--header-h2-size, 2rem);
        font-weight: var(--header-h2-weight, 600);
        margin-bottom: var(--header-h2-margin, 0.75rem);
        color: var(--header-h2-color, inherit);
    }
    
    .header-widget p {
        font-size: var(--header-p-size, 1.125rem);
        margin-bottom: var(--header-p-margin, 0.5rem);
        line-height: var(--header-line-height, 1.6);
    }
    
    .header-widget .subtitle {
        font-size: var(--header-subtitle-size, 1.25rem);
        color: var(--header-subtitle-color, inherit);
        opacity: var(--header-subtitle-opacity, 0.8);
    }
    
    @media (max-width: 768px) {
        .header-widget h1 {
            font-size: var(--header-h1-mobile-size, 2rem);
        }
        
        .header-widget {
            padding: var(--header-mobile-padding, 1.5rem 1rem);
        }
    }
    """

    css_variables = {
        "header-bg-color": "#ffffff",
        "header-bg-image": "none",
        "header-bg-size": "cover",
        "header-bg-position": "center",
        "header-bg-repeat": "no-repeat",
        "header-text-color": "#1f2937",
        "header-padding": "2rem 1rem",
        "header-overlay-color": "transparent",
        "header-overlay-opacity": "0.5",
        "header-max-width": "1200px",
        "header-text-align": "center",
        "header-h1-size": "3rem",
        "header-h1-weight": "700",
        "header-h1-margin": "1rem",
        "header-h1-color": "inherit",
        "header-h1-line-height": "1.2",
        "header-h2-size": "2rem",
        "header-h2-weight": "600",
        "header-h2-margin": "0.75rem",
        "header-h2-color": "inherit",
        "header-p-size": "1.125rem",
        "header-p-margin": "0.5rem",
        "header-line-height": "1.6",
        "header-subtitle-size": "1.25rem",
        "header-subtitle-color": "inherit",
        "header-subtitle-opacity": "0.8",
        "header-h1-mobile-size": "2rem",
        "header-mobile-padding": "1.5rem 1rem",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HeaderConfig


@register_widget_type
class NavigationWidget(BaseWidget):
    """Navigation widget with background and text styling options"""

    name = "Navigation"
    description = "Navigation widget with background image/color and text color options"
    template_name = "webpages/widgets/navigation.html"

    widget_css = """
    .navigation-widget {
        background-color: var(--nav-bg-color, #ffffff);
        background-image: var(--nav-bg-image, none);
        background-size: var(--nav-bg-size, cover);
        background-position: var(--nav-bg-position, center);
        background-repeat: var(--nav-bg-repeat, no-repeat);
        color: var(--nav-text-color, #1f2937);
        padding: var(--nav-padding, 1rem);
        border-bottom: var(--nav-border, 1px solid #e5e7eb);
    }
    
    .navigation-widget .nav-container {
        max-width: var(--nav-max-width, 1200px);
        margin: 0 auto;
        display: flex;
        justify-content: var(--nav-justify, space-between);
        align-items: center;
        flex-wrap: wrap;
    }
    
    .navigation-widget .nav-brand {
        font-size: var(--nav-brand-size, 1.5rem);
        font-weight: var(--nav-brand-weight, 700);
        color: var(--nav-brand-color, inherit);
        text-decoration: none;
    }
    
    .navigation-widget .nav-menu {
        display: flex;
        list-style: none;
        margin: 0;
        padding: 0;
        gap: var(--nav-menu-gap, 2rem);
    }
    
    .navigation-widget .nav-menu a {
        color: var(--nav-link-color, inherit);
        text-decoration: none;
        font-weight: var(--nav-link-weight, 500);
        padding: var(--nav-link-padding, 0.5rem 1rem);
        border-radius: var(--nav-link-radius, 0.375rem);
        transition: all 0.2s ease-in-out;
    }
    
    .navigation-widget .nav-menu a:hover {
        background-color: var(--nav-link-hover-bg, #f3f4f6);
        color: var(--nav-link-hover-color, #1f2937);
    }
    
    .navigation-widget .nav-menu a.active {
        background-color: var(--nav-link-active-bg, #3b82f6);
        color: var(--nav-link-active-color, #ffffff);
    }
    
    .navigation-widget .nav-toggle {
        display: none;
        background: none;
        border: none;
        color: var(--nav-toggle-color, inherit);
        font-size: var(--nav-toggle-size, 1.5rem);
        cursor: pointer;
    }
    
    @media (max-width: 768px) {
        .navigation-widget .nav-menu {
            display: none;
            width: 100%;
            flex-direction: column;
            gap: var(--nav-mobile-gap, 0.5rem);
            margin-top: var(--nav-mobile-margin, 1rem);
        }
        
        .navigation-widget .nav-menu.active {
            display: flex;
        }
        
        .navigation-widget .nav-toggle {
            display: block;
        }
    }
    """

    css_variables = {
        "nav-bg-color": "#ffffff",
        "nav-bg-image": "none",
        "nav-bg-size": "cover",
        "nav-bg-position": "center",
        "nav-bg-repeat": "no-repeat",
        "nav-text-color": "#1f2937",
        "nav-padding": "1rem",
        "nav-border": "1px solid #e5e7eb",
        "nav-max-width": "1200px",
        "nav-justify": "space-between",
        "nav-brand-size": "1.5rem",
        "nav-brand-weight": "700",
        "nav-brand-color": "inherit",
        "nav-menu-gap": "2rem",
        "nav-link-color": "inherit",
        "nav-link-weight": "500",
        "nav-link-padding": "0.5rem 1rem",
        "nav-link-radius": "0.375rem",
        "nav-link-hover-bg": "#f3f4f6",
        "nav-link-hover-color": "#1f2937",
        "nav-link-active-bg": "#3b82f6",
        "nav-link-active-color": "#ffffff",
        "nav-toggle-color": "inherit",
        "nav-toggle-size": "1.5rem",
        "nav-mobile-gap": "0.5rem",
        "nav-mobile-margin": "1rem",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return NavigationConfig


@register_widget_type
class SidebarWidget(BaseWidget):
    """Sidebar widget with background and text styling options"""

    name = "Sidebar"
    description = "Sidebar widget with background image/color and text color options"
    template_name = "webpages/widgets/sidebar.html"

    widget_css = """
    .sidebar-widget {
        background-color: var(--sidebar-bg-color, #f9fafb);
        background-image: var(--sidebar-bg-image, none);
        background-size: var(--sidebar-bg-size, cover);
        background-position: var(--sidebar-bg-position, center);
        background-repeat: var(--sidebar-bg-repeat, no-repeat);
        color: var(--sidebar-text-color, #1f2937);
        padding: var(--sidebar-padding, 1.5rem);
        border: var(--sidebar-border, 1px solid #e5e7eb);
        border-radius: var(--sidebar-radius, 0.5rem);
        height: fit-content;
    }
    
    .sidebar-widget .sidebar-section {
        margin-bottom: var(--sidebar-section-margin, 2rem);
    }
    
    .sidebar-widget .sidebar-section:last-child {
        margin-bottom: 0;
    }
    
    .sidebar-widget h1, .sidebar-widget h2, .sidebar-widget h3,
    .sidebar-widget h4, .sidebar-widget h5, .sidebar-widget h6 {
        color: var(--sidebar-heading-color, #1f2937);
        margin-bottom: var(--sidebar-heading-margin, 1rem);
        font-weight: var(--sidebar-heading-weight, 600);
        border-bottom: var(--sidebar-heading-border, 2px solid #e5e7eb);
        padding-bottom: var(--sidebar-heading-padding, 0.5rem);
    }
    
    .sidebar-widget p {
        margin-bottom: var(--sidebar-paragraph-margin, 1rem);
        line-height: var(--sidebar-line-height, 1.6);
        font-size: var(--sidebar-font-size, 0.875rem);
    }
    
    .sidebar-widget ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    
    .sidebar-widget ul li {
        margin-bottom: var(--sidebar-list-item-margin, 0.75rem);
        padding-left: var(--sidebar-list-item-padding, 1rem);
        position: relative;
    }
    
    .sidebar-widget ul li:before {
        content: var(--sidebar-list-bullet, "•");
        color: var(--sidebar-list-bullet-color, #6b7280);
        position: absolute;
        left: 0;
    }
    
    .sidebar-widget a {
        color: var(--sidebar-link-color, #3b82f6);
        text-decoration: none;
        transition: color 0.2s ease-in-out;
    }
    
    .sidebar-widget a:hover {
        color: var(--sidebar-link-hover-color, #2563eb);
        text-decoration: underline;
    }
    
    .sidebar-widget .sidebar-widget-list {
        background-color: var(--sidebar-widget-list-bg, #ffffff);
        border: var(--sidebar-widget-list-border, 1px solid #e5e7eb);
        border-radius: var(--sidebar-widget-list-radius, 0.375rem);
        padding: var(--sidebar-widget-list-padding, 1rem);
    }
    
    .sidebar-widget .sidebar-widget-list ul li {
        padding: var(--sidebar-widget-list-item-padding, 0.5rem 0);
        border-bottom: var(--sidebar-widget-list-item-border, 1px solid #f3f4f6);
    }
    
    .sidebar-widget .sidebar-widget-list ul li:last-child {
        border-bottom: none;
    }
    """

    css_variables = {
        "sidebar-bg-color": "#f9fafb",
        "sidebar-bg-image": "none",
        "sidebar-bg-size": "cover",
        "sidebar-bg-position": "center",
        "sidebar-bg-repeat": "no-repeat",
        "sidebar-text-color": "#1f2937",
        "sidebar-padding": "1.5rem",
        "sidebar-border": "1px solid #e5e7eb",
        "sidebar-radius": "0.5rem",
        "sidebar-section-margin": "2rem",
        "sidebar-heading-color": "#1f2937",
        "sidebar-heading-margin": "1rem",
        "sidebar-heading-weight": "600",
        "sidebar-heading-border": "2px solid #e5e7eb",
        "sidebar-heading-padding": "0.5rem",
        "sidebar-paragraph-margin": "1rem",
        "sidebar-line-height": "1.6",
        "sidebar-font-size": "0.875rem",
        "sidebar-list-item-margin": "0.75rem",
        "sidebar-list-item-padding": "1rem",
        "sidebar-list-bullet": '"•"',
        "sidebar-list-bullet-color": "#6b7280",
        "sidebar-link-color": "#3b82f6",
        "sidebar-link-hover-color": "#2563eb",
        "sidebar-widget-list-bg": "#ffffff",
        "sidebar-widget-list-border": "1px solid #e5e7eb",
        "sidebar-widget-list-radius": "0.375rem",
        "sidebar-widget-list-padding": "1rem",
        "sidebar-widget-list-item-padding": "0.5rem 0",
        "sidebar-widget-list-item-border": "1px solid #f3f4f6",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return SidebarConfig


@register_widget_type
class FormsWidget(BaseWidget):
    """Forms widget with schema support"""

    name = "Forms"
    description = "Forms widget with schema support for building custom forms"
    template_name = "webpages/widgets/forms.html"

    widget_css = """
    .forms-widget {
        background-color: var(--form-bg-color, #ffffff);
        padding: var(--form-padding, 2rem);
        border-radius: var(--form-radius, 0.5rem);
        border: var(--form-border, 1px solid #e5e7eb);
        max-width: var(--form-max-width, 600px);
        margin: var(--form-margin, 0 auto);
    }
    
    .forms-widget .form-title {
        font-size: var(--form-title-size, 1.5rem);
        font-weight: var(--form-title-weight, 600);
        color: var(--form-title-color, #1f2937);
        margin-bottom: var(--form-title-margin, 1rem);
        text-align: var(--form-title-align, center);
    }
    
    .forms-widget .form-description {
        color: var(--form-description-color, #6b7280);
        margin-bottom: var(--form-description-margin, 2rem);
        text-align: var(--form-description-align, center);
        line-height: var(--form-description-line-height, 1.6);
    }
    
    .forms-widget .form-group {
        margin-bottom: var(--form-group-margin, 1.5rem);
    }
    
    .forms-widget label {
        display: block;
        font-weight: var(--form-label-weight, 500);
        color: var(--form-label-color, #374151);
        margin-bottom: var(--form-label-margin, 0.5rem);
        font-size: var(--form-label-size, 0.875rem);
    }
    
    .forms-widget .required {
        color: var(--form-required-color, #dc2626);
    }
    
    .forms-widget input[type="text"],
    .forms-widget input[type="email"],
    .forms-widget input[type="tel"],
    .forms-widget input[type="number"],
    .forms-widget textarea,
    .forms-widget select {
        width: 100%;
        padding: var(--form-input-padding, 0.75rem);
        border: var(--form-input-border, 1px solid #d1d5db);
        border-radius: var(--form-input-radius, 0.375rem);
        font-size: var(--form-input-font-size, 1rem);
        background-color: var(--form-input-bg, #ffffff);
        color: var(--form-input-color, #1f2937);
        transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
    }
    
    .forms-widget input:focus,
    .forms-widget textarea:focus,
    .forms-widget select:focus {
        outline: none;
        border-color: var(--form-input-focus-border, #3b82f6);
        box-shadow: var(--form-input-focus-shadow, 0 0 0 3px rgba(59, 130, 246, 0.1));
    }
    
    .forms-widget textarea {
        min-height: var(--form-textarea-height, 120px);
        resize: vertical;
    }
    
    .forms-widget .checkbox-group,
    .forms-widget .radio-group {
        display: flex;
        flex-direction: column;
        gap: var(--form-option-gap, 0.5rem);
    }
    
    .forms-widget .checkbox-item,
    .forms-widget .radio-item {
        display: flex;
        align-items: center;
        gap: var(--form-option-item-gap, 0.5rem);
    }
    
    .forms-widget input[type="checkbox"],
    .forms-widget input[type="radio"] {
        width: auto;
        margin: 0;
    }
    
    .forms-widget .submit-button {
        background-color: var(--form-submit-bg, #3b82f6);
        color: var(--form-submit-color, #ffffff);
        padding: var(--form-submit-padding, 0.75rem 2rem);
        border: none;
        border-radius: var(--form-submit-radius, 0.375rem);
        font-size: var(--form-submit-font-size, 1rem);
        font-weight: var(--form-submit-font-weight, 500);
        cursor: pointer;
        transition: background-color 0.2s ease-in-out;
        width: var(--form-submit-width, auto);
        margin: var(--form-submit-margin, 1rem auto 0);
        display: block;
    }
    
    .forms-widget .submit-button:hover {
        background-color: var(--form-submit-hover-bg, #2563eb);
    }
    
    .forms-widget .submit-button:disabled {
        background-color: var(--form-submit-disabled-bg, #9ca3af);
        cursor: not-allowed;
    }
    
    .forms-widget .form-error {
        color: var(--form-error-color, #dc2626);
        font-size: var(--form-error-size, 0.875rem);
        margin-top: var(--form-error-margin, 0.25rem);
    }
    
    .forms-widget .form-success {
        background-color: var(--form-success-bg, #dcfce7);
        color: var(--form-success-color, #166534);
        padding: var(--form-success-padding, 1rem);
        border-radius: var(--form-success-radius, 0.375rem);
        border: var(--form-success-border, 1px solid #bbf7d0);
        text-align: center;
    }
    """

    css_variables = {
        "form-bg-color": "#ffffff",
        "form-padding": "2rem",
        "form-radius": "0.5rem",
        "form-border": "1px solid #e5e7eb",
        "form-max-width": "600px",
        "form-margin": "0 auto",
        "form-title-size": "1.5rem",
        "form-title-weight": "600",
        "form-title-color": "#1f2937",
        "form-title-margin": "1rem",
        "form-title-align": "center",
        "form-description-color": "#6b7280",
        "form-description-margin": "2rem",
        "form-description-align": "center",
        "form-description-line-height": "1.6",
        "form-group-margin": "1.5rem",
        "form-label-weight": "500",
        "form-label-color": "#374151",
        "form-label-margin": "0.5rem",
        "form-label-size": "0.875rem",
        "form-required-color": "#dc2626",
        "form-input-padding": "0.75rem",
        "form-input-border": "1px solid #d1d5db",
        "form-input-radius": "0.375rem",
        "form-input-font-size": "1rem",
        "form-input-bg": "#ffffff",
        "form-input-color": "#1f2937",
        "form-input-focus-border": "#3b82f6",
        "form-input-focus-shadow": "0 0 0 3px rgba(59, 130, 246, 0.1)",
        "form-textarea-height": "120px",
        "form-option-gap": "0.5rem",
        "form-option-item-gap": "0.5rem",
        "form-submit-bg": "#3b82f6",
        "form-submit-color": "#ffffff",
        "form-submit-padding": "0.75rem 2rem",
        "form-submit-radius": "0.375rem",
        "form-submit-font-size": "1rem",
        "form-submit-font-weight": "500",
        "form-submit-width": "auto",
        "form-submit-margin": "1rem auto 0",
        "form-submit-hover-bg": "#2563eb",
        "form-submit-disabled-bg": "#9ca3af",
        "form-error-color": "#dc2626",
        "form-error-size": "0.875rem",
        "form-error-margin": "0.25rem",
        "form-success-bg": "#dcfce7",
        "form-success-color": "#166534",
        "form-success-padding": "1rem",
        "form-success-radius": "0.375rem",
        "form-success-border": "1px solid #bbf7d0",
    }

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return FormsConfig
