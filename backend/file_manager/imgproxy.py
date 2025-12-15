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
        self.base_url = getattr(
            settings, "IMGPROXY_URL", "https://imgproxy.eceee.fred.nu"
        )
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
        version: Optional[str] = None,
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
            version: Version parameter for cache-busting (e.g., file hash or timestamp)
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

            # Add version parameter to source URL for cache-busting
            if version:
                # Check if source_url already has query parameters
                separator = "&" if "?" in source_url else "?"
                source_url = f"{source_url}{separator}v={version}"

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
            # Ensure leading slash
            if not path.startswith("/"):
                path = "/" + path

            # HMAC(key, salt + path)
            digest = hmac.new(
                self.key_bytes,
                self.salt_bytes + path.encode("utf-8"),
                hashlib.sha256,
            ).digest()

            # Truncate *digest* if configured
            if self.signature_size and self.signature_size < len(digest):
                digest = digest[: self.signature_size]

            # Encode to URL-safe base64 and strip padding
            signature = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("utf-8")

            return signature

        except Exception as e:
            logger.error(f"Failed to generate imgproxy signature: {e}")
            return "unsigned"

    def get_preset_url(self, source_url: str, preset: str, version: Optional[str] = None) -> str:
        """
        Generate imgproxy URL using a predefined preset.

        Args:
            source_url: Source image URL
            preset: Preset name (thumbnail, small, medium, large, hero, avatar)
            version: Version parameter for cache-busting

        Returns:
            imgproxy URL with preset
        """
        return self.generate_url(source_url=source_url, preset=preset, version=version)

    def get_optimized_url(
        self,
        source_url: str,
        width: Optional[int] = None,
        height: Optional[int] = None,
        webp: bool = True,
        quality: int = 85,
        version: Optional[str] = None,
    ) -> str:
        """
        Generate optimized image URL with modern format support.

        Args:
            source_url: Source image URL
            width: Target width
            height: Target height
            webp: Enable WebP format detection
            quality: Image quality
            version: Version parameter for cache-busting

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
            version=version,
        )

    def _constrain_dimensions(
        self,
        requested_width: Optional[int],
        requested_height: Optional[int],
        original_width: Optional[int],
        original_height: Optional[int],
    ) -> Tuple[Optional[int], Optional[int]]:
        """
        Constrain requested dimensions to prevent upscaling.

        Args:
            requested_width: Desired width
            requested_height: Desired height
            original_width: Original image width
            original_height: Original image height

        Returns:
            Tuple of (constrained_width, constrained_height)
        """
        # If no original dimensions available, return requested dimensions
        if not original_width or not original_height:
            return requested_width, requested_height

        # If no requested dimensions, return None (use original)
        if not requested_width and not requested_height:
            return None, None

        # Calculate aspect ratio
        aspect_ratio = original_width / original_height

        # If only width requested
        if requested_width and not requested_height:
            constrained_width = min(requested_width, original_width)
            constrained_height = int(constrained_width / aspect_ratio)
            return constrained_width, constrained_height

        # If only height requested
        if requested_height and not requested_width:
            constrained_height = min(requested_height, original_height)
            constrained_width = int(constrained_height * aspect_ratio)
            return constrained_width, constrained_height

        # Both dimensions requested - constrain to fit within both limits
        width_scale = requested_width / original_width
        height_scale = requested_height / original_height
        
        # Don't upscale
        if width_scale >= 1.0 and height_scale >= 1.0:
            return original_width, original_height
        
        # Use the smaller scale to ensure we fit within both dimensions
        scale = min(width_scale, height_scale, 1.0)
        constrained_width = int(original_width * scale)
        constrained_height = int(original_height * scale)
        
        return constrained_width, constrained_height

    def generate_responsive_urls(
        self,
        source_url: str,
        max_width: Optional[int] = None,
        max_height: Optional[int] = None,
        original_width: Optional[int] = None,
        original_height: Optional[int] = None,
        resize_type: str = "fit",
        gravity: str = "sm",
        quality: Optional[int] = None,
        format: Optional[str] = None,
        densities: list = None,
        **kwargs,
    ) -> Dict:
        """
        Generate multiple responsive image URLs for different pixel densities.

        Args:
            source_url: Source image URL
            max_width: Maximum width (won't exceed original)
            max_height: Maximum height (won't exceed original)
            original_width: Original image width
            original_height: Original image height
            resize_type: Resizing type ('fit', 'fill', 'crop', 'force')
            gravity: Gravity for cropping
            quality: JPEG/WebP quality (1-100)
            format: Output format
            densities: List of pixel densities (e.g., [1, 2]). Defaults to [1, 2]
            **kwargs: Additional processing options

        Returns:
            Dict with URLs and dimensions for each density:
            {
                '1x': {'url': '...', 'width': 800, 'height': 600},
                '2x': {'url': '...', 'width': 1600, 'height': 1200},
                'srcset': 'url1 800w, url2 1600w',
                'sizes': [...]
            }
        """
        if densities is None:
            densities = [1, 2]

        # Constrain base dimensions (1x)
        base_width, base_height = self._constrain_dimensions(
            max_width, max_height, original_width, original_height
        )

        result = {}
        srcset_parts = []
        sizes_list = []

        for density in densities:
            # Calculate dimensions for this density
            if base_width:
                density_width = base_width * density
            else:
                density_width = None

            if base_height:
                density_height = base_height * density
            else:
                density_height = None

            # Further constrain to not exceed original dimensions
            final_width, final_height = self._constrain_dimensions(
                density_width, density_height, original_width, original_height
            )

            # Skip if dimensions would be 0 or None
            if not final_width or not final_height:
                continue

            # Generate URL for this density
            url = self.generate_url(
                source_url=source_url,
                width=final_width,
                height=final_height,
                resize_type=resize_type,
                gravity=gravity,
                quality=quality,
                format=format,
                **kwargs,
            )

            density_key = f"{density}x"
            result[density_key] = {
                "url": url,
                "width": final_width,
                "height": final_height,
            }

            # Build srcset string (using width descriptor)
            srcset_parts.append(f"{url} {final_width}w")

            # Build sizes array
            sizes_list.append({
                "url": url,
                "width": final_width,
                "height": final_height,
                "density": density_key,
            })

        # Add srcset string
        result["srcset"] = ", ".join(srcset_parts)
        result["sizes"] = sizes_list

        return result

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


def get_thumbnail_url(source_url: str, size: int = 150, version: Optional[str] = None) -> str:
    """
    Generate thumbnail URL.

    Args:
        source_url: Source image URL
        size: Thumbnail size (square)
        version: Version parameter for cache-busting

    Returns:
        Thumbnail imgproxy URL
    """
    return imgproxy_service.generate_url(
        source_url=source_url, width=size, height=size, resize_type="fill", gravity="sm", version=version
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
