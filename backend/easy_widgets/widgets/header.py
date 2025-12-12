"""
Header widget implementation.
"""

from typing import Type, Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from utils.dict_utils import DictToObj

from webpages.widget_registry import BaseWidget, register_widget_type


class HeaderConfig(BaseModel):
    """Configuration for Header widget"""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    # Mobile settings (grouped)
    mobile_image: Optional[dict] = Field(
        None,
        description="MediaFile object for mobile header image",
        json_schema_extra={
            "component": "ImageInput",
            "order": 1,
            "mediaTypes": ["image"],
            "group": "mobile",
            "allowCollections": False,
            "multiple": False,
        },
    )

    # Tablet settings (grouped)
    tablet_image: Optional[dict] = Field(
        None,
        description="MediaFile object for tablet header image",
        json_schema_extra={
            "component": "ImageInput",
            "order": 5,
            "mediaTypes": ["image"],
            "group": "tablet",
            "allowCollections": False,
            "multiple": False,
        },
    )

    # Desktop settings (grouped)
    image: Optional[dict] = Field(
        None,
        description="MediaFile object for desktop header image",
        json_schema_extra={
            "component": "ImageInput",
            "order": 9,
            "mediaTypes": ["image"],
            "group": "desktop",
        },
    )
    component_style: str = Field(
        "default",
        description="Component style from theme",
        json_schema_extra={
            "component": "ComponentStyleSelector",
        },
    )


