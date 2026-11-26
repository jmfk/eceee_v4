import importlib.util
import stat
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "configure-slack.py"
spec = importlib.util.spec_from_file_location("configure_slack", SCRIPT)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

HOOKS = (
    "SLACK_REPORTS_WEBHOOK_URL=https://hooks.slack.com/services/TEST/REPORTS/fixture\n"
    "SLACK_SERVER_WEBHOOK_URL=https://hooks.slack.com/services/TEST/SERVER/fixture\n"
)


class ConfigureSlackTests(unittest.TestCase):
    def test_enables_both_streams_preserves_other_settings_and_is_idempotent(self):
        original = "# keep this comment\nUNRELATED='fixture-private-value'\nSLACK_REPORTS_ENABLED=False\n"
        prepared = helper.prepared_environment(original, HOOKS)
        self.assertTrue(prepared.startswith("# keep this comment\nUNRELATED='fixture-private-value'\n"))
        self.assertIn("SLACK_REPORTS_ENABLED=True\n", prepared)
        self.assertIn("SLACK_SERVER_ERRORS_ENABLED=True\n", prepared)
        self.assertIn("SUPPORT_APP_URL=https://app.eceee.org\n", prepared)
        self.assertEqual(helper.prepared_environment(prepared, HOOKS), prepared)

    def test_rejects_duplicate_destinations_invalid_urls_and_duplicate_settings(self):
        for source in (
            HOOKS.replace("/SERVER/", "/REPORTS/"),
            HOOKS.replace("hooks.slack.com", "example.invalid"),
            HOOKS + "SLACK_REPORTS_WEBHOOK_URL=\n",
        ):
            with self.assertRaises(helper.SetupError):
                helper.prepared_environment("", source)
        with self.assertRaises(helper.SetupError):
            helper.prepared_environment("SLACK_REPORTS_ENABLED=False\nSLACK_REPORTS_ENABLED=True\n", HOOKS)

    def test_rejects_other_application_origins_and_unrequested_credential_rotation(self):
        for original in (
            "SUPPORT_APP_URL=https://another-product.example.invalid\n",
            "SLACK_REPORTS_WEBHOOK_URL=https://hooks.slack.com/services/OTHER/REPORTS/fixture\n",
        ):
            with self.assertRaises(helper.SetupError):
                helper.prepared_environment(original, HOOKS)

    def test_atomic_private_staging_and_unsafe_file_refusal(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source, target = root / ".env.slack.local", root / "deploy/.env"
            target.parent.mkdir()
            source.write_text(HOOKS)
            target.write_text("OTHER=fixture\n")
            source.chmod(0o600)
            target.chmod(0o600)
            self.assertTrue(helper.stage(source, target))
            self.assertFalse(helper.stage(source, target))
            self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o600)
            self.assertEqual(sorted(p.name for p in target.parent.iterdir()), [".env", ".slack-config.lock"])
            original = target.read_text()
            source.chmod(0o644)
            with self.assertRaises(helper.SetupError):
                helper.stage(source, target)
            self.assertEqual(target.read_text(), original)


if __name__ == "__main__":
    unittest.main()
