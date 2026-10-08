from unittest.mock import Mock, patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from webpages.layout_autodiscovery import reload_layouts
from webpages.layout_registry import layout_registry
from webpages.views.code_layout_views import CodeLayoutViewSet


class CodeLayoutViewTests(SimpleTestCase):
    @staticmethod
    def legacy_layout(name):
        layout = Mock(name=name)
        layout.to_dict.return_value = {
            "name": name,
            "description": name,
            "template_name": f"{name}.html",
            "css_classes": "",
            "slot_configuration": {"slots": []},
            "is_active": True,
            "type": "code",
        }
        return layout

    def test_code_layout_api_collapses_status_layouts_into_one_error_layout(self):
        request = APIRequestFactory().get("/api/v1/webpages/layouts/", {"source": "code"})

        response = CodeLayoutViewSet.as_view({"get": "list"})(request)
        names = [item["name"] for item in response.data["results"]]

        self.assertEqual(names.count("error_layout"), 1)
        self.assertFalse({"error_403", "error_404", "error_500", "error_503"} & set(names))

    def test_shared_error_layout_alias_resolves_to_legacy_registry_layout(self):
        legacy_layout = Mock(name="legacy_error_layout")
        with patch(
            "webpages.layout_registry.layout_registry.get_layout",
            side_effect=lambda name: legacy_layout if name == "error_404" else None,
        ) as get_layout:
            layout = CodeLayoutViewSet._get_registry_layout("error_layout")

        self.assertIs(layout, legacy_layout)
        self.assertEqual(get_layout.call_args_list[0].args, ("error_layout",))
        self.assertEqual(get_layout.call_args_list[1].args, ("error_404",))

    def test_reload_repopulates_the_code_layout_registry(self):
        reload_layouts()

        self.assertTrue(layout_registry.list_layouts(active_only=False))

    def test_shared_error_layout_detail_keeps_the_canonical_name(self):
        request = APIRequestFactory().get("/api/v1/webpages/layouts/error_layout/")
        legacy_layout = self.legacy_layout("error_404")

        with patch.object(CodeLayoutViewSet, "_get_registry_layout", return_value=legacy_layout):
            response = CodeLayoutViewSet.as_view({"get": "retrieve"})(request, pk="error_layout")

        self.assertEqual(response.data["name"], "error_layout")

    def test_choices_collapse_legacy_error_layout_names(self):
        request = APIRequestFactory().get("/api/v1/webpages/layouts/choices/")
        legacy_layouts = [self.legacy_layout(name) for name in ("error_403", "error_404", "error_500", "error_503")]

        with patch("webpages.layout_registry.layout_registry.list_layouts", return_value=legacy_layouts):
            response = CodeLayoutViewSet.as_view({"get": "choices"})(request)

        self.assertEqual(response.data, [("error_layout", "error_layout")])
