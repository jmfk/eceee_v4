"""Contract adapters must agree without using frozen answers as their implementation."""

import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from django.test import SimpleTestCase
from pydantic import ValidationError

from webpages.publisher_manifest import build_publisher_manifest, serialize_publisher_manifest
from webpages.widget_registry import widget_type_registry
from widget_contracts import CONTRACT_ROOT, build_render_manifest, pilot_models, render_catalog, render_metadata
from widget_contracts.models import _MODELS


class WidgetContractTests(SimpleTestCase):
    def test_catalog_covers_every_builtin_without_changing_runtime_metadata(self):
        catalog = render_catalog()
        widgets = widget_type_registry.list_widget_types(active_only=True)
        self.assertEqual({widget.type for widget in widgets}, set(catalog["widgets"]))
        for widget in widgets:
            with self.subTest(widget=widget.type):
                metadata = render_metadata(widget.type)
                self.assertEqual(widget.name, metadata["name"])
                self.assertEqual(widget.widget_css, metadata["css"])
                self.assertEqual(widget.layout_parts, metadata["layoutParts"])
                self.assertEqual(widget.css_variables, metadata["cssVariables"])
                self.assertEqual(widget.variants, metadata["variants"])
        self.assertEqual(build_publisher_manifest(), build_render_manifest())
        metadata = render_metadata("easy_widgets.HeadlineWidget")
        metadata["layoutParts"].clear()
        self.assertTrue(render_metadata("easy_widgets.HeadlineWidget")["layoutParts"])

    def test_node_manifest_matches_python_without_frontend_checkout(self):
        # Backend-only CI mounts /app, not /frontend. Checked-in file drift is
        # verified separately by the Node CLI in the publisher CI job.
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "manifest.json"
            subprocess.run(
                ["node", str(CONTRACT_ROOT / "manifest.mjs"), "--output", str(output)],
                cwd=directory,
                check=True,
                capture_output=True,
                timeout=30,
            )
            self.assertEqual(output.read_bytes(), serialize_publisher_manifest().encode("utf-8"))

    def test_python_contracts_import_with_django_explicitly_blocked(self):
        script = """
import sys
class NoDjango:
    def find_spec(self, fullname, path=None, target=None):
        if fullname == 'django' or fullname.startswith('django.'):
            raise RuntimeError('Contracts must not import Django')
sys.meta_path.insert(0, NoDjango())
sys.path.insert(0, sys.argv[1])
from widget_contracts import build_render_manifest
from widget_contracts.models import FormsConfig
assert len(build_render_manifest()['widgets']) == 25
assert FormsConfig(title='Pure Python', fields=[dict(name='n', label='N', type='text')]).title == 'Pure Python'
assert not any(name == 'django' or name.startswith('django.') for name in sys.modules)
"""
        subprocess.run([sys.executable, "-I", "-c", script, str(CONTRACT_ROOT.parent)], check=True, timeout=30)

    def test_node_model_validation_matches_pydantic_field_matrix(self):
        definitions = pilot_models()
        values = [None, False, True, 0, 1, 2, 2.5, "", "unrelated", "false", [], {}, ["x"], {"url": "example"}]
        requests = []
        expected = []
        for type_id, model_name in definitions["widgets"].items():
            base = (
                {"title": "Matrix", "fields": [{"name": "name", "label": "Name", "type": "text"}]}
                if model_name == "FormsConfig"
                else {}
            )
            for field in definitions["models"][model_name]["fields"]:
                for value in values:
                    config = {**copy.deepcopy(base), field["alias"]: value}
                    requests.append({"typeId": type_id, "configuration": config})
        # Exercise every nested FormField declaration as well as top-level fields.
        for field in definitions["models"]["FormField"]["fields"]:
            for value in values:
                nested = {"name": "name", "label": "Name", "type": "text", field["alias"]: value}
                requests.append(
                    {"typeId": "easy_widgets.FormsWidget", "configuration": {"title": "Nested", "fields": [nested]}}
                )
        for request in requests:
            model_name = definitions["widgets"][request["typeId"]]
            try:
                result = {"valid": True, "value": _MODELS[model_name](**request["configuration"]).model_dump()}
            except ValidationError as error:
                errors = error.errors()
                for item in errors:
                    item.pop("url", None)  # Diagnostic version is already covered by the frozen baseline.
                    item["loc"] = list(item["loc"])
                result = {"valid": False, "errors": errors}
            expected.append(result)
        process = subprocess.run(
            ["node", str(CONTRACT_ROOT / "evaluate.mjs")],
            input=json.dumps(requests),
            text=True,
            capture_output=True,
            check=True,
            timeout=30,
        )
        actual = json.loads(process.stdout)
        self.assertEqual(len(actual), len(expected))
        for request, left, right in zip(requests, expected, actual):
            if not right["valid"]:
                for item in right["errors"]:
                    item.pop("url", None)
            with self.subTest(type=request["typeId"], configuration=request["configuration"]):
                self.assertEqual(json.dumps(left, sort_keys=True), json.dumps(right, sort_keys=True))
