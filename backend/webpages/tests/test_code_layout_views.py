from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIRequestFactory

from webpages.layout_autodiscovery import reload_layouts
from webpages.layout_registry import layout_registry
from webpages.models import WebPage
from webpages.views.code_layout_views import CodeLayoutViewSet


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
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

    def test_code_layout_api_returns_camel_case_keys_and_collapses_status_layouts(self):
        request = APIRequestFactory().get("/api/v1/webpages/layouts/", {"source": "code"})

        response = CodeLayoutViewSet.as_view({"get": "list"})(request)
        names = [item["name"] for item in response.data["results"]]
        error_layout = next(item for item in response.data["results"] if item["name"] == "errorLayout")
        error_slots = [slot["name"] for slot in error_layout["slot_configuration"]["slots"]]

        self.assertEqual(names.count("errorLayout"), 1)
        self.assertIn("mainLayout", names)
        self.assertIn("landingPage", names)
        self.assertFalse({"main_layout", "landing_page", "error_layout"} & set(names))
        self.assertFalse({"error_403", "error_404", "error_500", "error_503"} & set(names))
        self.assertEqual(error_slots, ["visual", "message", "actions"])

    def test_effective_layout_list_is_private_tenant_scoped_and_read_only(self):
        request = APIRequestFactory().get("/api/v1/webpages/layouts/")
        request.tenant = Mock()
        default_queryset = Mock()
        default_queryset.first.return_value = None
        active_queryset = Mock()
        active_queryset.order_by.return_value.first.return_value = None

        with (
            patch(
                "webpages.models.PageTheme.objects.filter",
                side_effect=[default_queryset, active_queryset],
            ) as filter_themes,
            patch("webpages.models.PageTheme.get_default_theme") as get_default_theme,
        ):
            response = CodeLayoutViewSet.as_view({"get": "list"})(request)

        self.assertEqual(filter_themes.call_count, 2)
        get_default_theme.assert_not_called()
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertIn("X-Tenant-ID", response["Vary"])

    def test_code_layout_list_remains_publicly_cacheable(self):
        request = APIRequestFactory().get("/api/v1/webpages/layouts/", {"source": "code"})

        response = CodeLayoutViewSet.as_view({"get": "list"})(request)

        self.assertTrue(response["Cache-Control"].startswith("public,"))
        self.assertNotIn("X-Tenant-ID", response["Vary"])

    def test_shared_error_layout_alias_resolves_to_legacy_registry_layout(self):
        legacy_layout = Mock(name="legacy_error_layout")
        with patch(
            "webpages.layout_registry.layout_registry.get_layout",
            side_effect=lambda name: legacy_layout if name == "error_404" else None,
        ) as get_layout:
            layout = CodeLayoutViewSet._get_registry_layout("errorLayout")

        self.assertIs(layout, legacy_layout)
        self.assertEqual(get_layout.call_args_list[0].args, ("errorLayout",))
        self.assertEqual(get_layout.call_args_list[1].args, ("error_404",))

    def test_reload_repopulates_the_code_layout_registry(self):
        reload_layouts()

        self.assertTrue(layout_registry.list_layouts(active_only=False))
        for current, legacy in (
            ("mainLayout", "main_layout"),
            ("landingPage", "landing_page"),
            ("errorLayout", "error_layout"),
        ):
            self.assertIs(layout_registry.get_layout(current), layout_registry.get_layout(legacy))
            self.assertIs(layout_registry.get_layout_class(current), layout_registry.get_layout_class(legacy))
            self.assertTrue(layout_registry.is_registered(current))

    def test_migrated_page_key_still_resolves_legacy_code_layout(self):
        reload_layouts()
        version = SimpleNamespace(code_layout="mainLayout")
        page = SimpleNamespace(
            get_current_published_version=lambda: version,
            get_latest_version=lambda: version,
            parent=None,
        )

        self.assertIs(WebPage.get_effective_layout(page), layout_registry.get_layout("main_layout"))
        self.assertEqual(WebPage.get_layout_type(page), "code")

    def test_shared_error_layout_detail_keeps_the_canonical_name(self):
        request = APIRequestFactory().get("/api/v1/webpages/layouts/errorLayout/")
        legacy_layout = self.legacy_layout("error_404")

        with patch.object(CodeLayoutViewSet, "_get_registry_layout", return_value=legacy_layout):
            response = CodeLayoutViewSet.as_view({"get": "retrieve"})(request, pk="errorLayout")

        self.assertEqual(response.data["name"], "errorLayout")

    def test_choices_collapse_legacy_error_layout_names(self):
        request = APIRequestFactory().get("/api/v1/webpages/layouts/choices/")
        legacy_layouts = [self.legacy_layout(name) for name in ("error_403", "error_404", "error_500", "error_503")]

        with patch("webpages.layout_registry.layout_registry.list_layouts", return_value=legacy_layouts):
            response = CodeLayoutViewSet.as_view({"get": "choices"})(request)

        self.assertEqual(response.data, [("errorLayout", "errorLayout")])
