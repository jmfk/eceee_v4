"""Account orchestration must fail closed before generating bootstrap credentials."""

import contextlib
import importlib.util
import io
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SPEC = importlib.util.spec_from_file_location(
    "support_recipient",
    Path(__file__).resolve().parents[1] / "provision-support-recipient.py",
)
subject = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(subject)


class RecipientPreflightTests(unittest.TestCase):
    def test_missing_role_controls_stop_before_bootstrap_or_account_creation(self):
        previous = Path.cwd()
        try:
            with tempfile.TemporaryDirectory() as directory:
                (Path(directory) / "deploy").mkdir()
                with mock.patch.object(subject, "DIRECTORY", directory), mock.patch.object(
                    subject, "PRODUCTION_LOCK", str(Path(directory) / "lock")
                ), mock.patch.object(
                    subject.subprocess,
                    "run",
                    return_value=mock.Mock(returncode=1, stdout=b"", stderr=b"sensitive fixture"),
                ) as run, contextlib.redirect_stdout(
                    io.StringIO()
                ):
                    with self.assertRaisesRegex(RuntimeError, "workspace_role_controls_not_deployed"):
                        subject.provision_remote("support@example.invalid")
                    self.assertEqual(run.call_count, 1)
                self.assertFalse((Path(directory) / "deploy/.env.support-account").exists())
        finally:
            os.chdir(previous)


if __name__ == "__main__":
    unittest.main()
