"""
imgproxy integration for on-the-fly image resizing and optimization.
"""

import hashlib
import hmac
import base64
import urllib.parse
from typing import Dict, Optional, Tuple, Union
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class ImgProxyService:
    """
    Service for generating imgproxy URLs for on-the-fly image processing.
    """

    def __init__(self):
        self.base_url = getattr(settings, "IMGPROXY_URL", "http://localhost:8080")
        self.key = getattr(settings, "IMGPROXY_KEY", "")
        self.salt = getattr(settings, "IMGPROXY_SALT", "")
        self.signature_size = getattr(settings, "IMGPROXY_SIGNATURE_SIZE", 32)

        # Convert hex keys to bytes
        if self.key:
            self.key_bytes = bytes.fromhex(self.key)
        else:
            self.key_bytes = b""

        if self.salt:
            self.salt_bytes = bytes.fromhex(self.salt)
        else:
            self.salt_bytes = b""

    def generate_url(
        self,
        source_url: str,
        width: Optional[int] = None,
        height: Optional[int] = None,
        resize_type: str = "fit",
        gravity: str = "sm",
        quality: Optional[int] = None,
        format: Optional[str] = None,
        preset: Optional[str] = None,
        **kwargs,
    ) -> str:
        """
        Generate a signed imgproxy URL for image processing.

        Args:
            source_url: Source image URL (S3 path or HTTP URL)
            width: Target width in pixels
            height: Target height in pixels
            resize_type: Resizing type ('fit', 'fill', 'crop', 'force')
            gravity: Gravity for cropping ('no', 'so', 'ea', 'we', 'noea', 'nowe', 'soea', 'sowe', 'ce', 'sm')
            quality: JPEG/WebP quality (1-100)
            format: Output format ('jpg', 'png', 'webp', 'avif', 'gif', 'ico', 'svg')
            preset: Predefined preset name
            **kwargs: Additional processing options

        Returns:
            Signed imgproxy URL
        """
        try:
            # Build processing options
            processing_options = []

            # Use preset if provided
            if preset:
                processing_options.append(f"preset:{preset}")
            else:
                # Manual processing options
                if resize_type and (width or height):
                    w = width or 0
                    h = height or 0
                    processing_options.append(f"resize:{resize_type}:{w}:{h}")

                if gravity and gravity != "sm":
                    processing_options.append(f"gravity:{gravity}")

                if quality:
                    processing_options.append(f"quality:{quality}")

                if format:
                    processing_options.append(f"format:{format}")

            # Add additional options
            for key, value in kwargs.items():
                if value is not None:
                    processing_options.append(f"{key}:{value}")

            # Encode source URL
            encoded_source_url = (
                base64.urlsafe_b64encode(source_url.encode()).decode().rstrip("=")
            )

            # Build path
            processing_path = "/".join(processing_options) if processing_options else ""
            path = f"/{processing_path}/{encoded_source_url}"

            # Generate signature if keys are available
            if self.key_bytes and self.salt_bytes:
                signature = self._generate_signature(path)
                signed_path = f"/{signature}{path}"
            else:
                # Unsigned URL (for development only)
                signed_path = f"/unsafe{path}"
                logger.warning(
                    "Using unsigned imgproxy URLs - not recommended for production"
                )

            return f"{self.base_url}{signed_path}"

        except Exception as e:
            logger.error(f"Failed to generate imgproxy URL: {e}")
            # Fallback to original URL
            return source_url

    def _generate_signature(self, path: str) -> str:
        """Generate HMAC signature for imgproxy URL."""
        try:
            # Generate HMAC-SHA256 signature
            # According to imgproxy docs: HMAC(key, salt + path)
            digest = hmac.new(
                self.key_bytes,
                msg=self.salt_bytes + path.encode(),
                digestmod=hashlib.sha256,
            ).digest()

            # Encode to URL-safe base64
            signature = base64.urlsafe_b64encode(digest).decode()

            # Truncate to specified size if configured
            if self.signature_size and self.signature_size < len(signature):
                signature = signature[: self.signature_size]

            # Remove padding
            return signature.rstrip("=")

        except Exception as e:
            logger.error(f"Failed to generate imgproxy signature: {e}")
            return "unsigned"

    def get_responsive_urls(
        self,
        source_url: str,
        sizes: Optional[Dict[str, Tuple[int, int]]] = None,
        format: Optional[str] = None,
        quality: Optional[int] = None,
    ) -> Dict[str, str]:
        """
        Generate multiple responsive image URLs for different screen sizes.

        Args:
            source_url: Source image URL
            sizes: Dictionary of size names to (width, height) tuples
            format: Output format
            quality: Image quality

        Returns:
            Dictionary mapping size names to imgproxy URLs
        """
        if sizes is None:
            sizes = {
                "thumbnail": (150, 150),
                "small": (300, 300),
                "medium": (600, 600),
                "large": (1200, 1200),
                "xlarge": (1920, 1920),
            }

        urls = {}
        for size_name, (width, height) in sizes.items():
            urls[size_name] = self.generate_url(
                source_url=source_url,
                width=width,
                height=height,
                resize_type="fit",
                format=format,
                quality=quality,
            )

        return urls

    def get_preset_url(self, source_url: str, preset: str) -> str:
        """
        Generate imgproxy URL using a predefined preset.

        Args:
            source_url: Source image URL
            preset: Preset name (thumbnail, small, medium, large, hero, avatar)

        Returns:
            imgproxy URL with preset
        """
        return self.generate_url(source_url=source_url, preset=preset)

    def get_optimized_url(
        self,
        source_url: str,
        width: Optional[int] = None,
        height: Optional[int] = None,
        webp: bool = True,
        quality: int = 85,
    ) -> str:
        """
        Generate optimized image URL with modern format support.

        Args:
            source_url: Source image URL
            width: Target width
            height: Target height
            webp: Enable WebP format detection
            quality: Image quality

        Returns:
            Optimized imgproxy URL
        """
        format_type = "webp" if webp else None

        return self.generate_url(
            source_url=source_url,
            width=width,
            height=height,
            resize_type="fit",
            format=format_type,
            quality=quality,
        )

    def health_check(self) -> bool:
        """
        Check if imgproxy service is available.

        Returns:
            True if service is healthy, False otherwise
        """
        try:
            import requests

            response = requests.get(f"{self.base_url}/health", timeout=5)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"imgproxy health check failed: {e}")
            return False


