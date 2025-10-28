"""
Token signing utilities for secure proxy asset URLs.

Uses Django's cryptographic signing to create time-limited tokens that allow
anonymous access to proxied assets without exposing authentication credentials.
"""

import logging
from django.core.signing import TimestampSigner, SignatureExpired, BadSignature
from django.conf import settings

logger = logging.getLogger(__name__)


def sign_proxy_token(url: str) -> str:
    """
    Generate a signed token for a proxy asset URL.

    Args:
        url: The asset URL to sign

    Returns:
        Signed token string

    Example:
        >>> token = sign_proxy_token('https://example.com/image.jpg')
        >>> # Returns: 'aHR0cHM6Ly9leGFtcGxlLmNvbS9pbWFnZS5qcGc:1h2i3j:abc123xyz...'
    """
    signer = TimestampSigner()
    signed_value = signer.sign(url)
    # Return only the signature part (everything after the first colon)
    # This keeps tokens shorter while maintaining security
    return signed_value


def verify_proxy_token(url: str, token: str, max_age: int = 3600) -> bool:
    """
    Verify a signed proxy token for a given URL.

    Args:
        url: The asset URL that should match the token
        token: The signed token to verify
        max_age: Maximum age of the token in seconds (default: 1 hour)

    Returns:
        True if token is valid and not expired, False otherwise

    Raises:
        SignatureExpired: If the token has expired
        BadSignature: If the token is invalid or tampered with

    Example:
        >>> try:
        ...     is_valid = verify_proxy_token(url, token, max_age=3600)
        ... except SignatureExpired:
        ...     # Handle expired token
        ... except BadSignature:
        ...     # Handle invalid token
    """
    signer = TimestampSigner()

    try:
        # Verify the signature and check timestamp
        unsigned_value = signer.unsign(token, max_age=max_age)

        # Verify the URL matches
        if unsigned_value != url:
            logger.warning(f"Token URL mismatch: expected {url}, got {unsigned_value}")
            raise BadSignature("URL does not match token")

        return True

    except SignatureExpired as e:
        logger.info(f"Proxy token expired for URL: {url}")
        raise

    except BadSignature as e:
        logger.warning(f"Invalid proxy token for URL: {url} - {e}")
        raise
