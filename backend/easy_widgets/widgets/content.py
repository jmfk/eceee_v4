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

DEFAULT_IMGPROXY_CONFIG = {
    "resize_type": "fit",
    "quality": 85,
    "format": "webp",
}


class ContentConfig(BaseModel):
    """Configuration for Content widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
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
    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
        },
    )
    show_border: bool = Field(
        False,
        description="Show widget border",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "group": "Styling",
        },
    )
    use_content_margins: bool = Field(
        True,
        description="Use content margins (extra left/right padding on larger screens)",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "group": "Styling",
        },
    )
    enable_lightbox: bool = Field(
        False,
        description="Enable lightbox on images inside content",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "group": "Display Options",
        },
    )
    lightbox_style: str = Field(
        "default",
        description="Lightbox style key",
        json_schema_extra={
            "component": "LightboxStyleSelect",
            "group": "Display Options",
            "placeholder": "Default",
        },
    )
    lightbox_group: str = Field(
        "",
        description="Group key for images in lightbox",
        json_schema_extra={
            "component": "TextInput",
            "group": "Display Options",
            "placeholder": "optional group",
        },
    )
    anchor: str = Field(
        "",
        description="Anchor ID for linking to this section",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "section-name",
            "order": 9999,
            "group": "Advanced",
        },
    )
    anchor_title: str = Field(
        "",
        description="Anchor title (for navigation menus)",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "Auto-generated from header",
            "helpText": "Displayed in navigation menus when linking to this content",
            "order": 10000,
            "group": "Advanced",
        },
    )


@register_widget_type
class ContentWidget(BaseWidget):
    """Content widget that contains HTML"""

    name = "Content"
    description = "Content widget that contains HTML"
    template_name = "easy_widgets/widgets/content.html"

    variants = [
        {
            "id": "border-enabled",
            "label": "Border Enabled",
            "config_field": "show_border",
            "type": "class",
        },
    ]

    layout_parts = {
        "content-widget": {
            "label": "Content widget container",
            "selector": ".content-widget",
            "relationship": "descendant",
            "properties": [
                "width",
                "height",
                "padding",
                "margin",
                "backgroundColor",
                "color",
                "fontFamily",
                "fontSize",
                "lineHeight",
            ],
        },
    }

    widget_css = """
    .content-widget {
        box-sizing: border-box;
        width: 100%;
        min-height: 32px;
        font-family: inherit;
        line-height: 1.6;
        color: inherit;
        margin-bottom: 30px;        
    }
    .content-widget.border-enabled {
        padding-top: 50px;
        padding-bottom: 50px;
        outline: 1px solid rgb(0,0,0,0.3);
    }
    """

    not_used = """
    .content-widget h1,
    .content-widget h2,
    .content-widget h3,
    .content-widget h4,
    .content-widget h5,
    .content-widget h6 {
        margin-top: 0;
        margin-bottom: 0.5rem;
        font-weight: 600;
    }
    
    .content-widget p {
        margin: 1rem 0;
    }
    
    .content-widget ul,
    .content-widget ol {
        margin: 1rem 0;
        padding-left: 1.5rem;
    }
    
    .content-widget blockquote {
        border-left: 4px solid #e5e7eb;
        padding: 1rem;
        margin: 1.5rem 0;
        color: #6b7280;
    }
    
    .content-widget code {
        background-color: #f3f4f6;
        padding: 0.125rem 0.25rem;
        border-radius: 0.25rem;
        font-family: monospace;
        font-size: 0.875rem;
    }
    
    .content-widget pre {
        background-color: #1f2937;
        color: #f9fafb;
        padding: 1rem;
        border-radius: 0.5rem;
        margin: 1.5rem 0;
        overflow-x: auto;
    }
    
    .content-widget pre code {
        background-color: transparent;
        padding: 0;
        border-radius: 0;
        color: inherit;
    }
    """

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return ContentConfig

    def render_with_style(self, config, theme):
        """
        Render content with custom component style from theme.

        Args:
            config: Widget configuration
            theme: PageTheme instance

        Returns:
            Tuple of (html, css) or None for default rendering
        """
        from webpages.utils.mustache_renderer import (
            render_mustache,
            prepare_component_context,
        )

        style_name = config.get("component_style", "default")

        # For default style, return None to use standard Django template rendering
        if not style_name or style_name == "default":
            return None

        styles = theme.component_styles or {}
        style = styles.get(style_name)

        # If style not found in theme, fall back to default rendering
        if not style:
            return None

        template_str = style.get("template", "")
        css = style.get("css", "")

        # Check for passthru marker (must be only content in template after trimming)
        if template_str.strip() == "{{passthru}}":
            # Passthru mode: use default rendering but inject CSS
            return None, css

        # Prepare context with content and anchor
        context = prepare_component_context(
            content=config.get("content", ""),
            anchor=config.get("anchor", ""),
            style_vars=style.get("variables", {}),
            config=config,  # Pass raw config for granular control
        )

        # Render template
        html = render_mustache(template_str, context)
        return html, css

    def prepare_template_context(self, config, context=None):
        """
        Prepare template context with processed media inserts.

        This method finds all media inserts with gallery styles in the HTML content
        and replaces them with rendered gallery HTML using theme styles.
        """
        template_config = super().prepare_template_context(config, context)
        context = context if context else {}

        # Ensure snake_case config fields are available for template
        template_config["allow_scripts"] = config.get("allow_scripts", False)
        template_config["sanitize_html"] = config.get("sanitize_html", True)
        template_config["show_border"] = config.get("show_border", False)
        template_config["use_content_margins"] = config.get("use_content_margins", True)

        # Get content HTML
        content_html = config.get("content", "")
        if not content_html:
            return template_config

        # Parse HTML
        soup = BeautifulSoup(content_html, "html.parser")

        # Get theme from context (provided by the rendering system)
        theme = context.get("theme")

        # Process all media inserts (with or without theme)
        media_inserts = soup.find_all("div", {"data-media-insert": "true"})

        for media_insert in media_inserts:
            image_style = media_insert.get("data-image-style") or media_insert.get("data-gallery-style")
            lightbox_image_style = media_insert.get("data-lightbox-image-style")

            media_type = media_insert.get("data-media-type", "image")
            media_id = media_insert.get("data-media-id")
            caption = media_insert.get("data-caption", "")
            title = media_insert.get("data-title", "")
            width = media_insert.get("data-width", "full")
            align = media_insert.get("data-align", "center")

            if not media_id:
                continue

            styled_html = self._render_media_insert_with_style(
                media_id,
                media_type,
                image_style,
                theme,
                caption,
                title,
                lightbox_image_style=lightbox_image_style,
                width=width,
                align=align,
            )

        if styled_html:
            new_tag = BeautifulSoup(styled_html, "html.parser")
            media_insert.replace_with(new_tag)

        # Resolve link objects in HTML content
        from webpages.services.link_resolver import resolve_links_in_html

        content_str = str(soup)
        resolved_content = resolve_links_in_html(content_str, context.get("request"))
        if resolved_content != content_str:
            soup = BeautifulSoup(resolved_content, "html.parser")

        # Auto-apply lightbox attributes to images if enabled
        enable_lb = config.get("enable_lightbox", False)
        if enable_lb:
            style_key = config.get("lightbox_style", "default")
            group_key = config.get("lightbox_group", "")
            # Add data-lightbox to anchors wrapping images
            for a in soup.find_all("a"):
                img = a.find("img")
                href = a.get("href", "")
                if (
                    img
                    and href
                    and any(href.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"])
                ):
                    a["data-lightbox"] = ""
                    if group_key:
                        a["data-lightbox-group"] = group_key
                    a["data-lightbox-style"] = style_key or "default"
                    a["data-lightbox-src"] = href
                    if img.get("alt"):
                        a["data-lightbox-alt"] = img.get("alt")
                    if img.get("title"):
                        a["data-lightbox-caption"] = img.get("title")

        # Always store processed content (even if no theme or no processing was done)
        template_config["processed_content"] = str(soup)

        return template_config

    def _render_media_insert_with_style(
        self,
        media_id,
        media_type,
        style_name,
        theme,
        caption="",
        title="",
        lightbox_image_style=None,
        width="full",
        align="center",
    ):
        """
        Render a media insert with an image style from the theme.

        Uses DEFAULT_IMGPROXY_CONFIG when no style is specified or found.

        Args:
            media_id: ID of media file or collection
            media_type: 'image' or 'collection'
            style_name: Name of the image style from theme (None for default)
            theme: PageTheme instance
            caption: User-provided caption from data-caption attribute
            title: User-provided title from data-title attribute
            lightbox_image_style: Name of an image style whose imgproxy_config
                                  is used for lightbox full-size images
            width: Width setting ('full', 'half', 'third')
            align: Alignment setting ('left', 'center', 'right')

        Returns:
            HTML string with styled content, or None on error
        """
        from webpages.utils.mustache_renderer import (
            render_mustache,
            prepare_gallery_context,
        )
        from file_manager.models import MediaFile, MediaCollection
        from file_manager.imgproxy import imgproxy_service

        def _resolve_style(key):
            if not key or not theme:
                return None
            s = (theme.image_styles or {}).get(key)
            if not s:
                s = (theme.gallery_styles or {}).get(key)
            return s

        style = None
        if style_name:
            style = _resolve_style(style_name)
            if not style:
                logger.warning(f"Image style '{style_name}' not found in theme")

        imgproxy_config = DEFAULT_IMGPROXY_CONFIG.copy()
        if style:
            style_cfg = style.get("imgproxy_config") or style.get("imgproxyConfig") or {}
            imgproxy_config.update(style_cfg)

        # Resolve lightbox config: prefer explicit lightbox image style, then
        # fall back to the style's own lightbox_config
        lightbox_config = {}
        if lightbox_image_style:
            lb_style = _resolve_style(lightbox_image_style)
            if lb_style:
                lightbox_config = lb_style.get("imgproxy_config") or lb_style.get("imgproxyConfig") or {}
        if not lightbox_config and style:
            lightbox_config = style.get("lightbox_config") or style.get("lightboxConfig") or {}

        # Fetch media data
        items = []
        try:
            if media_type == "collection":
                collection = MediaCollection.objects.prefetch_related("files").get(id=media_id)
                files = collection.files.all()
                for file in files:
                    items.append(
                        {
                            "id": str(file.id),
                            "url": (file.get_file_url() if hasattr(file, "get_file_url") else file.file_url),
                            "alt_text": title or file.title or "",
                            "caption": caption or file.description or "",
                            "title": title or file.title or "",
                            "width": file.width,
                            "height": file.height,
                        }
                    )
            else:
                media_file = MediaFile.objects.get(id=media_id)
                file_url = media_file.get_file_url() if hasattr(media_file, "get_file_url") else media_file.file_url

                has_template = style and style.get("template", "").strip()
                if imgproxy_config and not has_template:
                    # Default container width (matches frontend)
                    slot_width = 896

                    # Apply multipliers based on width setting
                    multipliers = {"full": 1.0, "half": 0.5, "third": 0.33}
                    multiplier = multipliers.get(width, 1.0)
                    target_width = int(slot_width * multiplier)

                    # Respect original image size (never upscale)
                    if media_file.width and target_width > media_file.width:
                        target_width = media_file.width

                    max_width = imgproxy_config.get("max_width") or imgproxy_config.get("width") or target_width
                    max_height = imgproxy_config.get("max_height") or imgproxy_config.get("height")
                    responsive = imgproxy_service.generate_responsive_urls(
                        source_url=file_url,
                        max_width=max_width,
                        max_height=max_height,
                        original_width=media_file.width,
                        original_height=media_file.height,
                        resize_type=imgproxy_config.get("resize_type", "fit"),
                        gravity=imgproxy_config.get("gravity", "sm"),
                        quality=imgproxy_config.get("quality"),
                        format=imgproxy_config.get("format"),
                    )
                    img_url = responsive.get("1x", {}).get("url", file_url)
                    srcset = responsive.get("srcset", "")
                    alt = title or media_file.title or ""
                    cap_html = f"<figcaption>{caption}</figcaption>" if caption else ""
                    srcset_attr = f' srcset="{srcset}"' if srcset else ""

                    # Use width and alignment classes for display
                    width_class = f"img-width-{width}"
                    align_class = f"media-align-{align}"

                    img_tag = (
                        f'<img src="{img_url}"{srcset_attr}' f' alt="{alt}" class="{width_class}" loading="lazy" />'
                    )
                    # Generate lightbox URL using lightbox_config
                    lb_url = file_url
                    if lightbox_config:
                        try:
                            lb_w = lightbox_config.get(
                                "max_width",
                                lightbox_config.get("width", media_file.width),
                            )
                            lb_h = lightbox_config.get(
                                "max_height",
                                lightbox_config.get("height"),
                            )
                            lb_data = imgproxy_service.generate_responsive_urls(
                                source_url=file_url,
                                max_width=lb_w,
                                max_height=lb_h,
                                original_width=media_file.width,
                                original_height=media_file.height,
                                resize_type=lightbox_config.get("resize_type", "fit"),
                                gravity=lightbox_config.get("gravity", "sm"),
                                quality=lightbox_config.get("quality"),
                                format=lightbox_config.get("format"),
                            )
                            if lb_data and "1x" in lb_data:
                                lb_url = lb_data["1x"]["url"]
                        except Exception:
                            pass

                    if lightbox_config:
                        img_tag = (
                            f'<a data-lightbox data-lightbox-src="{lb_url}"'
                            f' data-lightbox-caption="{caption}">'
                            f"{img_tag}</a>"
                        )

                    return f'<figure class="media-insert {width_class} {align_class}">' f"{img_tag}{cap_html}</figure>"

                items.append(
                    {
                        "id": str(media_file.id),
                        "url": file_url,
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

        if not style or not style.get("template", "").strip():
            return None

        gallery_config = {
            "show_captions": style.get("defaultShowCaptions", True),
            "enable_lightbox": style.get("enableLightbox", True),
        }

        context = prepare_gallery_context(
            items,
            gallery_config,
            style.get("variables"),
            imgproxy_config,
            lightbox_config,
        )

        html = render_mustache(style.get("template", ""), context)

        css = style.get("css", "")
        if isinstance(css, dict):
            css_parts = []
            for bp, bp_css in css.items():
                if bp_css:
                    css_parts.append(bp_css)
            css = "\n".join(css_parts)
        if css:
            html = f"<style>{css}</style>\n{html}"
        return html
