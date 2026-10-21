import copy

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from content.models import Namespace
from core.models import Tenant
from webpages.models import PageTheme, PageVersion, WebPage
from webpages.services.designer_theme import (
    DesignerDraftConflict,
    get_or_create_designer_draft,
    publish_designer_draft,
    save_designer_draft,
)
from webpages.services.theme_versions import restore_theme_version
from webpages.tests.test_theme_widgets import TYPE, TYPE_ID, working_document
from webpages.theme_widgets import empty_widget_types
from webpages.views.widget_type_views import WidgetTypeViewSet


class ThemeWidgetIntegrationTests(TestCase):
    def test_export_import_preserves_released_definitions(self):
        self.publish_first()
        import io
        import json
        import zipfile

        from django.core.files.uploadedfile import SimpleUploadedFile

        from webpages.views.page_theme_views import PageThemeViewSet

        factory = APIRequestFactory()
        request = factory.get("/themes/export/")
        request.tenant = self.tenant
        force_authenticate(request, self.user)
        exported = PageThemeViewSet.as_view({"get": "export_theme"})(request, pk=self.theme.id)
        self.assertEqual(exported.status_code, 200)
        with zipfile.ZipFile(io.BytesIO(exported.content)) as package:
            self.assertEqual(json.loads(package.read("theme.json"))["widget_types"], self.theme.widget_types)
        request = factory.post(
            "/themes/import/",
            {"theme_zip": SimpleUploadedFile("theme.zip", exported.content, content_type="application/zip")},
            format="multipart",
        )
        request.tenant = self.tenant
        force_authenticate(request, self.user)
        imported = PageThemeViewSet.as_view({"post": "import_theme"})(request)
        self.assertEqual(imported.status_code, 201, imported.data)
        self.assertEqual(PageTheme.objects.get(pk=imported.data["theme"]["id"]).widget_types, self.theme.widget_types)

    def test_predefined_object_widgets_receive_a_pinned_revision(self):
        self.publish_first()
        from object_storage.models import ObjectInstance, ObjectTypeDefinition

        namespace = Namespace.objects.create(
            name="Predefined", slug="widget-predefined", tenant=self.tenant, created_by=self.user
        )
        object_type = ObjectTypeDefinition.objects.create(
            name="predefined-widget",
            label="Predefined widget",
            plural_label="Predefined widgets",
            namespace=namespace,
            created_by=self.user,
            slot_configuration={
                "slots": [
                    {
                        "name": "main",
                        "widgetControls": [
                            {
                                "widgetType": TYPE,
                                "preCreate": True,
                                "defaultConfig": {"personName": "Alex"},
                            }
                        ],
                    }
                ]
            },
        )
        self.assertIn(TYPE, [widget.type for widget in object_type.get_allowed_widgets_for_slot("main")])
        obj = ObjectInstance.objects.create(
            object_type=object_type, tenant=self.tenant, slug="predefined", created_by=self.user
        )
        version = obj.versions.get(version_number=1)
        self.assertEqual(version.widgets["main"][0]["type_version"], 1)
        self.assertEqual(version.widgets["main"][0]["config"]["personName"], "Alex")

    def test_django_renderer_requires_and_renders_the_pinned_revision(self):
        self.publish_first()
        from webpages.renderers import WebPageRenderer

        renderer = WebPageRenderer()
        widget = {"id": "person", "type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}
        html = renderer.render_widget_json(widget, {"theme": self.theme})
        self.assertIn("<h2>Alex</h2>", html)
        self.assertIn(f'data-theme-widget="{TYPE_ID}:1"', html)
        widget.pop("type_version")
        self.assertIn("Missing widget revision", renderer.render_widget_json(widget, {"theme": self.theme}))

    def test_default_theme_switch_preserves_widget_references(self):
        self.publish_first()
        page = WebPage.objects.create(
            title="Inherited theme",
            slug="inherited",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        PageVersion.objects.create(
            page=page,
            version_number=1,
            created_by=self.user,
            widgets={"main": [{"id": "person", "type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}]},
        )
        with self.assertRaises(ValidationError):
            PageTheme.objects.create(name="Incompatible", tenant=self.tenant, created_by=self.user, is_default=True)
        self.theme.refresh_from_db()
        self.assertTrue(self.theme.is_default)
        compatible = PageTheme.objects.create(
            name="Compatible",
            tenant=self.tenant,
            created_by=self.user,
            is_default=True,
            widget_types=copy.deepcopy(self.theme.widget_types),
        )
        self.assertTrue(compatible.is_default)

    def setUp(self):
        self.user = User.objects.create_user("widget-owner")
        self.tenant = Tenant.objects.create(name="Widget tenant", identifier="widget-tenant", created_by=self.user)
        self.theme = PageTheme.objects.create(
            name="Widget theme", tenant=self.tenant, created_by=self.user, is_default=True
        )

    def publish_first(self):
        draft = get_or_create_designer_draft(self.theme, self.user)
        _, draft = save_designer_draft(
            self.theme.pk, self.tenant, self.user, {"draft_version": draft.version, "widget_types": working_document()}
        )
        self.theme.refresh_from_db()
        self.assertEqual(self.theme.widget_types, empty_widget_types())
        theme, draft = publish_designer_draft(self.theme.pk, self.tenant, self.user, draft.version)
        self.theme = theme
        return draft

    def test_draft_publish_revision_and_recovery_lifecycle(self):
        draft = self.publish_first()
        checkpoint = self.theme.versions.first()
        document = copy.deepcopy(self.theme.widget_types)
        document["items"][0]["working"] = {**document["items"][0]["releases"][0], "template": "<p>{{personName}}</p>"}
        _, draft = save_designer_draft(
            self.theme.pk, self.tenant, self.user, {"draft_version": draft.version, "widget_types": document}
        )
        with self.assertRaises(DesignerDraftConflict):
            save_designer_draft(
                self.theme.pk, self.tenant, self.user, {"draft_version": draft.version - 1, "widget_types": document}
            )
        self.theme, draft = publish_designer_draft(self.theme.pk, self.tenant, self.user, draft.version)
        self.assertEqual(len(self.theme.widget_types["items"][0]["releases"]), 2)
        restore_theme_version(self.theme, checkpoint, user=self.user)
        self.theme.refresh_from_db()
        self.assertEqual(self.theme.widget_types["items"][0]["active_version"], 1)
        self.assertEqual(len(self.theme.widget_types["items"][0]["releases"]), 2)

    def test_type_api_requires_same_tenant_and_returns_pinned_schema(self):
        self.publish_first()
        factory = APIRequestFactory()
        request = factory.get("/widget-types/", {"theme_id": self.theme.id, "type_version": 1})
        request.tenant = self.tenant
        force_authenticate(request, self.user)
        response = WidgetTypeViewSet.as_view({"get": "config_ui_schema"})(request, pk=TYPE)
        self.assertEqual(response.status_code, 200)
        self.assertIn("personName", response.data["schema"]["properties"])
        request = factory.post(
            f"/widget-types/{TYPE}/validate/?theme_id={self.theme.id}&type_version=1",
            {"widgetData": {"personName": "Alex"}},
            format="json",
        )
        request.tenant = self.tenant
        force_authenticate(request, self.user)
        validated = WidgetTypeViewSet.as_view({"post": "validate_widget_config"})(request, pk=TYPE)
        self.assertEqual(validated.status_code, 200)
        self.assertTrue(validated.data["is_valid"], validated.data)
        self.assertEqual(validated.data["validated_data"]["personName"], "Alex")
        other = Tenant.objects.create(name="Other", identifier="widget-other", created_by=self.user)
        request = factory.get("/widget-types/", {"theme_id": self.theme.id})
        request.tenant = other
        force_authenticate(request, self.user)
        self.assertEqual(WidgetTypeViewSet.as_view({"get": "retrieve"})(request, pk=TYPE).status_code, 404)

    def test_page_and_object_saves_validate_revision(self):
        self.publish_first()
        widget = {"id": "person", "type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}
        page = WebPage.objects.create(
            title="Person", slug="person", tenant=self.tenant, created_by=self.user, last_modified_by=self.user
        )
        version = PageVersion.objects.create(
            page=page, version_number=1, theme=self.theme, widgets={"main": [widget]}, created_by=self.user
        )
        version.widgets["main"][0]["type_version"] = 99
        with self.assertRaises(ValidationError):
            version.save()
        from object_storage.models import ObjectInstance, ObjectTypeDefinition, ObjectVersion

        namespace = Namespace.objects.create(
            name="Objects", slug="widget-objects", tenant=self.tenant, created_by=self.user
        )
        object_type = ObjectTypeDefinition.objects.create(
            name="widget-object",
            label="Widget object",
            plural_label="Widget objects",
            namespace=namespace,
            created_by=self.user,
        )
        obj = ObjectInstance.objects.create(
            object_type=object_type, tenant=self.tenant, slug="person", created_by=self.user
        )
        object_version = ObjectVersion.objects.create(
            object_instance=obj,
            version_number=1,
            widgets={"main": [{**widget, "type_version": 1}]},
            created_by=self.user,
        )
        object_version.widgets["main"][0]["config"] = {}
        with self.assertRaises(ValidationError):
            object_version.save()
