"""Validated theme text effects. Keep rendering in sync with textOutlineStyles.js."""

import math
import re

from rest_framework.exceptions import ValidationError

STYLE_KEY = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,63}\Z")
RESERVED_KEYS = {"none", "__proto__", "constructor", "prototype"}
DEFAULT_STYLE = {
    "name": "Text outline",
    "style": "outline",
    "colorMode": "black",
    "color": "#000000",
    "thickness": 1,
    "radius": 4,
    "angle": 45,
    "offset": 2,
    "opacity": 100,
}
NUMERIC_LIMITS = {
    "thickness": (0, 20),
    "radius": (0, 100),
    "angle": (-360, 360),
    "offset": (-100, 100),
    "opacity": (0, 100),
}


def default_text_outline_styles():
    # Return independent definitions: these are ordinary editable theme presets.
    return {
        "dark": {**DEFAULT_STYLE, "name": "Dark outline", "colorMode": "black"},
        "light": {**DEFAULT_STYLE, "name": "Light outline", "colorMode": "white"},
    }


def validate_text_outline_styles(value):
    if not isinstance(value, dict) or len(value) > 100:
        raise ValidationError("Text outline styles must be an object containing at most 100 styles.")
    normalized = {}
    for key, raw in value.items():
        if not STYLE_KEY.fullmatch(key) or key in RESERVED_KEYS or not isinstance(raw, dict):
            raise ValidationError("Each text outline style needs a unique, non-reserved key beginning with a letter.")
        if set(raw) - set(DEFAULT_STYLE):
            raise ValidationError(f"Unknown properties in text outline style {key}.")
        style = {**DEFAULT_STYLE, **raw}
        if not isinstance(style["name"], str) or not style["name"].strip() or len(style["name"]) > 100:
            raise ValidationError("A text outline style needs a name of 1–100 characters.")
        if style["style"] not in ("outline", "gradientBlur", "dropShadow"):
            raise ValidationError("Choose outline, gradientBlur or dropShadow.")
        if style["colorMode"] not in ("same", "white", "black", "complement", "rgb"):
            raise ValidationError("Choose same, white, black, complement or rgb color.")
        if not isinstance(style["color"], str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", style["color"]):
            raise ValidationError("Custom RGB colors must use #RRGGBB format.")
        for field, (low, high) in NUMERIC_LIMITS.items():
            number = style[field]
            if (
                isinstance(number, bool)
                or not isinstance(number, (int, float))
                or not math.isfinite(number)
                or not low <= number <= high
            ):
                raise ValidationError(f"{field} must be between {low} and {high}.")
        normalized[key] = style
    return normalized


def text_outline_shadow(raw):
    style = {**DEFAULT_STYLE, **raw}
    color = {
        "same": "currentColor",
        "white": "#ffffff",
        "black": "#000000",
        "complement": "rgb(from currentColor calc(255 - r) calc(255 - g) calc(255 - b))",
        "rgb": style["color"],
    }[style["colorMode"]]
    if style["opacity"] != 100:
        color = f"color-mix(in srgb, {color} {style['opacity']:g}%, transparent)"
    angle = math.radians(style["angle"])
    distance = style["offset"] if style["style"] == "dropShadow" else 0
    x, y = math.cos(angle) * distance, math.sin(angle) * distance
    blur = style["radius"] if style["style"] != "outline" else 0

    def layer(dx, dy):
        # Suppress negative zero and keep CSS compact and deterministic.
        def fmt(number):
            return f"{0 if abs(number) < 0.0005 else number:.3f}".rstrip("0").rstrip(".")

        return f"{fmt(dx)}px {fmt(dy)}px {blur:g}px {color}"

    if not style["thickness"]:
        return layer(x, y)
    return ", ".join(
        layer(x + math.cos(i * math.pi / 8) * style["thickness"], y + math.sin(i * math.pi / 8) * style["thickness"])
        for i in range(16)
    )


def text_outline_css(styles):
    try:
        styles = validate_text_outline_styles(styles)
    except ValidationError:
        return ""
    return (
        ":root {"
        + "".join(f"--text-outline-{key}: {text_outline_shadow(style)};" for key, style in styles.items())
        + "}"
    )
