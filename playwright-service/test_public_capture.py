import asyncio
import socket
import subprocess
import unittest
from unittest.mock import patch

from public_capture import capture_public_page, follow_public_redirects, public_url, request_public


class PublicCaptureBoundaryTests(unittest.TestCase):
    def test_rejects_non_web_credentials_and_custom_ports(self):
        for url in ("file:///tmp/file", "http://user:pass@example.com", "https://example.com:8000", "http://localhost"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                public_url(url)

    def test_rejects_dns_answers_containing_private_addresses(self):
        answers = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (value, 443)) for value in ("8.8.8.8", "127.0.0.1")]
        with (
            patch("public_capture.socket.getaddrinfo", return_value=answers),
            patch("public_capture.http.client.HTTPSConnection") as connect,
        ):
            with self.assertRaises(ValueError):
                request_public("https://example.com")
            connect.assert_not_called()

    def test_connects_to_the_validated_address_without_a_second_hostname_lookup(self):
        answers = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443))]
        with (
            patch("public_capture.socket.getaddrinfo", return_value=answers),
            patch("public_capture.http.client.HTTPSConnection") as https,
            patch("public_capture.socket.create_connection") as connect,
        ):
            connection = https.return_value
            connection.getresponse.return_value.status = 200
            connection.getresponse.return_value.getheader.side_effect = lambda _, default=None: default
            connection.getresponse.return_value.read.return_value = b"example"
            self.assertEqual(request_public("https://example.com/räksmörgås?ref=%20")[2], b"example")
            self.assertEqual(connection.request.call_args.args[1], "/r%C3%A4ksm%C3%B6rg%C3%A5s?ref=%20")
            connection._create_connection(("example.com", 443), 5, None)
            connect.assert_called_once_with(("8.8.8.8", 443), 5, None)
            https.assert_called_once_with("example.com", port=443, timeout=5)

    def test_redirects_reenter_the_pinned_loader(self):
        with patch(
            "public_capture.request_public",
            side_effect=[(302, {"location": "https://example.com/target"}, b""), (200, {}, b"page")],
        ) as fetch:
            self.assertEqual(follow_public_redirects("https://example.com/")[0], "https://example.com/target")
            self.assertEqual(
                [call.args[0] for call in fetch.call_args_list], ["https://example.com/", "https://example.com/target"]
            )

    def test_fixture_renders_with_the_os_sandbox_enabled(self):
        document = ("https://example.com/", 200, {"content-type": "text/html"}, b"<h1>Screenshot fixture</h1>")
        with patch("public_capture.follow_public_redirects", return_value=document):
            contents = asyncio.run(capture_public_page("https://example.com/"))
        self.assertTrue(contents.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_capture_worker_is_terminated_at_deadline(self):
        from app import app

        with patch("subprocess.Popen") as spawn, patch("os.killpg") as kill_group:
            worker = spawn.return_value
            worker.pid = 27
            worker.communicate.side_effect = subprocess.TimeoutExpired("capture", 25)
            result = app.test_client().post("/public-screenshot", json={"url": "https://example.com/"})
        self.assertEqual(result.status_code, 400)
        kill_group.assert_called_once()
        self.assertEqual(kill_group.call_args.args[0], 27)
        worker.wait.assert_called_once_with(timeout=2)