# Global service instance
imgproxy_service = ImgProxyService()


def get_image_url(
    source_url: str, width: Optional[int] = None, height: Optional[int] = None, **kwargs
) -> str:
    """
    Convenience function to generate imgproxy URL.

    Args:
        source_url: Source image URL
        width: Target width
        height: Target height
        **kwargs: Additional processing options

    Returns:
        imgproxy URL
    """
    return imgproxy_service.generate_url(
        source_url=source_url, width=width, height=height, **kwargs
    )


def get_responsive_images(source_url: str, **kwargs) -> Dict[str, str]:
    """
    Convenience function to generate responsive image URLs.

    Args:
        source_url: Source image URL
        **kwargs: Additional options

    Returns:
        Dictionary of responsive image URLs
    """
    return imgproxy_service.get_responsive_urls(source_url=source_url, **kwargs)


def get_thumbnail_url(source_url: str, size: int = 150) -> str:
    """
    Generate thumbnail URL.

    Args:
        source_url: Source image URL
        size: Thumbnail size (square)

    Returns:
        Thumbnail imgproxy URL
    """
    return imgproxy_service.generate_url(
        source_url=source_url, width=size, height=size, resize_type="fill", gravity="sm"
    )


def get_avatar_url(source_url: str, size: int = 128) -> str:
    """
    Generate avatar URL with WebP format.

    Args:
        source_url: Source image URL
        size: Avatar size (square)

    Returns:
        Avatar imgproxy URL
    """
    return imgproxy_service.generate_url(
        source_url=source_url,
        width=size,
        height=size,
        resize_type="fill",
        gravity="sm",
        format="webp",
        quality=90,
    )


def get_hero_image_url(source_url: str, width: int = 1920, height: int = 1080) -> str:
    """
    Generate hero image URL.

    Args:
        source_url: Source image URL
        width: Hero width
        height: Hero height

    Returns:
        Hero imgproxy URL
    """
    return imgproxy_service.generate_url(
        source_url=source_url,
        width=width,
        height=height,
        resize_type="fill",
        gravity="sm",
        quality=90,
    )


# Preset configurations
PRESET_CONFIGS = {
    "thumbnail": {"width": 150, "height": 150, "resize_type": "fill"},
    "small": {"width": 300, "height": 300, "resize_type": "fit"},
    "medium": {"width": 600, "height": 600, "resize_type": "fit"},
    "large": {"width": 1200, "height": 1200, "resize_type": "fit"},
    "hero": {"width": 1920, "height": 1080, "resize_type": "fill"},
    "avatar": {"width": 128, "height": 128, "resize_type": "fill", "format": "webp"},
}


def get_preset_config(preset_name: str) -> Dict:
    """
    Get configuration for a preset.

    Args:
        preset_name: Name of the preset

    Returns:
        Preset configuration dictionary
    """
    return PRESET_CONFIGS.get(preset_name, {})


def validate_imgproxy_config() -> Dict[str, any]:
    """
    Validate imgproxy configuration and connectivity.

    Returns:
        Dictionary with validation results
    """
    results = {
        "configured": bool(imgproxy_service.base_url),
        "signed": bool(imgproxy_service.key_bytes and imgproxy_service.salt_bytes),
        "healthy": False,
        "url": imgproxy_service.base_url,
        "errors": [],
    }

    if not results["configured"]:
        results["errors"].append("IMGPROXY_URL not configured")
        return results

    if not results["signed"]:
        results["errors"].append("imgproxy keys not configured - using unsafe URLs")

    # Test connectivity
    try:
        results["healthy"] = imgproxy_service.health_check()
        if not results["healthy"]:
            results["errors"].append("imgproxy service not responding")
    except Exception as e:
        results["errors"].append(f"Health check failed: {e}")

    return results
