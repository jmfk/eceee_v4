"""Include the standalone diagnostic helper suite in the existing Python CI job."""

import importlib.util
from pathlib import Path


def load_tests(loader, tests, pattern):
    path = Path(__file__).parents[2] / "skills/eceee-diagnostics/tests/test_client.py"
    spec = importlib.util.spec_from_file_location("diagnostics_helper_tests", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return loader.loadTestsFromModule(module)
