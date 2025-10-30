"""
Content widget implementation.
"""

from typing import Type
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from bs4 import BeautifulSoup
import logging

from webpages.widget_registry import BaseWidget, register_widget_type

logger = logging.getLogger(__name__)


class ContentConfig(BaseModel):
    """Configuration for Content widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    anchor: str = Field(
        "",
        description="Anchor Title",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "section-name",
        },
    )

    content: str = Field(
        ...,
        description="HTML content to display",
        # Control specifications
        json_schema_extra={
            "component": "HtmlSource",
            "rows": 6,
        },
    )
    allow_scripts: bool = Field(
        False,
        description="WARNING: Only enable for trusted content",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "warning": True,
        },
    )
    sanitize_html: bool = Field(
        True,
        description="Sanitize HTML to prevent XSS attacks",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
        },
    )


@register_widget_type
class ContentWidget(BaseWidget):
    """Content widget that contains HTML"""

    name = "Content"
    description = "Content widget that contains HTML"
    template_name = "easy_widgets/widgets/content.html"

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
        "heading-margin-top": "0",
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

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with processed media inserts.

        This method finds all media inserts with gallery styles in the HTML content
        and replaces them with rendered gallery HTML using theme styles.
        """
        template_config = super().prepare_template_context(config, context)
        context = context if context else {}

        # Ensure snake_case config fields are available for template
        template_config["allow_scripts"] = config.get("allow_scripts") or config.get(
            "allowScripts", False
        )
        template_config["sanitize_html"] = config.get("sanitize_html") or config.get(
            "sanitizeHtml", True
        )

        # Get content HTML
        content_html = config.get("content", "")
        if not content_html:
            return template_config

        # Parse HTML
        soup = BeautifulSoup(content_html, "html.parser")

        # Get theme from context (provided by the rendering system)
        theme = context.get("theme")
        # Only process media inserts if theme is available
        if theme:
            # Find all media inserts with gallery style
            media_inserts = soup.find_all("div", {"data-media-insert": "true"})

            for media_insert in media_inserts:
                gallery_style = media_insert.get("data-gallery-style")

                # Only process if gallery style is set and not default
                if not gallery_style or gallery_style == "default":
                    continue

                media_type = media_insert.get("data-media-type", "image")
                media_id = media_insert.get("data-media-id")
                caption = media_insert.get("data-caption", "")
                title = media_insert.get("data-title", "")

                if not media_id:
                    continue

                # Render with style
                styled_html = self._render_media_insert_with_style(
                    media_id, media_type, gallery_style, theme, caption, title
                )

                if styled_html:
                    # Replace the media insert with styled HTML
                    new_tag = BeautifulSoup(styled_html, "html.parser")
                    media_insert.replace_with(new_tag)

        # Always store processed content (even if no theme or no processing was done)
        template_config["processed_content"] = str(soup)

        return template_config

    def _render_media_insert_with_style(
        self, media_id, media_type, style_name, theme, caption="", title=""
    ):
        """
        Render a media insert with a gallery style.

        Args:
            media_id: ID of media file or collection
            media_type: 'image' or 'collection'
            style_name: Name of the gallery style from theme
            theme: PageTheme instance
            caption: User-provided caption from data-caption attribute
            title: User-provided title from data-title attribute

        Returns:
            HTML string with styled gallery, or None if style not found
        """
        from webpages.utils.mustache_renderer import (
            render_mustache,
            prepare_gallery_context,
        )
        from file_manager.models import MediaFile, MediaCollection

        # Get gallery style from theme
        gallery_styles = theme.gallery_styles or {}
        style = gallery_styles.get(style_name)

        if not style:
            logger.warning(f"Gallery style '{style_name}' not found in theme")
            return None

        # Fetch media data
        items = []
        try:
            if media_type == "collection":
                # Fetch collection and its files
                collection = MediaCollection.objects.prefetch_related("files").get(
                    id=media_id
                )
                files = collection.files.all()

                # Convert to items list
                for file in files:
                    items.append(
                        {
                            "id": str(file.id),
                            "url": (
                                file.get_imgproxy_url()
                                if hasattr(file, "get_imgproxy_url")
                                else file.file_url
                            ),
                            "alt_text": title or file.title or "",
                            "caption": caption or file.description or "",
                            "title": title or file.title or "",
                            "width": file.width,
                            "height": file.height,
                        }
                    )
            else:
                # Single image
                media_file = MediaFile.objects.get(id=media_id)
                items.append(
                    {
                        "id": str(media_file.id),
                        "url": (
                            media_file.get_imgproxy_url()
                            if hasattr(media_file, "get_imgproxy_url")
                            else media_file.file_url
                        ),
                        "alt_text": title or media_file.title or "",
                        "caption": caption or media_file.description or "",
                        "title": title or media_file.title or "",
                        "width": media_file.width,
                        "height": media_file.height,
                    }
                )
        except (MediaFile.DoesNotExist, MediaCollection.DoesNotExist) as e:
            logger.error(f"Media not found: {e}")
            return None

        if not items:
            return None

        # Prepare config for gallery rendering
        gallery_config = {
            "show_captions": True,
            "enable_lightbox": True,
        }

        # Get imgproxy config from style
        imgproxy_config = style.get("imgproxy_config")

        # Prepare context for Mustache rendering
        context = prepare_gallery_context(
            items, gallery_config, style.get("variables"), imgproxy_config
        )

        # Render template
        html = render_mustache(style.get("template", ""), context)

        # Wrap with style CSS if present
        css = style.get("css", "")
        if css:
            html = f"<style>{css}</style>\n{html}"

        return html
