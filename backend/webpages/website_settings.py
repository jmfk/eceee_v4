"""Validation at the existing versioned page-data boundary."""

import re
import uuid

from rest_framework import serializers


def validate_website_settings(value):
    if not isinstance(value, dict):
        raise serializers.ValidationError("Website settings must be an object.")
    allowed = {
        "language",
        "no_index",
        "share_image_id",
        "translations",
        "analytics_enabled",
        "analytics_require_consent",
    }
    if set(value) - allowed:
        raise serializers.ValidationError("Unknown website setting.")
    language = value.get("language", "")
    if not isinstance(language, str) or language and not re.fullmatch(r"[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*", language):
        raise serializers.ValidationError("Use a language code such as en or sv-SE.")
    for key in ("no_index", "analytics_enabled", "analytics_require_consent"):
        if key in value and not isinstance(value[key], bool):
            raise serializers.ValidationError(f"{key} must be true or false.")
    image = value.get("share_image_id", "")
    if image:
        try:
            uuid.UUID(image)
        except (ValueError, TypeError, AttributeError) as error:
            raise serializers.ValidationError("Choose a valid sharing image.") from error
    translations = value.get("translations", {})
    if not isinstance(translations, dict) or len(translations) > 50:
        raise serializers.ValidationError("Use at most 50 translated pages.")
    for code, page_id in translations.items():
        if (
            not re.fullmatch(r"[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*", code)
            or not re.fullmatch(r"\d{1,19}", str(page_id))
            or not 0 < int(page_id) <= 9223372036854775807
        ):
            raise serializers.ValidationError("Each translation needs a language code and a page number.")
    return value
