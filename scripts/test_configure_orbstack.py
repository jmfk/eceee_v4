import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("configure_orbstack.py")
SPEC = importlib.util.spec_from_file_location("configure_orbstack", MODULE_PATH)
configure_orbstack = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(configure_orbstack)


class DotenvHelpersTests(unittest.TestCase):
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
        configure_orbstack.validate_registered_ports(10100, 10101)

    def test_registered_ports_reject_unregistered_overrides(self):
        with self.assertRaisesRegex(SystemExit, "machine port registry"):
            configure_orbstack.validate_registered_ports(10120, 10121)


if __name__ == "__main__":
    unittest.main()
