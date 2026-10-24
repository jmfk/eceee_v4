"""Guard the narrow production configuration reload against accidental deployment."""

import importlib.util
import json
import os
import tempfile
from pathlib import Path
import unittest
from unittest import mock


SPEC = importlib.util.spec_from_file_location(
    "activate_support",
    Path(__file__).resolve().parents[1] / "activate-support.py",
)
subject = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(subject)


class SupportActivationTests(unittest.TestCase):
    def test_mismatched_images_stop_before_service_mutation(self):
        replies = []
        for index, service in enumerate(subject.SERVICES):
            replies.extend(
                [
                    service.encode(),
                    json.dumps(
                        [{"Image": "sha256:" + str(index), "State": {"Running": True}, "Config": {"Env": []}}]
                    ).encode(),
                ]
            )
        with mock.patch.object(subject.os, "chdir"):
            with mock.patch("builtins.open", mock.mock_open()):
                with mock.patch.object(subject.fcntl, "flock"):
                    with mock.patch.object(subject, "checked", side_effect=replies) as checked:
                        with self.assertRaises(AssertionError):
                            subject.activate()
                        for call in checked.call_args_list:
                            self.assertNotIn("up", call.args[0])

    def test_staged_configuration_failure_stops_before_service_restart(self):
        replies = []
        for service in subject.SERVICES:
            replies.extend(
                [
                    service.encode(),
                    json.dumps(
                        [{"Image": "sha256:fixture", "State": {"Running": True}, "Config": {"Env": []}}]
                    ).encode(),
                ]
            )
        replies.extend([b"", RuntimeError("invalid_staged_settings")])
        previous = Path.cwd()
        try:
            with tempfile.TemporaryDirectory() as directory:
                os.chdir(directory)
                Path("deploy").mkdir()
                with mock.patch.object(subject.os, "chdir"), mock.patch(
                    "builtins.open", mock.mock_open()
                ), mock.patch.object(subject.fcntl, "flock"), mock.patch.object(
                    subject, "checked", side_effect=replies
                ) as checked:
                    with self.assertRaisesRegex(RuntimeError, "invalid_staged_settings"):
                        subject.activate()
                    commands = [call.args[0] for call in checked.call_args_list]
                    self.assertIn("run", commands[-1])
                    self.assertIn(subject.VERIFY, commands[-1])
                    self.assertFalse(any("up" in command for command in commands))
                self.assertEqual(list(Path("deploy").iterdir()), [])
        finally:
            os.chdir(previous)

    def test_subprocess_errors_do_not_return_provider_output(self):
        result = mock.Mock(returncode=1, stdout=b"sensitive fixture", stderr=b"sensitive fixture")
        with mock.patch.object(subject.subprocess, "run", return_value=result):
            with self.assertRaisesRegex(RuntimeError, "^command_failed$"):
                subject.checked(["docker", "fixture"])


if __name__ == "__main__":
    unittest.main()
