from django.test import SimpleTestCase, override_settings

from file_manager.imgproxy import ImgProxyService


class ImgProxyServiceTests(SimpleTestCase):
    @override_settings(
        DEBUG=True,
        IMGPROXY_URL="http://eceee-v4-imgproxy:8080",
        IMGPROXY_PUBLIC_URL="http://localhost:8080",
        IMGPROXY_KEY="",
        IMGPROXY_SALT="",
    )
    def test_local_public_url_uses_same_origin_proxy(self):
        service = ImgProxyService()

        url = service.generate_url(
            source_url="https://example.com/image.png",
            width=640,
            height=320,
            resize_type="fit",
        )

        self.assertTrue(url.startswith("/imgproxy/unsafe/resize:fit:640:320/"))

    @override_settings(
        DEBUG=True,
        IMGPROXY_URL="http://eceee-v4-imgproxy:8080",
        IMGPROXY_PUBLIC_URL="https://imgproxy.example.com",
        IMGPROXY_KEY="",
        IMGPROXY_SALT="",
    )
    def test_external_public_url_is_preserved(self):
        service = ImgProxyService()

        url = service.generate_url(
            source_url="https://example.com/image.png",
            width=640,
            height=320,
            resize_type="fit",
        )

        self.assertTrue(url.startswith("https://imgproxy.example.com/unsafe/"))
