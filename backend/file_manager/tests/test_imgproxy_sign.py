from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from file_manager.views.imgproxy_sign import (
    ImgproxySignRateThrottle,
    batch_sign_imgproxy_urls,
    generate_responsive_imgproxy_urls,
    sign_imgproxy_url,
)


LOC_MEM_CACHE = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "imgproxy-sign-throttle-tests",
    }
}


@override_settings(
    CACHES=LOC_MEM_CACHE,
    REST_FRAMEWORK={
        "DEFAULT_THROTTLE_CLASSES": [
            "rest_framework.throttling.AnonRateThrottle",
            "rest_framework.throttling.UserRateThrottle",
        ],
        "DEFAULT_THROTTLE_RATES": {
            "anon": "1/hour",
            "user": "1/hour",
            "imgproxy_sign": "2/hour",
        },
    },
)
class ImgproxySignThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def tearDown(self):
        cache.clear()

    def test_all_public_signing_views_use_the_dedicated_throttle(self):
        for view in (
            sign_imgproxy_url,
            batch_sign_imgproxy_urls,
            generate_responsive_imgproxy_urls,
        ):
            self.assertEqual(view.cls.throttle_classes, [ImgproxySignRateThrottle])

    @patch("file_manager.views.imgproxy_sign.imgproxy_service.generate_url")
    def test_signing_uses_its_own_rate_limit(self, generate_url):
        generate_url.return_value = "/imgproxy/signed/image.webp"

        with patch.object(ImgproxySignRateThrottle, "get_rate", return_value="2/hour"):
            first = self.client.post(
                "/api/v1/media/imgproxy/sign/",
                {"source_url": "https://example.com/first.jpg", "width": 640},
                format="json",
            )
            second = self.client.post(
                "/api/v1/media/imgproxy/sign/",
                {"source_url": "https://example.com/second.jpg", "width": 640},
                format="json",
            )
            limited = self.client.post(
                "/api/v1/media/imgproxy/sign/",
                {"source_url": "https://example.com/third.jpg", "width": 640},
                format="json",
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(limited.status_code, 429)

    @patch("file_manager.views.imgproxy_sign.imgproxy_service.generate_url")
    def test_full_general_anon_budget_does_not_block_signing(self, generate_url):
        generate_url.return_value = "/imgproxy/signed/image.webp"
        cache.set("throttle_anon_127.0.0.1", [1], timeout=3600)

        response = self.client.post(
            "/api/v1/media/imgproxy/sign/",
            {"source_url": "https://example.com/image.jpg", "width": 640},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
