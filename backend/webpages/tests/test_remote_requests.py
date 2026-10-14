from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from webpages.services.theme_remote import remote_object_request, remote_site_request


class RemoteRequestTests(SimpleTestCase):
    def connection(self, scheme="api_key"):
        return SimpleNamespace(
            base_url="https://remote.example/",
            remote_workspace="workspace",
            encrypted_access_key="encrypted",
            credential_scheme=scheme,
        )

    @patch("webpages.services.theme_remote.validate_remote_url", return_value="https://remote.example/")
    @patch("webpages.services.theme_remote_credentials.decrypt_access_key", return_value="secret")
    @patch("webpages.services.theme_remote.requests.request")
    def test_site_request_keeps_success_path_and_uses_connection_scheme(self, request, _decrypt, _validate):
        response = Mock(status_code=200)
        response.json.return_value = {"results": []}
        request.return_value = response

        result = remote_site_request(self.connection(), "GET", "sites/")

        self.assertEqual(result, {"results": []})
        self.assertEqual(request.call_args.kwargs["headers"]["Authorization"], "ApiKey secret")
        response.close.assert_called_once()

    @patch("webpages.services.theme_remote.validate_remote_url", return_value="https://remote.example/")
    @patch("webpages.services.theme_remote_credentials.decrypt_access_key", return_value="secret")
    @patch("webpages.services.theme_remote.requests.request")
    def test_streamed_site_download_accepts_file_response_without_drf_406(self, request, _decrypt, _validate):
        response = Mock(status_code=200)
        request.return_value = response

        result = remote_site_request(self.connection("theme_key"), "GET", "exports/job/download/", stream=True)

        self.assertIs(result, response)
        self.assertEqual(request.call_args.kwargs["headers"]["Accept"], "*/*")
        self.assertEqual(request.call_args.kwargs["headers"]["Authorization"], "ThemeKey secret")
        response.close.assert_not_called()

    @patch("webpages.services.theme_remote.validate_remote_url", return_value="https://remote.example/")
    @patch("webpages.services.theme_remote_credentials.decrypt_access_key", return_value="secret")
    @patch("webpages.services.theme_remote.requests.request")
    def test_object_request_returns_json_and_closes_response(self, request, _decrypt, _validate):
        response = Mock(status_code=200)
        response.json.return_value = {"object_count": 3}
        request.return_value = response

        result = remote_object_request(self.connection(), "POST", "preflight/", {"root_ids": [1]})

        self.assertEqual(result, {"object_count": 3})
        response.close.assert_called_once()

    @patch("webpages.services.theme_remote.validate_remote_url", return_value="https://remote.example/")
    @patch("webpages.services.theme_remote_credentials.decrypt_access_key", return_value="secret")
    @patch("webpages.services.theme_remote.requests.request")
    def test_object_request_uses_remote_site_key_scheme(self, request, _decrypt, _validate):
        response = Mock(status_code=200)
        response.json.return_value = {"object_types": []}
        request.return_value = response

        result = remote_object_request(self.connection("theme_key"), "POST", "catalog/")

        self.assertEqual(result, {"object_types": []})
        self.assertEqual(request.call_args.kwargs["headers"]["Authorization"], "ThemeKey secret")
