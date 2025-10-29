"""
Utilities for detecting and resolving high-resolution image variants.

This module provides functionality to discover higher resolution versions of images
by checking common naming patterns and srcset attributes.
"""

import re
import logging
import requests
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse, urlunparse
from PIL import Image
from io import BytesIO

logger = logging.getLogger(__name__)


def parse_srcset(srcset_str: str) -> List[Dict[str, str]]:
    """
    Parse an HTML srcset attribute into a list of URL/descriptor pairs.

    Args:
        srcset_str: The srcset attribute value

    Returns:
        List of dicts with 'url' and 'descriptor' keys

    Example:
        >>> parse_srcset("image-1x.jpg 1x, image-2x.jpg 2x, image-3x.jpg 3x")
        [
            {'url': 'image-1x.jpg', 'descriptor': '1x'},
            {'url': 'image-2x.jpg', 'descriptor': '2x'},
            {'url': 'image-3x.jpg', 'descriptor': '3x'}
        ]
    """
    if not srcset_str:
        return []

    sources = []
    for part in srcset_str.split(","):
        part = part.strip()
        if " " in part:
            url_part, descriptor = part.rsplit(" ", 1)
            sources.append({"url": url_part.strip(), "descriptor": descriptor.strip()})
        else:
            sources.append({"url": part, "descriptor": "1x"})

    return sources


def generate_resolution_variants(url: str) -> List[Dict[str, Any]]:
    """
    Generate potential high-resolution URL variants for a given image URL.

    Checks common patterns like:
    - Retina suffixes: -2x, -3x, @2x, @3x
    - Size variants: /large/, /original/, /hires/
    - Resolution indicators: _1920, _2048, _3840

    Args:
        url: The original image URL

    Returns:
        List of dicts with 'url' and 'multiplier' keys, sorted by multiplier (highest first)

    Example:
        >>> variants = generate_resolution_variants('https://example.com/image.jpg')
        [
            {'url': 'https://example.com/image-3x.jpg', 'multiplier': 3.0},
            {'url': 'https://example.com/image@3x.jpg', 'multiplier': 3.0},
            ...
        ]
    """
    parsed = urlparse(url)
    path = parsed.path

    # Get filename and extension
    if "." in path:
        base_path, ext = path.rsplit(".", 1)
    else:
        base_path = path
        ext = ""

    variants = []

    # Pattern 1: Retina suffixes (highest priority)
    for multiplier, suffixes in [
        (3.0, ["-3x", "@3x", "_3x"]),
        (2.0, ["-2x", "@2x", "_2x"]),
    ]:
        for suffix in suffixes:
            variant_path = (
                f"{base_path}{suffix}.{ext}" if ext else f"{base_path}{suffix}"
            )
            variant_url = urlunparse(parsed._replace(path=variant_path))
            variants.append(
                {
                    "url": variant_url,
                    "multiplier": multiplier,
                    "source": "retina-suffix",
                }
            )

    # Pattern 2: Size-based directory paths
    path_parts = base_path.split("/")
    if len(path_parts) > 1:
        filename = path_parts[-1]
        dir_path = "/".join(path_parts[:-1])

        for multiplier, dirs in [
            (3.0, ["original", "hires", "fullsize"]),
            (2.5, ["xlarge", "xxlarge"]),
            (2.0, ["large", "big"]),
        ]:
            for size_dir in dirs:
                variant_path = (
                    f"{dir_path}/{size_dir}/{filename}.{ext}"
                    if ext
                    else f"{dir_path}/{size_dir}/{filename}"
                )
                variant_url = urlunparse(parsed._replace(path=variant_path))
                variants.append(
                    {
                        "url": variant_url,
                        "multiplier": multiplier,
                        "source": "directory",
                    }
                )

    # Pattern 3: Resolution indicators in filename
    for multiplier, widths in [
        (3.0, ["3840", "4k", "4096"]),
        (2.0, ["1920", "2k", "2048"]),
    ]:
        for width in widths:
            variant_path = (
                f"{base_path}_{width}.{ext}" if ext else f"{base_path}_{width}"
            )
            variant_url = urlunparse(parsed._replace(path=variant_path))
            variants.append(
                {
                    "url": variant_url,
                    "multiplier": multiplier,
                    "source": "width-indicator",
                }
            )

    # Sort by multiplier (highest first)
    variants.sort(key=lambda x: x["multiplier"], reverse=True)

    return variants


