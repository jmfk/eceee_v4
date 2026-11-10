import unittest
from unittest.mock import MagicMock, patch

from content_migration.legacy_news.remote import get_public_url


class LegacyRemoteUrlTests(unittest.TestCase):
    @patch("content_migration.legacy_news.remote.http.client.HTTPConnection")
    @patch("content_migration.legacy_news.remote.socket.getaddrinfo")
    def test_image_request_encodes_unicode_and_spaces_without_changing_existing_escapes(self, resolve, connect):
        resolve.return_value = [(2, 1, 6, "", ("93.184.216.34", 80))]
        connection = MagicMock()
        connect.return_value = connection
        response = connection.getresponse.return_value
        response.status = 200
        response.getheaders.return_value = [("Content-Type", "image/png")]
        response.read.return_value = b"image"

        result = get_public_url(
            "http://legacy.example/Columns/hans_kro\u0308nika 20juni%20bild.png?caption=ä&size=preview#ignored",
            max_bytes=1024,
        )

        self.assertEqual(result.content, b"image")
        connect.assert_called_once_with("93.184.216.34", port=80, timeout=20.0)
        args, kwargs = connection.request.call_args
        self.assertEqual(args, ("GET", "/Columns/hans_kro%CC%88nika%2020juni%20bild.png?caption=%C3%A4&size=preview"))
        self.assertEqual(kwargs["headers"]["Host"], "legacy.example")
        connection.close.assert_called_once()
