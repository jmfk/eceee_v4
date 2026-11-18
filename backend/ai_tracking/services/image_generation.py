"""Use the configured image provider without exposing provider request details."""

import base64

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.exceptions import APIException


class ImageGenerationUnavailable(APIException):
    status_code = 503
    default_detail = "Image generation is unavailable right now. Try again later."


def generate_image(prompt, filename):
    if not getattr(settings, "OPENAI_API_KEY", None):
        raise ImageGenerationUnavailable()
    from openai import OpenAI

    try:
        response = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=120, max_retries=0).images.generate(
            model="gpt-image-2.5-flare", prompt=prompt, n=1, size="1536x1024"
        )
        encoded = response.data[0].b64_json
        if not encoded or len(encoded) > 14_000_000:
            raise ValueError("Image response was empty or too large")
        image = base64.b64decode(encoded, validate=True)
        if len(image) > 10 * 1024 * 1024:
            raise ValueError("Image exceeds the image size limit")
    except Exception:
        # Provider errors may contain request data. Never return or log them.
        raise ImageGenerationUnavailable() from None
    return SimpleUploadedFile(filename, image, content_type="image/png")
