import importlib.util
import io
import json
import os
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("diagnostic_client", Path(__file__).parents[1] / "scripts/diagnostics.py")
client = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(client)


class ClientTests(unittest.TestCase):
    def test_key_reader_requires_exact_mode_and_refuses_duplicates_and_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env.local"
            path.write_text("ECEEE_DIAGNOSTICS_DEV_API_KEY=mapi_test-placeholder\n")
            path.chmod(0o600)
            self.assertTrue(client.credential(path, client.VARIABLES["dev"]).startswith("mapi_"))
            path.chmod(0o640)
            with self.assertRaises(ValueError):
                client.credential(path, client.VARIABLES["dev"])
            path.chmod(0o600)
            path.write_text(path.read_text() * 2)
            with self.assertRaises(ValueError):
                client.credential(path, client.VARIABLES["dev"])
            link = path.with_name("link")
            link.symlink_to(path)
            with self.assertRaises(OSError):
                client.credential(link, client.VARIABLES["dev"])

    def test_redirects_never_forward_authorization(self):
        self.assertIsNone(client.NoRedirect().redirect_request(None, None, 302, "", {}, "https://elsewhere.invalid"))

    def test_error_output_never_echoes_key_or_http_body_and_does_not_retry(self):
        output = io.StringIO()
        with (
            patch.object(client, "credential", return_value="mapi_test-placeholder"),
            patch.object(
                client,
                "perform",
                side_effect=urllib.error.HTTPError("https://app.eceee.org", 403, "sensitive-message", {}, io.BytesIO(b"sensitive-body")),
            ) as request,
            patch("sys.argv", ["diagnostics.py", "sources"]),
            redirect_stderr(output),
            redirect_stdout(output),
        ):
            self.assertEqual(client.main(), 1)
        self.assertEqual(output.getvalue().strip(), "diagnostics=http_403")
        self.assertEqual(request.call_count, 1)

    def test_profiles_send_only_to_fixed_origin_and_enforce_response_limit(self):
        response = unittest.mock.MagicMock()
        response.__enter__.return_value = response
        response.read.return_value = b"{}"
        opener = unittest.mock.MagicMock()
        opener.open.return_value = response
        with patch("urllib.request.build_opener", return_value=opener):
            self.assertEqual(client.perform("production", "mapi_test-placeholder", "sources/"), {})
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, "https://app.eceee.org/api/v1/diagnostics/sources/")
        response.read.return_value = b"x" * (1024 * 1024 + 1)
        with patch("urllib.request.build_opener", return_value=opener), self.assertRaises(ValueError):
            client.perform("dev", "mapi_test-placeholder", "sources/")


if __name__ == "__main__":
    unittest.main()


class SecretPreparationTests(unittest.TestCase):
    def test_preparation_is_repeatable_preserves_other_values_and_does_not_enable(self):
        spec = importlib.util.spec_from_file_location(
            "prepare", Path(__file__).parents[3] / "deploy/scripts/prepare-diagnostics-secrets.py"
        )
        prepare = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(prepare)
        with tempfile.TemporaryDirectory() as directory:
            env = Path(directory) / ".env.local"
            key = Path(directory) / "signing.key"
            env.write_text("UNRELATED=test-fixture\n")
            env.chmod(0o600)
            prepare.prepare(env, key)
            first = env.read_text()
            prepare.prepare(env, key)
            self.assertTrue(env.read_text() == first)
            self.assertTrue("DIAGNOSTICS_ENABLED=0" in first)
            self.assertTrue("UNRELATED=test-fixture" in first)
            self.assertEqual(key.stat().st_mode & 0o777, 0o600)
            self.assertEqual(env.stat().st_mode & 0o777, 0o600)
            key.write_text("different-fixture-signing-key-00000000")
            with self.assertRaises(ValueError):
                prepare.prepare(env, key)
