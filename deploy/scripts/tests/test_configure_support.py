"""Focused checks for production support staging without network or provider access."""

import importlib.util
import os
from pathlib import Path
import socket
import tempfile
import unittest
from unittest import mock


SPEC = importlib.util.spec_from_file_location(
    "configure_support",
    Path(__file__).resolve().parents[1] / "configure-support.py",
)
subject = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(subject)


class SupportConfigurationTests(unittest.TestCase):
    def test_plan_never_connects_to_server(self):
        with mock.patch.object(subject, "production_host", return_value="8.8.8.8"):
            with mock.patch.object(subject.subprocess, "run") as run:
                with mock.patch("sys.argv", ["configure-support.py"]):
                    subject.main()
                run.assert_not_called()

    def test_apply_requires_pinned_host_before_any_subprocess(self):
        with mock.patch.object(subject, "production_host", return_value="8.8.8.8"):
            with mock.patch.dict(os.environ, {"SUPPORT_EXPECTED_HOST": "1.1.1.1"}):
                with mock.patch.object(subject.subprocess, "run") as run:
                    with mock.patch("sys.argv", ["configure-support.py", "--apply"]):
                        with self.assertRaisesRegex(subject.SetupError, "SUPPORT_EXPECTED_HOST"):
                            subject.main()
                    run.assert_not_called()

    def test_rejects_media_identity_reuse_before_remote_work(self):
        with self.assertRaisesRegex(subject.SetupError, "must not reuse"):
            subject.support_credentials(
                "AWS_ACCESS_KEY_ID=fixture\nSUPPORT_STORAGE_ACCESS_KEY_ID=fixture\n"
                "SUPPORT_STORAGE_SECRET_ACCESS_KEY=dummy-secret\n"
            )

    def test_only_support_credentials_enter_verification_payload(self):
        credentials = subject.support_credentials(
            "AWS_ACCESS_KEY_ID=media-fixture\nAWS_SECRET_ACCESS_KEY=media-secret-fixture\n"
            "SUPPORT_STORAGE_ACCESS_KEY_ID=support-fixture\nSUPPORT_STORAGE_SECRET_ACCESS_KEY=support-secret-fixture\n"
        )
        self.assertEqual(set(credentials), {"SUPPORT_STORAGE_ACCESS_KEY_ID", "SUPPORT_STORAGE_SECRET_ACCESS_KEY"})

    def test_dns_must_agree(self):
        def resolve(domain, *_):
            address = "8.8.8.8" if domain == subject.DOMAINS[0] else "1.1.1.1"
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 22))]

        with mock.patch.object(subject.socket, "getaddrinfo", side_effect=resolve):
            with self.assertRaisesRegex(subject.SetupError, "DNS records disagree"):
                subject.production_host()

    def test_private_dns_rejected(self):
        with mock.patch.object(
            subject.socket,
            "getaddrinfo",
            return_value=[
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 22)),
            ],
        ):
            with self.assertRaisesRegex(subject.SetupError, "public IPv4"):
                subject.production_host()

    def test_env_preserves_unrelated_values_and_disables_mail(self):
        with tempfile.TemporaryDirectory() as directory:
            env = Path(directory) / ".env"
            env.write_text("# keep comment\nUNRELATED='dummy fixture'\nSUPPORT_EMAIL_ENABLED=True\n")
            env.chmod(0o600)
            _, content = subject.prepared_env(env, subject.settings_for("w8c4m2-prod-support"))
            subject.write_private(env, content)
            self.assertIn("UNRELATED='dummy fixture'", env.read_text())
            self.assertIn("SUPPORT_EMAIL_ENABLED=False", env.read_text())
            self.assertEqual(env.stat().st_mode & 0o777, 0o600)

    def test_existing_different_bucket_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            env = Path(directory) / ".env"
            env.write_text("SUPPORT_STORAGE_BUCKET_NAME=existing-private-bucket\n")
            env.chmod(0o600)
            with self.assertRaisesRegex(subject.SetupError, "separate data migration"):
                subject.prepared_env(env, subject.settings_for("w8c4m2-prod-support"))

    def test_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "target"
            target.write_text("")
            target.chmod(0o600)
            env = Path(directory) / ".env"
            env.symlink_to(target)
            with self.assertRaises(subject.SetupError):
                subject.prepared_env(env, subject.settings_for("w8c4m2-prod-support"))

    def test_provision_failure_preserves_remote_env_and_backup(self):
        previous_cwd = Path.cwd()
        try:
            with tempfile.TemporaryDirectory() as directory:
                deploy = Path(directory) / "deploy"
                deploy.mkdir()
                env = deploy / ".env"
                original = "UNRELATED=dummy-fixture\nAWS_ACCESS_KEY_ID=media-fixture\nSUPPORT_STORAGE_ACCESS_KEY_ID=fixture\nSUPPORT_STORAGE_SECRET_ACCESS_KEY=fixture\n"
                env.write_text(original)
                env.chmod(0o600)
                with mock.patch.object(subject, "PRODUCTION_LOCK", str(Path(directory) / "lock")):
                    with mock.patch.object(subject, "run_bounded", side_effect=[None, subject.SetupError("failed")]):
                        with self.assertRaises(subject.SetupError):
                            subject.stage_remote(directory, subject.settings_for("w8c4m2-prod-support"))
                self.assertEqual(env.read_text(), original)
                backups = list(deploy.glob(".env.before-support-*"))
                self.assertEqual(len(backups), 1)
                self.assertEqual(backups[0].read_text(), original)
                self.assertEqual(backups[0].stat().st_mode & 0o777, 0o600)
        finally:
            os.chdir(previous_cwd)


if __name__ == "__main__":
    unittest.main()