@register_widget_type
class HeaderWidget(BaseWidget):
    """Simple header widget with image"""

    name = "Header"
    description = (
        "Simple header widget with responsive image that scales to fill header height"
    )
    template_name = "easy_widgets/widgets/header.html"

    layout_parts = {
        "header-widget": {
            "label": "Header container",
            "selector": ".header-widget",
            "properties": [
                "padding",
                "margin",
                "backgroundColor",
            ],
        },
    }

    widget_css = """
        .widget-type-header {
            width: 100%;
            background-image: var(--mobile-bg-image);
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center center;
            aspect-ratio: var(--mobile-header-ar, 640 / 80);
        }

        @media (min-width: 640px) {
            .widget-type-header {
                background-image: var(--tablet-bg-image);
                height: var(--tablet-header-h, 112px);
                aspect-ratio: auto;
                background-size: auto 100%;
                background-position: top left;
            }
        }

        @media (min-width: 1024px) {
            .widget-type-header {
                background-image: var(--desktop-bg-image);
                height: var(--desktop-header-h, 112px);
                aspect-ratio: auto;
                background-size: auto 100%;
                background-position: top left;
            }
        }
    """

    css_variables = {}

    css_scope = "widget"

    @property
    def configuration_model(self) -> Type[BaseModel]:
        return HeaderConfig

    def render_with_style(self, config, theme):
        """
        Render header with custom component style from theme.

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
        from django.template.loader import render_to_string

        style_name = config.get("component_style", "default")
        if not style_name or style_name == "default":
            return None

        styles = theme.component_styles or {}
        style = styles.get(style_name)
        if not style:
            return None

        # Prepare template context first
        prepared_config = self.prepare_template_context(config, {"theme": theme})

        # Render the header HTML using the default template first
        header_html = render_to_string(self.template_name, {"config": prepared_config})

        # Prepare context with rendered header as content
        context = prepare_component_context(
            content=header_html,
            anchor="",
            style_vars=style.get("variables", {}),
            config=prepared_config,  # Pass processed config for granular control
        )

        # Render with style template
        html = render_mustache(style.get("template", ""), context)
        css = style.get("css", "")
        return html, css

    def prepare_template_context(self, config, context=None):
        """Build header background styling with inferred dimensions (from image metadata)"""
        from file_manager.imgproxy import imgproxy_service

        def _extract_scale_hint(image_obj: dict) -> int:
            """
            Infer whether the upload is @2x or @3x.

            Priority:
            1) Parse common fields for '@2x' / '@3x'
            2) Use divisibility heuristics on width/height
            """
            import re

            for key in ("original_filename", "title", "slug", "file_path"):
                val = image_obj.get(key)
                if not val:
                    continue
                m = re.search(r"@([23])x\b", str(val), flags=re.IGNORECASE)
                if m:
                    try:
                        return int(m.group(1))
                    except (TypeError, ValueError):
                        pass

            w = image_obj.get("width")
            h = image_obj.get("height")
            if isinstance(w, int) and isinstance(h, int) and w > 0 and h > 0:
                if (w % 3 == 0) and (h % 3 == 0):
                    return 3
                if (w % 2 == 0) and (h % 2 == 0):
                    return 2
            return 1

        def _infer_base_dims(
            image_obj: Optional[dict],
            *,
            default_width: int,
            default_height: int,
        ) -> tuple[int, int, int, bool]:
            """
            Return (base_width_1x, base_height_1x, scale_hint, has_metadata_dims)
            """
            if not image_obj:
                return default_width, default_height, 2, False

            w = image_obj.get("width")
            h = image_obj.get("height")
            if not (isinstance(w, int) and isinstance(h, int) and w > 0 and h > 0):
                return default_width, default_height, 2, False

            scale_hint = _extract_scale_hint(image_obj)
            if scale_hint < 1:
                scale_hint = 1

            base_w = int(round(w / scale_hint))
            base_h = int(round(h / scale_hint))
            if base_w < 1:
                base_w = 1
            if base_h < 1:
                base_h = 1

            return base_w, base_h, scale_hint, True

        def _build_image_set_var(
            *,
            css_var_name: str,
            image_obj: Optional[dict],
            default_width: int,
            default_height: int,
        ) -> Optional[str]:
            if not image_obj:
                return None

            imgproxy_base_url = image_obj.get("imgproxy_base_url") or image_obj.get(
                "file_url"
            )
            if not imgproxy_base_url:
                return None

            base_w, base_h, scale_hint, has_metadata = _infer_base_dims(
                image_obj, default_width=default_width, default_height=default_height
            )

            # If we don't have metadata, keep legacy behavior: emit 1x + 2x
            # If we do have metadata, only emit up to the inferred scale.
            max_scale = 2 if not has_metadata else max(1, min(scale_hint, 3))

            entries: list[tuple[int, str]] = []
            for scale in (1, 2, 3):
                if scale > max_scale:
                    continue
                url = imgproxy_service.generate_url(
                    source_url=imgproxy_base_url,
                    width=base_w * scale,
                    height=base_h * scale,
                    resize_type="fill",
                )
                if url:
                    entries.append((scale, url))

            if not entries:
                return None

            if len(entries) == 1:
                return f"{css_var_name}: url('{entries[0][1]}');"

            image_set_parts = ", ".join(
                [f"url('{url}') {scale}x" for scale, url in entries]
            )
            return f"{css_var_name}: image-set({image_set_parts});"

        def _build_aspect_ratio_var(
            *,
            css_var_name: str,
            image_obj: Optional[dict],
            default_width: int,
            default_height: int,
        ) -> str:
            base_w, base_h, _, _ = _infer_base_dims(
                image_obj, default_width=default_width, default_height=default_height
            )
            return f"{css_var_name}: {base_w} / {base_h};"

        template_config = super().prepare_template_context(config, context)

        # Build complete inline style string
        style_parts = []

        # Defaults used only when image metadata lacks width/height
        mobile_default_width = 640
        mobile_default_height = 80

        tablet_default_width = 1024
        tablet_default_height = 112

        desktop_default_width = 1280
        desktop_default_height = 112

        # Get images
        image = config.get("image")
        mobile_image = config.get("mobile_image")
        tablet_image = config.get("tablet_image")

        # Determine breakpoint sources (used for aspect ratio fallbacks too)
        tablet_source = tablet_image or image
        mobile_source = mobile_image or tablet_image or image

        # Desktop (uses desktop image only)
        desktop_style = _build_image_set_var(
            css_var_name="--desktop-bg-image",
            image_obj=image,
            default_width=desktop_default_width,
            default_height=desktop_default_height,
        )
        if desktop_style:
            style_parts.append(desktop_style)

        # Tablet (fallback to desktop image)
        tablet_style = _build_image_set_var(
            css_var_name="--tablet-bg-image",
            image_obj=tablet_source,
            default_width=tablet_default_width,
            default_height=tablet_default_height,
        )
        if tablet_style:
            style_parts.append(tablet_style)

        # Mobile (fallback to tablet, then desktop)
        mobile_style = _build_image_set_var(
            css_var_name="--mobile-bg-image",
            image_obj=mobile_source,
            default_width=mobile_default_width,
            default_height=mobile_default_height,
        )
        if mobile_style:
            style_parts.append(mobile_style)

        # Aspect ratios (always emitted; image fallbacks mirror bg image fallbacks)
        style_parts.append(
            _build_aspect_ratio_var(
                css_var_name="--desktop-header-ar",
                image_obj=image,
                default_width=desktop_default_width,
                default_height=desktop_default_height,
            )
        )
        style_parts.append(
            _build_aspect_ratio_var(
                css_var_name="--tablet-header-ar",
                image_obj=tablet_source,
                default_width=tablet_default_width,
                default_height=tablet_default_height,
            )
        )
        style_parts.append(
            _build_aspect_ratio_var(
                css_var_name="--mobile-header-ar",
                image_obj=mobile_source,
                default_width=mobile_default_width,
                default_height=mobile_default_height,
            )
        )

        # Fixed heights for tablet/desktop (mobile remains responsive via aspect-ratio)
        style_parts.append(f"--tablet-header-h: {tablet_default_height}px;")
        style_parts.append(f"--desktop-header-h: {desktop_default_height}px;")

        # Join all style parts (heights and alignments moved to CSS)
        template_config["header_style"] = " ".join(style_parts)

        return template_config
