"""Guard the narrow production configuration reload against accidental deployment."""

import importlib.util
import json
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

    def test_subprocess_errors_do_not_return_provider_output(self):
        result = mock.Mock(returncode=1, stdout=b"sensitive fixture", stderr=b"sensitive fixture")
        with mock.patch.object(subject.subprocess, "run", return_value=result):
            with self.assertRaisesRegex(RuntimeError, "^command_failed$"):
                subject.checked(["docker", "fixture"])


if __name__ == "__main__":
    unittest.main()
