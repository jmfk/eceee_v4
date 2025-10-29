"""
Token signing utilities for secure proxy asset URLs.

Uses Django's cryptographic signing to create time-limited tokens that allow
anonymous access to proxied assets without exposing authentication credentials.
"""

import json
import logging
from typing import Dict, Any, Optional
from django.core.signing import TimestampSigner, SignatureExpired, BadSignature
from django.conf import settings

logger = logging.getLogger(__name__)


def sign_proxy_token(url: str, metadata: Optional[Dict[str, Any]] = None) -> str:
    """
    Generate a signed token for a proxy asset URL with optional metadata.

    Args:
        url: The asset URL to sign
        metadata: Optional metadata dict (e.g., srcset information)

    Returns:
        Signed token string

    Example:
        >>> token = sign_proxy_token('https://example.com/image.jpg')
        >>> # Returns: 'aHR0cHM6Ly9leGFtcGxlLmNvbS9pbWFnZS5qcGc:1h2i3j:abc123xyz...'
        >>> token_with_meta = sign_proxy_token('https://example.com/image.jpg',
        ...                                     {'srcset': [{'url': '...', 'descriptor': '2x'}]})
    """
    signer = TimestampSigner()

    # If metadata is provided, combine URL and metadata into a single payload
    if metadata:
        payload = json.dumps({"url": url, "metadata": metadata})
    else:
        payload = url

    signed_value = signer.sign(payload)
    return signed_value


def verify_proxy_token(
    url: str, token: str, max_age: int = 3600
) -> Optional[Dict[str, Any]]:
    """
    Verify a signed proxy token for a given URL and return metadata if present.

    Args:
        url: The asset URL that should match the token
        token: The signed token to verify
        max_age: Maximum age of the token in seconds (default: 1 hour)

    Returns:
        Metadata dict if present, None otherwise. For backward compatibility,
        returns None for tokens without metadata.

    Raises:
        SignatureExpired: If the token has expired
        BadSignature: If the token is invalid or tampered with

    Example:
        >>> try:
        ...     metadata = verify_proxy_token(url, token, max_age=3600)
        ...     if metadata:
        ...         srcset = metadata.get('srcset', [])
        ... except SignatureExpired:
        ...     # Handle expired token
        ... except BadSignature:
        ...     # Handle invalid token
    """
    signer = TimestampSigner()

    try:
        # Verify the signature and check timestamp
        unsigned_value = signer.unsign(token, max_age=max_age)

        # Try to parse as JSON (new format with metadata)
        try:
            payload = json.loads(unsigned_value)
            if isinstance(payload, dict) and "url" in payload:
                # New format with metadata
                if payload["url"] != url:
                    logger.warning(
                        f"Token URL mismatch: expected {url}, got {payload['url']}"
                    )
                    raise BadSignature("URL does not match token")
                return payload.get("metadata")
        except (json.JSONDecodeError, TypeError):
            # Old format (just URL string) - backward compatible
            if unsigned_value != url:
                logger.warning(
                    f"Token URL mismatch: expected {url}, got {unsigned_value}"
                )
                raise BadSignature("URL does not match token")
            return None

    except SignatureExpired as e:
        logger.info(f"Proxy token expired for URL: {url}")
        raise

    except BadSignature as e:
        logger.warning(f"Invalid proxy token for URL: {url} - {e}")
        raise
