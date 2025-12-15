"""
API endpoint for secure server-side imgproxy URL signing.

This endpoint allows the frontend to request signed imgproxy URLs without
exposing the secret keys in the client-side code.
"""

from rest_framework.decorators import (
    api_view,
    permission_classes,
    authentication_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.core.cache import cache
from file_manager.imgproxy import imgproxy_service
import hashlib
import logging

logger = logging.getLogger(__name__)


@api_view(["POST"])
@authentication_classes([])  # No authentication required (public API)
@permission_classes([AllowAny])  # Allow anonymous access for public images
def sign_imgproxy_url(request):
    """
    Generate a signed imgproxy URL on the server.

    This endpoint accepts image processing parameters and returns a signed
    imgproxy URL, keeping the signing keys secure on the server.

    POST /api/media/imgproxy/sign/
    {
        "source_url": "http://minio:9000/eceee-media/uploads/image.jpg",
        "width": 1280,
        "height": 132,
        "resize_type": "fill",
        "gravity": "sm",
        "quality": 90,
        "format": "webp"
    }

    Returns:
    {
        "imgproxy_url": "http://imgproxy:8080/signature/resize:fill:1280:132/...",
        "source_url": "http://minio:9000/...",
        "cached": false
    }
    """
    try:
        # Extract parameters
        source_url = request.data.get("source_url")
        if not source_url:
            return Response(
                {"error": "source_url is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Optional parameters
        width = request.data.get("width")
        height = request.data.get("height")
        resize_type = request.data.get("resize_type", "fit")
        gravity = request.data.get("gravity", "sm")
        quality = request.data.get("quality")
        format_type = request.data.get("format")
        preset = request.data.get("preset")

        # Additional processing options
        blur = request.data.get("blur")
        sharpen = request.data.get("sharpen")
        brightness = request.data.get("brightness")
        contrast = request.data.get("contrast")
        grayscale = request.data.get("grayscale")
        version = request.data.get("version")

        # Create cache key from parameters
        cache_key_parts = [
            source_url,
            str(width),
            str(height),
            resize_type,
            gravity,
            str(quality),
            str(format_type),
            str(preset),
            str(blur),
            str(sharpen),
            str(brightness),
            str(contrast),
            str(grayscale),
            str(version),
        ]
        cache_key_string = "|".join(str(p) for p in cache_key_parts if p)
        cache_key = f"imgproxy_url:{hashlib.md5(cache_key_string.encode()).hexdigest()}"

        # Check cache first
        cached_url = cache.get(cache_key)
        if cached_url:
            return Response(
                {
                    "imgproxy_url": cached_url,
                    "source_url": source_url,
                    "cached": True,
                }
            )

        # Build kwargs for imgproxy service
        kwargs = {}
        if blur is not None:
            kwargs["blur"] = blur
        if sharpen is not None:
            kwargs["sharpen"] = sharpen
        if brightness is not None:
            kwargs["brightness"] = brightness
        if contrast is not None:
            kwargs["contrast"] = contrast
        if grayscale is not None:
            kwargs["grayscale"] = grayscale

        # Generate signed imgproxy URL on server
        imgproxy_url = imgproxy_service.generate_url(
            source_url=source_url,
            width=width,
            height=height,
            resize_type=resize_type,
            gravity=gravity,
            quality=quality,
            format=format_type,
            preset=preset,
            version=version,
            **kwargs,
        )

        # Cache the result for 1 hour
        cache.set(cache_key, imgproxy_url, 60 * 60)

        return Response(
            {
                "imgproxy_url": imgproxy_url,
                "source_url": source_url,
                "cached": False,
            }
        )

    except Exception as e:
        logger.error(f"Error generating imgproxy URL: {e}")
        return Response(
            {"error": "Failed to generate imgproxy URL", "detail": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@authentication_classes([])  # No authentication required (public API)
@permission_classes([AllowAny])
def batch_sign_imgproxy_urls(request):
    """
    Generate multiple signed imgproxy URLs in a single request.

    POST /api/media/imgproxy/sign-batch/
    {
        "requests": [
            {
                "source_url": "http://...",
                "width": 800,
                "height": 600
            },
            {
                "source_url": "http://...",
                "width": 400,
                "height": 400
            }
        ]
    }

    Returns:
    {
        "results": [
            {"imgproxy_url": "...", "source_url": "...", "cached": false},
            {"imgproxy_url": "...", "source_url": "...", "cached": true}
        ]
    }
    """
    try:
        requests_data = request.data.get("requests", [])
        if not requests_data or not isinstance(requests_data, list):
            return Response(
                {"error": "requests array is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(requests_data) > 50:
            return Response(
                {"error": "Maximum 50 requests per batch"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = []
        for req_data in requests_data:
            source_url = req_data.get("source_url")
            if not source_url:
                results.append({"error": "source_url required"})
                continue

            # Generate URL for this request
            try:
                imgproxy_url = imgproxy_service.generate_url(
                    source_url=source_url,
                    width=req_data.get("width"),
                    height=req_data.get("height"),
                    resize_type=req_data.get("resize_type", "fit"),
                    gravity=req_data.get("gravity", "sm"),
                    quality=req_data.get("quality"),
                    format=req_data.get("format"),
                    preset=req_data.get("preset"),
                    version=req_data.get("version"),
                )

                results.append(
                    {
                        "imgproxy_url": imgproxy_url,
                        "source_url": source_url,
                        "cached": False,
                    }
                )
            except Exception as e:
                logger.error(f"Error in batch request: {e}")
                results.append({"error": str(e), "source_url": source_url})

        return Response({"results": results})

    except Exception as e:
        logger.error(f"Error in batch imgproxy signing: {e}")
        return Response(
            {"error": "Failed to process batch request", "detail": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def generate_responsive_imgproxy_urls(request):
    """
    Generate responsive imgproxy URLs for different breakpoints and pixel densities.

    POST /api/media/imgproxy/responsive/
    {
        "source_url": "http://minio:9000/eceee-media/uploads/image.jpg",
        "breakpoints": {
            "mobile": 640,
            "tablet": 1024,
            "desktop": 1280
        },
        "original_width": 3000,
        "original_height": 2000,
        "resize_type": "fit",
        "gravity": "sm",
        "quality": 85,
        "format": "webp",
        "densities": [1, 2],
        "width_multiplier": 1.0
    }

    Returns:
    {
        "srcset": "url1 640w, url2 1280w, url3 1024w, url4 2048w, url5 1280w, url6 2560w",
        "sizes": "(max-width: 640px) 640px, (max-width: 1024px) 1024px, 1280px",
        "urls": {
            "mobile": {"1x": "...", "2x": "..."},
            "tablet": {"1x": "...", "2x": "..."},
            "desktop": {"1x": "...", "2x": "..."}
        },
        "fallback": "..."
    }
    """
    try:
        # Extract parameters
        source_url = request.data.get("source_url")
        if not source_url:
            return Response(
                {"error": "source_url is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Breakpoint dimensions
        breakpoints = request.data.get("breakpoints", {
            "mobile": 640,
            "tablet": 1024,
            "desktop": 1280
        })
        
        # Original image dimensions (optional but recommended)
        original_width = request.data.get("original_width")
        original_height = request.data.get("original_height")
        
        # Image processing options
        resize_type = request.data.get("resize_type", "fit")
        gravity = request.data.get("gravity", "sm")
        quality = request.data.get("quality", 85)
        format_type = request.data.get("format")
        
        # Responsive options
        densities = request.data.get("densities", [1, 2])
        width_multiplier = request.data.get("width_multiplier", 1.0)

        # Version parameter for cache-busting
        version = request.data.get("version")
        
        # Create cache key
        cache_key_parts = [
            source_url,
            str(breakpoints),
            str(original_width),
            str(original_height),
            resize_type,
            gravity,
            str(quality),
            str(format_type),
            str(densities),
            str(width_multiplier),
            str(version),
        ]
        cache_key_string = "|".join(str(p) for p in cache_key_parts if p)
        cache_key = f"imgproxy_responsive:{hashlib.md5(cache_key_string.encode()).hexdigest()}"

        # Check cache
        cached_result = cache.get(cache_key)
        if cached_result:
            return Response(cached_result)

        # Generate URLs for each breakpoint and density
        urls = {}
        srcset_parts = []
        
        for breakpoint_name, breakpoint_width in breakpoints.items():
            urls[breakpoint_name] = {}
            
            # Apply width multiplier (for images that don't fill full slot)
            adjusted_width = int(breakpoint_width * width_multiplier)
            
            for density in densities:
                # Calculate dimensions for this density
                density_width = adjusted_width * density
                density_height = None
                
                # Calculate height maintaining aspect ratio if original dimensions provided
                if original_width and original_height:
                    aspect_ratio = original_height / original_width
                    density_height = int(density_width * aspect_ratio)
                    
                    # Don't exceed original dimensions
                    if density_width > original_width:
                        density_width = original_width
                        density_height = original_height
                    elif density_height and density_height > original_height:
                        density_height = original_height
                        density_width = int(density_height / aspect_ratio)
                
                # Generate URL
                version = request.data.get("version")
                img_url = imgproxy_service.generate_url(
                    source_url=source_url,
                    width=density_width,
                    height=density_height,
                    resize_type=resize_type,
                    gravity=gravity,
                    quality=quality,
                    format=format_type,
                    version=version,
                )
                
                density_key = f"{density}x"
                urls[breakpoint_name][density_key] = img_url
                
                # Add to srcset (using width descriptor)
                srcset_parts.append(f"{img_url} {density_width}w")
        
        # Generate srcset string
        srcset = ", ".join(srcset_parts)
        
        # Generate sizes attribute
        breakpoint_list = sorted(breakpoints.items(), key=lambda x: x[1])
        sizes_parts = []
        for i, (name, width) in enumerate(breakpoint_list[:-1]):
            adjusted_width = int(width * width_multiplier)
            sizes_parts.append(f"(max-width: {width}px) {adjusted_width}px")
        # Default size (largest breakpoint)
        final_width = int(breakpoint_list[-1][1] * width_multiplier)
        sizes_parts.append(f"{final_width}px")
        sizes = ", ".join(sizes_parts)
        
        # Fallback URL (desktop 1x)
        fallback = urls.get("desktop", {}).get("1x") or urls.get("tablet", {}).get("1x") or urls.get("mobile", {}).get("1x")
        
        result = {
            "srcset": srcset,
            "sizes": sizes,
            "urls": urls,
            "fallback": fallback,
        }
        
        # Cache for 1 hour
        cache.set(cache_key, result, 60 * 60)
        
        return Response(result)

    except Exception as e:
        logger.error(f"Error generating responsive imgproxy URLs: {e}")
        return Response(
            {"error": "Failed to generate responsive imgproxy URLs", "detail": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
