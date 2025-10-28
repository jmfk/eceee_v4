"""
Tests for proxy asset token authentication.

Tests the signed token system that allows secure anonymous access
to proxied assets without exposing authentication credentials.
"""

import time
from django.test import TestCase, override_settings
from django.core.signing import SignatureExpired, BadSignature
from ..utils.token_signing import sign_proxy_token, verify_proxy_token


class ProxyTokenSigningTestCase(TestCase):
    """Test cases for token signing and verification."""

    def test_sign_proxy_token(self):
        """Test that signing a URL produces a valid token."""
        url = "https://example.com/image.jpg"
        token = sign_proxy_token(url)

        # Token should not be empty
        self.assertTrue(token)
        self.assertIsInstance(token, str)

        # Token should contain the URL and signature
        self.assertIn(":", token)

    def test_verify_valid_token(self):
        """Test that a valid token is successfully verified."""
        url = "https://example.com/image.jpg"
        token = sign_proxy_token(url)

        # Should verify successfully
        is_valid = verify_proxy_token(url, token, max_age=3600)
        self.assertTrue(is_valid)

    def test_verify_expired_token(self):
        """Test that an expired token raises SignatureExpired."""
        url = "https://example.com/image.jpg"
        token = sign_proxy_token(url)

        # Verify with max_age=0 should raise SignatureExpired
        with self.assertRaises(SignatureExpired):
            # Wait a tiny bit to ensure time passes
            time.sleep(0.01)
            verify_proxy_token(url, token, max_age=0)

    def test_verify_missing_token(self):
        """Test that missing token raises BadSignature."""
        url = "https://example.com/image.jpg"

        with self.assertRaises((BadSignature, ValueError)):
            verify_proxy_token(url, "", max_age=3600)

    def test_verify_invalid_token(self):
        """Test that an invalid/tampered token raises BadSignature."""
        url = "https://example.com/image.jpg"
        invalid_token = "invalid:token:signature"

        with self.assertRaises(BadSignature):
            verify_proxy_token(url, invalid_token, max_age=3600)

    def test_verify_tampered_token(self):
        """Test that a tampered token raises BadSignature."""
        url = "https://example.com/image.jpg"
        token = sign_proxy_token(url)

        # Tamper with the token
        tampered_token = token[:-5] + "XXXXX"

        with self.assertRaises(BadSignature):
            verify_proxy_token(url, tampered_token, max_age=3600)

    def test_verify_token_url_mismatch(self):
        """Test that a token for a different URL raises BadSignature."""
        url1 = "https://example.com/image1.jpg"
        url2 = "https://example.com/image2.jpg"

        token = sign_proxy_token(url1)

        # Trying to verify url2 with url1's token should fail
        with self.assertRaises(BadSignature):
            verify_proxy_token(url2, token, max_age=3600)

    def test_token_different_for_different_urls(self):
        """Test that different URLs produce different tokens."""
        url1 = "https://example.com/image1.jpg"
        url2 = "https://example.com/image2.jpg"

        token1 = sign_proxy_token(url1)
        token2 = sign_proxy_token(url2)

        self.assertNotEqual(token1, token2)

    @override_settings(CONTENT_IMPORT_PROXY_TOKEN_MAX_AGE=7200)
    def test_custom_max_age_setting(self):
        """Test that custom max_age setting is respected."""
        from django.conf import settings

        # Verify the setting is applied
        self.assertEqual(settings.CONTENT_IMPORT_PROXY_TOKEN_MAX_AGE, 7200)

        url = "https://example.com/image.jpg"
        token = sign_proxy_token(url)

        # Should verify successfully with the custom max_age
        is_valid = verify_proxy_token(
            url, token, max_age=settings.CONTENT_IMPORT_PROXY_TOKEN_MAX_AGE
        )
        self.assertTrue(is_valid)


@override_settings(ALLOWED_HOSTS=["*"])
class ProxyAssetViewTokenTestCase(TestCase):
    """Test cases for ProxyAssetView token authentication."""

    def test_proxy_asset_without_token(self):
        """Test that accessing proxy-asset without token returns 401."""
        response = self.client.get(
            "/api/v1/content-import/proxy-asset/",
            {"url": "https://example.com/image.jpg"},
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn(b"token required", response.content.lower())

    def test_proxy_asset_without_url(self):
        """Test that accessing proxy-asset without URL returns 400."""
        token = sign_proxy_token("https://example.com/image.jpg")

        response = self.client.get(
            "/api/v1/content-import/proxy-asset/",
            {"token": token},
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 400)

    def test_proxy_asset_with_invalid_token(self):
        """Test that accessing proxy-asset with invalid token returns 401."""
        response = self.client.get(
            "/api/v1/content-import/proxy-asset/",
            {"url": "https://example.com/image.jpg", "token": "invalid:token"},
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn(b"Invalid", response.content)

    def test_proxy_asset_with_mismatched_token(self):
        """Test that using a token for a different URL returns 401."""
        url1 = "https://example.com/image1.jpg"
        url2 = "https://example.com/image2.jpg"

        # Create token for url1 but try to access url2
        token = sign_proxy_token(url1)

        response = self.client.get(
            "/api/v1/content-import/proxy-asset/",
            {"url": url2, "token": token},
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 401)
