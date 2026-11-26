import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "import-slack-webhook.py"
spec = importlib.util.spec_from_file_location("slack_webhook_import", SCRIPT)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class ImportSlackWebhookTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.path = Path(self.folder.name) / ".env.slack.local"
        self.path.write_text("# fixture\nSLACK_REPORTS_WEBHOOK_URL=\nSLACK_SERVER_WEBHOOK_URL=\n")
        self.path.chmod(0o600)

    def test_import_preserves_other_destination_and_protected_mode(self):
        first = "https://hooks.slack.com/services/TEST/REPORTS/fixture"
        second = "https://hooks.slack.com/services/TEST/SERVER/fixture"
        helper.store_webhook(self.path, "reports", first)
        helper.store_webhook(self.path, "server", second)
        contents = self.path.read_text()
        self.assertIn("SLACK_REPORTS_WEBHOOK_URL=" + first, contents)
        self.assertIn("SLACK_SERVER_WEBHOOK_URL=" + second, contents)
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        self.assertEqual([p.name for p in self.path.parent.iterdir()], [self.path.name])

    def test_invalid_source_and_duplicate_destinations_fail_without_values(self):
        value = "https://hooks.slack.com/services/TEST/REPORTS/fixture"
        original = self.path.read_text()
        with self.assertRaisesRegex(helper.ImportFailure, "^clipboard_not_webhook$"):
            helper.store_webhook(self.path, "reports", "PRIVATE")
        self.assertEqual(self.path.read_text(), original)
        helper.store_webhook(self.path, "reports", value)
        with self.assertRaisesRegex(helper.ImportFailure, "^destinations_not_separate$"):
            helper.store_webhook(self.path, "server", value)

    def test_unsafe_file_is_not_modified(self):
        self.path.chmod(0o644)
        original = self.path.read_text()
        with self.assertRaisesRegex(helper.ImportFailure, "^file_not_protected$"):
            helper.store_webhook(self.path, "reports", "https://hooks.slack.com/services/TEST/REPORTS/fixture")
        self.assertEqual(self.path.read_text(), original)


if __name__ == "__main__":
    unittest.main()
