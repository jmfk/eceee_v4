import importlib.util
import os
from pathlib import Path
import stat
import tempfile
import unittest


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "eceee_api.py"
SPEC = importlib.util.spec_from_file_location("eceee_api", MODULE_PATH)
eceee_api = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(eceee_api)


class ECEEEAPIClientTest(unittest.TestCase):
    def test_build_url_accepts_supported_routes(self):
        url = eceee_api.build_url("https://dev.example/api/v1/", "webpages/pages/?search=home")

        self.assertEqual(url, "https://dev.example/api/v1/webpages/pages/?search=home")

    def test_build_url_rejects_machine_denied_routes(self):
        with self.assertRaisesRegex(ValueError, "endpoint=machine_denied"):
            eceee_api.build_url("https://dev.example/api/v1/", "core/machine-api-keys/")

    def test_env_file_requires_private_mode(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env.local"
            env_file.write_text("ECEEE_API_KEY=not-a-real-key\n", encoding="utf-8")
            os.chmod(env_file, 0o644)

            with self.assertRaisesRegex(ValueError, "env_file=mode_unsafe"):
                eceee_api.read_env_file(env_file)

    def test_profiles_do_not_fall_back_to_other_credentials(self):
        values = {"ECEEE_API_KEY": "fake-dev", "ECEEE_PROD_THEME_API_KEY": "fake-theme"}
        base, tenant, key = eceee_api.resolve_profile(values, "production")
        self.assertEqual(base, "https://app.eceee.org/api/v1/")
        self.assertEqual(tenant, "default")
        self.assertEqual(key, "ECEEE_PROD_API_KEY")
        self.assertNotIn(key, values)

    def test_dev_credentials_cannot_target_a_remote_server(self):
        with self.assertRaisesRegex(ValueError, "profile=origin_mismatch"):
            eceee_api.resolve_profile({}, "dev", base_url="https://app.eceee.org/api/v1/")

    def test_production_credentials_cannot_target_another_origin(self):
        with self.assertRaisesRegex(ValueError, "profile=origin_mismatch"):
            eceee_api.resolve_profile({}, "production", base_url="https://other.example/api/v1/")
        with self.assertRaisesRegex(ValueError, "profile=credential_mismatch"):
            eceee_api.resolve_profile({}, "dev", key_variable="ECEEE_PROD_API_KEY")

    def test_theme_profile_rejects_general_cms_routes(self):
        with self.assertRaisesRegex(ValueError, "profile=theme_only"):
            eceee_api.validate_profile_endpoint("production-themes", "webpages/pages/")
        eceee_api.validate_profile_endpoint("production-themes", "webpages/designer/themes/1/")

    def test_multipart_contains_public_form_data_and_file(self):
        with tempfile.TemporaryDirectory() as directory:
            upload = Path(directory) / "sample.txt"
            upload.write_text("file-content", encoding="utf-8")

            body, content_type = eceee_api.encode_multipart(upload, "file", [("title", "Sample")])

            self.assertIn(b'name="title"', body)
            self.assertIn(b"Sample", body)
            self.assertIn(b'filename="sample.txt"', body)
            self.assertIn(b"file-content", body)
            self.assertTrue(content_type.startswith("multipart/form-data; boundary="))

    def test_redirects_are_refused_to_protect_the_authorization_header(self):
        handler = eceee_api.NoRedirectHandler()

        redirected = handler.redirect_request(
            object(),
            object(),
            302,
            "Found",
            {},
            "https://other.example/api/v1/webpages/pages/",
        )

        self.assertIsNone(redirected)


if __name__ == "__main__":
    unittest.main()
