import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

MODULE_PATH = Path(__file__).with_name("configure_orbstack.py")
SPEC = importlib.util.spec_from_file_location("configure_orbstack", MODULE_PATH)
configure_orbstack = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(configure_orbstack)


class DotenvHelpersTests(unittest.TestCase):
    def test_local_compose_services_use_project_scoped_container_names(self):
        for compose_file in ("docker-compose.dev.yml", "docker-compose.infra.yml"):
            with self.subTest(compose_file=compose_file):
                content = (configure_orbstack.ROOT / compose_file).read_text(encoding="utf-8")
                self.assertNotIn("container_name:", content)

        dev_compose = (configure_orbstack.ROOT / "docker-compose.dev.yml").read_text(encoding="utf-8")
        self.assertNotIn("http://eceee-v4-imgproxy:8080", dev_compose)
        self.assertIn("http://imgproxy:8080", dev_compose)

    def test_checkout_redis_namespace_is_unique_and_acl_compatible(self):
        self.assertEqual(
            configure_orbstack.checkout_redis_namespace(Path("/tmp/eceee_v4_2")),
            "eceee_v4:eceee_v4_2",
        )
        self.assertEqual(
            configure_orbstack.checkout_redis_namespace(Path("/tmp/ECEEE feature!")),
            "eceee_v4:eceee-feature",
        )

    def test_checkout_postgres_identity_uses_the_checkout_name(self):
        self.assertEqual(
            configure_orbstack.checkout_postgres_identity(Path("/tmp/ECEEE v4_2")),
            ("eceee_v4_2", "local_eceee_v4_2"),
        )

    def test_canonical_checkout_keeps_legacy_minio_identity(self):
        self.assertEqual(
            configure_orbstack.checkout_minio_identity(10100, Path("/tmp/eceee_v4")),
            (
                "eceee-v4",
                "eceee-media",
                "eceee-media-checkpoints",
                "eceee-v4.minio.secret-key",
            ),
        )

    def test_secondary_checkout_gets_port_scoped_minio_identity(self):
        self.assertEqual(
            configure_orbstack.checkout_minio_identity(11600, Path("/tmp/eceee_v4_2")),
            (
                "eceee-v4-11600",
                "eceee-media-11600",
                "eceee-media-checkpoints-11600",
                "eceee-v4-11600.minio.secret-key",
            ),
        )

    def test_isolated_postgres_config_is_preserved_for_this_checkout(self):
        present = {
            "POSTGRES_DB": "eceee_v4_2",
            "POSTGRES_USER": "local_eceee_v4_2",
            "POSTGRES_PASSWORD": "not-printed",
        }

        self.assertTrue(configure_orbstack.has_isolated_postgres_config(present, Path("/tmp/eceee_v4_2")))
        self.assertFalse(configure_orbstack.has_isolated_postgres_config(present, Path("/tmp/eceee_v4_3")))

    def test_support_storage_uses_registered_stable_namespace_and_checkout_scope(self):
        with tempfile.TemporaryDirectory() as directory:
            provider = Path(directory)
            (provider / "consumers").mkdir()
            record = provider / "consumers/eceee-v4.json"
            record.write_text(
                json.dumps(
                    {
                        "consumer": "eceee-v4",
                        "services": {"minio": {"support_storage": {"bucket": "w8c4m2-dev-support"}}},
                    }
                )
            )
            self.assertEqual(
                configure_orbstack.support_bucket_name(provider, 10100),
                "w8c4m2-dev-support",
            )
            self.assertEqual(
                configure_orbstack.support_bucket_name(provider, 12700),
                "w8c4m2-dev-support-12700",
            )
            record.write_text(
                json.dumps(
                    {
                        "consumer": "another-project",
                        "services": {"minio": {"support_storage": {"bucket": "w8c4m2-dev-support"}}},
                    }
                )
            )
            with self.assertRaisesRegex(SystemExit, "invalid ECEEE"):
                configure_orbstack.support_bucket_name(provider, 10100)

    def test_parse_dotenv_values_accepts_export_and_empty_values(self):
        values = configure_orbstack.parse_dotenv_values("export PRESENT=value\nEMPTY=\n# COMMENTED=ignored\n")

        self.assertEqual(values, {"PRESENT": "value", "EMPTY": ""})

    def test_replace_dotenv_values_preserves_unmanaged_lines(self):
        updated = configure_orbstack.replace_dotenv_values(
            "KEEP=original\nIMGPROXY_KEY=old\n",
            {"IMGPROXY_KEY": "new", "IMGPROXY_SALT": "salt"},
        )

        self.assertEqual(
            updated,
            "KEEP=original\nIMGPROXY_KEY=new\n\n" "# Shared OrbStack local development services\nIMGPROXY_SALT=salt\n",
        )

    def test_registered_ports_accept_the_project_assignments(self):
        configure_orbstack.validate_registered_ports(
            11600,
            11601,
            {"frontend": 11600, "backend": 11601},
        )

    def test_registered_ports_reject_unregistered_overrides(self):
        with self.assertRaisesRegex(SystemExit, "machine port registry"):
            configure_orbstack.validate_registered_ports(
                10120,
                10121,
                {"frontend": 11600, "backend": 11601},
            )

    @mock.patch.object(configure_orbstack.subprocess, "run")
    def test_checkpoint_bucket_check_passes_credentials_over_stdin(self, run):
        run.return_value = subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")

        configure_orbstack.check_minio_bucket("eceee-v4", "not-printed", "eceee-media-checkpoints")

        command = run.call_args.args[0]
        self.assertNotIn("not-printed", command)
        self.assertEqual(command[:4], ["docker", "exec", "-i", "shared-local-infrastructure-minio-1"])
        self.assertEqual(
            run.call_args.kwargs["input"],
            "eceee-v4\nnot-printed\neceee-media-checkpoints\n",
        )

    @mock.patch.object(configure_orbstack.subprocess, "run")
    def test_checkpoint_bucket_check_rejects_missing_or_unauthorized_bucket(self, run):
        run.return_value = subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr="AccessDenied")

        with self.assertRaisesRegex(SystemExit, "provider must provision"):
            configure_orbstack.check_minio_bucket("eceee-v4", "not-printed", "eceee-media-checkpoints")

    @mock.patch.object(configure_orbstack.subprocess, "run")
    def test_load_registered_ports_uses_the_checkout_path(self, run):
        run.return_value = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout=json.dumps(
                {
                    "ports": {
                        "frontend": 11600,
                        "backend": 11601,
                        "imgproxy": 11606,
                        "playwright-renderer": 11607,
                    }
                }
            ),
            stderr="",
        )

        ports = configure_orbstack.load_registered_ports(
            project_root=Path("/tmp/eceee-copy"),
            registry_script=Path(__file__),
        )

        self.assertEqual(ports["frontend"], 11600)
        command = run.call_args.args[0]
        self.assertEqual(
            command[2:5],
            ["get", "--project", str(Path("/tmp/eceee-copy").resolve())],
        )
        self.assertEqual(command[5], "--json")


if __name__ == "__main__":
    unittest.main()
