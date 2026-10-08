import importlib.util
import json
import subprocess
import unittest
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).with_name("configure_orbstack.py")
SPEC = importlib.util.spec_from_file_location("configure_orbstack", MODULE_PATH)
configure_orbstack = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(configure_orbstack)


class DotenvHelpersTests(unittest.TestCase):
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

    def test_isolated_postgres_config_is_preserved_for_this_checkout(self):
        present = {
            "POSTGRES_DB": "eceee_v4_2",
            "POSTGRES_USER": "local_eceee_v4_2",
            "POSTGRES_PASSWORD": "not-printed",
        }

        self.assertTrue(
            configure_orbstack.has_isolated_postgres_config(
                present, Path("/tmp/eceee_v4_2")
            )
        )
        self.assertFalse(
            configure_orbstack.has_isolated_postgres_config(
                present, Path("/tmp/eceee_v4_3")
            )
        )

    def test_parse_dotenv_values_accepts_export_and_empty_values(self):
        values = configure_orbstack.parse_dotenv_values(
            "export PRESENT=value\nEMPTY=\n# COMMENTED=ignored\n"
        )

        self.assertEqual(values, {"PRESENT": "value", "EMPTY": ""})

    def test_replace_dotenv_values_preserves_unmanaged_lines(self):
        updated = configure_orbstack.replace_dotenv_values(
            "KEEP=original\nIMGPROXY_KEY=old\n",
            {"IMGPROXY_KEY": "new", "IMGPROXY_SALT": "salt"},
        )

        self.assertEqual(
            updated,
            "KEEP=original\nIMGPROXY_KEY=new\n\n"
            "# Shared OrbStack local development services\nIMGPROXY_SALT=salt\n",
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