def check_url_exists(url: str, timeout: int = 5) -> Tuple[bool, Optional[int]]:
    """
    Check if a URL exists using a HEAD request.

    Args:
        url: The URL to check
        timeout: Request timeout in seconds

    Returns:
        Tuple of (exists, content_length)
    """
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        if response.status_code == 200:
            content_length = int(response.headers.get("content-length", 0))
            return True, content_length
        return False, None
    except Exception as e:
        logger.debug(f"URL check failed for {url}: {e}")
        return False, None


def get_image_dimensions(image_bytes: bytes) -> Optional[Tuple[int, int]]:
    """
    Get dimensions of an image from its bytes.

    Args:
        image_bytes: The image data

    Returns:
        Tuple of (width, height) or None if unable to determine
    """
    try:
        image = Image.open(BytesIO(image_bytes))
        return image.size
    except Exception as e:
        logger.debug(f"Failed to get image dimensions: {e}")
        return None


def find_highest_resolution(
    base_url: str,
    srcset: Optional[List[Dict[str, str]]] = None,
    check_patterns: bool = True,
    max_checks: int = 10,
) -> Dict[str, Any]:
    """
    Find the highest resolution version of an image.

    Args:
        base_url: The base image URL
        srcset: Optional srcset data with URL/descriptor pairs
        check_patterns: Whether to check URL pattern variants
        max_checks: Maximum number of URLs to check

    Returns:
        Dict with:
            - url: The highest resolution URL found
            - multiplier: Resolution multiplier (1.0, 2.0, 3.0, etc.)
            - source: How it was found ('srcset', 'url-pattern', or 'original')
            - dimensions: Tuple of (width, height) if available
            - file_size: File size in bytes
    """
    candidates = []

    # Add original URL as baseline
    candidates.append(
        {
            "url": base_url,
            "multiplier": 1.0,
            "source": "original",
            "priority": 999,  # Lowest priority
        }
    )

    # Add srcset candidates
    if srcset:
        for item in srcset:
            descriptor = item.get("descriptor", "1x")
            # Parse multiplier from descriptor (e.g., "2x" -> 2.0, "1024w" -> estimate)
            if descriptor.endswith("x"):
                try:
                    multiplier = float(descriptor[:-1])
                except ValueError:
                    multiplier = 1.0
            elif descriptor.endswith("w"):
                # Width descriptor - estimate multiplier based on width
                try:
                    width = int(descriptor[:-1])
                    # Rough estimate: 800w = 1x, 1600w = 2x, 2400w = 3x
                    multiplier = max(1.0, width / 800.0)
                except ValueError:
                    multiplier = 1.0
            else:
                multiplier = 1.0

            candidates.append(
                {
                    "url": item["url"],
                    "multiplier": multiplier,
                    "source": "srcset",
                    "priority": 1,  # Highest priority
                }
            )

    # Add URL pattern variants
    if check_patterns:
        pattern_variants = generate_resolution_variants(base_url)
        for variant in pattern_variants:
            candidates.append(
                {
                    "url": variant["url"],
                    "multiplier": variant["multiplier"],
                    "source": f"url-pattern-{variant['source']}",
                    "priority": 2,  # Medium priority
                }
            )

    # Remove duplicates and sort by priority then multiplier
    seen_urls = set()
    unique_candidates = []
    for candidate in candidates:
        if candidate["url"] not in seen_urls:
            seen_urls.add(candidate["url"])
            unique_candidates.append(candidate)

    unique_candidates.sort(key=lambda x: (x["priority"], -x["multiplier"]))

    # Limit checks
    candidates_to_check = unique_candidates[:max_checks]

    # Check which URLs actually exist and get their info
    valid_candidates = []
    for candidate in candidates_to_check:
        exists, file_size = check_url_exists(candidate["url"])
        if exists:
            candidate["file_size"] = file_size or 0
            valid_candidates.append(candidate)
            logger.debug(
                f"Found valid image: {candidate['url']} ({candidate['multiplier']}x, {file_size} bytes)"
            )

    # If no valid candidates found, return original URL
    if not valid_candidates:
        logger.warning(f"No valid resolution variants found for {base_url}")
        return {
            "url": base_url,
            "multiplier": 1.0,
            "source": "original-fallback",
            "dimensions": None,
            "file_size": 0,
        }

    # Select highest resolution (highest multiplier, then largest file size)
    valid_candidates.sort(key=lambda x: (x["multiplier"], x["file_size"]), reverse=True)
    best = valid_candidates[0]

    logger.info(
        f"Selected {best['multiplier']}x resolution for {base_url}: {best['url']} "
        f"(source: {best['source']}, size: {best['file_size']} bytes)"
    )

    return {
        "url": best["url"],
        "multiplier": best["multiplier"],
        "source": best["source"],
        "dimensions": None,  # Will be filled later if needed
        "file_size": best.get("file_size", 0),
    }
