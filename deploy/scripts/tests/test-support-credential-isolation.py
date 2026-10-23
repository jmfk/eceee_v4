"""Check private credential boundaries without loading or expanding an environment file."""

import unittest
from pathlib import Path

import yaml


class SupportCredentialIsolationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = Path(__file__).resolve().parents[2] / "docker-compose.prod.yml"
        cls.services = yaml.safe_load(path.read_text())["services"]

    def test_only_attachment_workers_inherit_full_environment(self):
        consumers = {name for name, service in self.services.items() if service.get("env_file")}
        self.assertEqual(consumers, {"backend", "celery-worker", "celery-beat"})
        for name, service in self.services.items():
            if name not in consumers:
                with self.subTest(service=name):
                    self.assertNotIn("SUPPORT_STORAGE_", str(service))

    def test_imgproxy_has_signing_keys_without_storage_credentials(self):
        environment = self.services["imgproxy"]["environment"]
        self.assertEqual(environment["IMGPROXY_KEY"], "${IMGPROXY_KEY}")
        self.assertEqual(environment["IMGPROXY_SALT"], "${IMGPROXY_SALT}")
        self.assertEqual(environment["IMGPROXY_USE_S3"], "false")
        self.assertFalse(any(key.startswith(("AWS_", "SUPPORT_")) for key in environment))

    def test_database_receives_its_required_settings_only(self):
        self.assertEqual(
            self.services["db"]["environment"],
            {
                "POSTGRES_DB": "${POSTGRES_DB}",
                "POSTGRES_USER": "${POSTGRES_USER:-postgres}",
                "POSTGRES_PASSWORD": "${POSTGRES_PASSWORD}",
            },
        )


if __name__ == "__main__":
    unittest.main()
