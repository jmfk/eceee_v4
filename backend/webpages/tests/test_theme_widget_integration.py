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

    def test_default_actions_reject_missing_releases_without_clearing_current_default(self):
        self.publish_first()
        page = WebPage.objects.create(
            title="Protected",
            slug="protected",
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
        other = PageTheme.objects.create(name="Empty", tenant=self.tenant, created_by=self.user)
        from webpages.views.page_theme_views import PageThemeViewSet

        for action, pk in [("set_default", other.pk), ("clear_default", None)]:
            request = APIRequestFactory().post("/themes/action/", {}, format="json")
            request.tenant = self.tenant
            force_authenticate(request, self.user)
            response = PageThemeViewSet.as_view({"post": action})(request, **({"pk": pk} if pk else {}))
            self.assertEqual(response.status_code, 400, response.data)
            self.theme.refresh_from_db()
            self.assertTrue(self.theme.is_default)
            self.assertIn("person", str(response.data))
        request = APIRequestFactory().patch("/themes/", {"is_active": False}, format="json")
        request.tenant = self.tenant
        force_authenticate(request, self.user)
        response = PageThemeViewSet.as_view({"patch": "partial_update"})(request, pk=self.theme.pk)
        self.assertEqual(response.status_code, 400, response.data)
        self.theme.refresh_from_db()
        self.assertTrue(self.theme.is_active)
        self.theme.is_active = False
        with self.assertRaises(ValidationError):
            self.theme.save()

    def test_new_version_theme_switch_compares_the_pages_own_pinned_release(self):
        self.publish_first()
        from webpages.theme_widgets import compile_definition

        other_document = copy.deepcopy(self.theme.widget_types)
        other_document["items"][0]["releases"][0] = compile_definition(
            {**other_document["items"][0]["releases"][0], "template": "<p>Changed {{personName}}</p>"}, TYPE_ID, 1
        )
        other = PageTheme.objects.create(
            name="Different definition",
            tenant=self.tenant,
            created_by=self.user,
            widget_types=other_document,
        )
        page = WebPage.objects.create(
            title="Pinned",
            slug="pinned",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        original = PageVersion.objects.create(
            page=page,
            version_number=1,
            theme=self.theme,
            created_by=self.user,
            widgets={"main": [{"id": "person", "type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}]},
        )
        with self.assertRaises(ValidationError):
            PageVersion.objects.create(
                page=page,
                version_number=2,
                theme=other,
                created_by=self.user,
                widgets=copy.deepcopy(original.widgets),
            )

    def test_stale_theme_writer_cannot_replace_a_released_revision(self):
        self.publish_first()
        stale = PageTheme.objects.get(pk=self.theme.pk)
        document = copy.deepcopy(self.theme.widget_types)
        document["items"][0]["working"] = {**document["items"][0]["releases"][0], "template": "<p>{{personName}}</p>"}
        from webpages.theme_widgets import publish_widget_types

        self.theme.widget_types = publish_widget_types(document, self.theme.widget_types)
        self.theme.save()
        stale.colors = {"primary": "red"}
        with self.assertRaises(ValidationError):
            stale.save()
        self.theme.refresh_from_db()
        self.assertEqual(len(self.theme.widget_types["items"][0]["releases"]), 2)

    def test_child_draft_explicit_theme_does_not_hide_published_inherited_widgets(self):
        self.publish_first()
        from datetime import timedelta

        from django.utils import timezone

        other = PageTheme.objects.create(name="Without widgets", tenant=self.tenant, created_by=self.user)
        parent = WebPage.objects.create(
            title="Parent",
            slug="parent",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        child = WebPage.objects.create(
            title="Child",
            slug="child",
            tenant=self.tenant,
            parent=parent,
            created_by=self.user,
            last_modified_by=self.user,
        )
        published_at = timezone.now() - timedelta(hours=1)
        PageVersion.objects.create(
            page=parent,
            version_number=1,
            theme=self.theme,
            created_by=self.user,
            effective_date=published_at,
        )
        PageVersion.objects.create(
            page=child,
            version_number=1,
            created_by=self.user,
            effective_date=published_at,
            widgets={"main": [{"id": "person", "type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}]},
        )
        PageVersion.objects.create(page=child, version_number=2, theme=other, created_by=self.user)
        draft = PageVersion.objects.create(page=parent, version_number=2, theme=other, created_by=self.user)
        self.assertEqual(child.get_effective_theme().pk, self.theme.pk)
        draft.effective_date = timezone.now()
        with self.assertRaises(ValidationError):
            draft.save()
        draft.refresh_from_db()
        self.assertIsNone(draft.effective_date)

    def test_embedded_objects_keep_default_theme_definitions_with_a_different_page_theme(self):
        self.publish_first()
        from unittest.mock import patch

        from easy_widgets.widgets.news_detail import NewsDetailWidget
        from object_storage.models import ObjectInstance, ObjectTypeDefinition, ObjectVersion
        from object_storage.serializers import ObjectInstanceSerializer, ObjectVersionSerializer
        from object_storage.widgets import ObjectDetailWidget
        from webpages.renderers import WebPageRenderer

        other = PageTheme.objects.create(name="Page theme", tenant=self.tenant, created_by=self.user)
        namespace = Namespace.objects.create(name="Embedded", slug="embedded", tenant=self.tenant, created_by=self.user)
        object_type = ObjectTypeDefinition.objects.create(
            name="embedded",
            label="Embedded",
            plural_label="Embedded",
            namespace=namespace,
            created_by=self.user,
        )
        obj = ObjectInstance.objects.create(
            object_type=object_type, tenant=self.tenant, slug="person", created_by=self.user
        )
        version = ObjectVersion.objects.create(
            object_instance=obj,
            version_number=2,
            created_by=self.user,
            widgets={"main": [{"id": "person", "type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}]},
        )
        obj.current_version = version
        obj.save(update_fields=["current_version"])
        for data in [ObjectInstanceSerializer(obj).data, ObjectVersionSerializer(version).data]:
            self.assertEqual(data["theme_widget_types"], self.theme.widget_types)
        context = {"theme": other, "renderer": WebPageRenderer()}
        news = NewsDetailWidget()._render_object_widgets_from_version(version, context)
        self.assertIn("<h2>Alex</h2>", news["main"][0])
        detail = ObjectDetailWidget()
        with patch.object(detail, "get_context_data", return_value={"object": obj, "published_version": version}):
            prepared = detail.prepare_template_context({}, context)
        self.assertIn("<h2>Alex</h2>", prepared["rendered_widgets"]["main"][0])
        self.assertEqual(context["theme"], other)

    def test_theme_deletion_cannot_remove_published_releases(self):
        self.publish_first()
        from webpages.views.page_theme_views import PageThemeViewSet

        request = APIRequestFactory().delete("/themes/")
        request.tenant = self.tenant
        force_authenticate(request, self.user)
        response = PageThemeViewSet.as_view({"delete": "destroy"})(request, pk=self.theme.pk)
        self.assertEqual(response.status_code, 400, response.data)
        self.theme.refresh_from_db()
        self.assertTrue(self.theme.widget_types["items"][0]["releases"])

    def test_inheriting_draft_uses_the_same_theme_in_serializer_and_model(self):
        self.publish_first()
        from datetime import timedelta

        from django.utils import timezone

        from webpages.serializers.version import PageVersionSerializer

        empty = PageTheme.objects.create(name="Live parent theme", tenant=self.tenant, created_by=self.user)
        parent = WebPage.objects.create(
            title="Draft parent",
            slug="draft-parent",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        PageVersion.objects.create(
            page=parent,
            version_number=1,
            theme=empty,
            effective_date=timezone.now() - timedelta(hours=1),
            created_by=self.user,
        )
        PageVersion.objects.create(page=parent, version_number=2, theme=self.theme, created_by=self.user)
        child = WebPage.objects.create(
            title="Draft child",
            slug="draft-child",
            tenant=self.tenant,
            parent=parent,
            created_by=self.user,
            last_modified_by=self.user,
        )
        version = PageVersion.objects.create(page=child, version_number=1, created_by=self.user)
        serializer = PageVersionSerializer(
            version,
            data={
                "widgets": {
                    "main": [{"id": "person", "type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}]
                },
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        version.refresh_from_db()
        self.assertEqual(PageVersionSerializer._get_effective_theme(version).pk, self.theme.pk)
        self.assertEqual(version.widgets["main"][0]["type_version"], 1)

    def test_scheduled_inherited_theme_uses_published_ancestors(self):
        self.publish_first()
        from datetime import timedelta

        from django.utils import timezone

        from webpages.serializers.version import PageVersionSerializer

        other = PageTheme.objects.create(name="Grandparent draft theme", tenant=self.tenant, created_by=self.user)
        grandparent = WebPage.objects.create(
            title="Grandparent",
            slug="grandparent",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        published_at = timezone.now() - timedelta(hours=1)
        PageVersion.objects.create(
            page=grandparent,
            version_number=1,
            theme=self.theme,
            effective_date=published_at,
            created_by=self.user,
        )
        PageVersion.objects.create(page=grandparent, version_number=2, theme=other, created_by=self.user)
        parent = WebPage.objects.create(
            title="Scheduled parent",
            slug="scheduled-parent",
            parent=grandparent,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        PageVersion.objects.create(
            page=parent,
            version_number=1,
            theme=self.theme,
            effective_date=published_at,
            created_by=self.user,
        )
        child = WebPage.objects.create(
            title="Scheduled child",
            slug="scheduled-child",
            parent=parent,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        widgets = {"main": [{"id": "person", "type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}]}
        PageVersion.objects.create(
            page=child,
            version_number=1,
            effective_date=published_at,
            widgets=copy.deepcopy(widgets),
            created_by=self.user,
        )
        scheduled = PageVersion.objects.create(
            page=parent,
            version_number=2,
            effective_date=timezone.now() + timedelta(days=1),
            widgets=copy.deepcopy(widgets),
            created_by=self.user,
        )
        self.assertEqual(PageVersionSerializer._get_effective_theme(scheduled).pk, self.theme.pk)
        self.assertEqual(child.get_effective_theme().pk, self.theme.pk)

    def test_staggered_schedules_validate_the_theme_at_the_descendants_activation(self):
        self.publish_first()
        from datetime import timedelta

        from django.utils import timezone

        from webpages.serializers.version import PageVersionSerializer

        other = PageTheme.objects.create(name="Earlier scheduled theme", tenant=self.tenant, created_by=self.user)
        parent = WebPage.objects.create(
            title="Schedule ancestor",
            slug="schedule-ancestor",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        now = timezone.now()
        PageVersion.objects.create(
            page=parent,
            version_number=1,
            theme=self.theme,
            effective_date=now - timedelta(days=1),
            created_by=self.user,
        )
        PageVersion.objects.create(
            page=parent,
            version_number=2,
            theme=other,
            effective_date=now + timedelta(days=1),
            created_by=self.user,
        )
        child = WebPage.objects.create(
            title="Later schedule",
            slug="later-schedule",
            parent=parent,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        with self.assertRaises(ValidationError):
            PageVersion.objects.create(
                page=child,
                version_number=1,
                effective_date=now + timedelta(days=2),
                created_by=self.user,
                widgets={"main": [{"id": "person", "type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}]},
            )
        valid = PageVersion.objects.create(
            page=child,
            version_number=1,
            effective_date=now + timedelta(days=2),
            created_by=self.user,
        )
        self.assertEqual(PageVersionSerializer._get_effective_theme(valid).pk, other.pk)

    def test_scheduled_descendant_checks_theme_changes_throughout_its_active_interval(self):
        self.publish_first()
        from datetime import timedelta

        from django.utils import timezone

        other = PageTheme.objects.create(name="Mid-interval theme", tenant=self.tenant, created_by=self.user)
        parent = WebPage.objects.create(
            title="Overlap ancestor",
            slug="overlap-ancestor",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        now = timezone.now()
        PageVersion.objects.create(
            page=parent,
            version_number=1,
            theme=self.theme,
            effective_date=now - timedelta(days=1),
            created_by=self.user,
        )
        transition = PageVersion.objects.create(
            page=parent,
            version_number=2,
            theme=other,
            effective_date=now + timedelta(days=3),
            created_by=self.user,
        )
        child = WebPage.objects.create(
            title="Overlap child",
            slug="overlap-child",
            parent=parent,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        widgets = {"main": [{"id": "person", "type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}]}
        with self.assertRaises(ValidationError):
            PageVersion.objects.create(
                page=child,
                version_number=1,
                effective_date=now + timedelta(days=2),
                expiry_date=now + timedelta(days=4),
                widgets=copy.deepcopy(widgets),
                created_by=self.user,
            )
        # A non-overlapping version remains valid.
        valid = PageVersion.objects.create(
            page=child,
            version_number=1,
            effective_date=now + timedelta(days=1),
            expiry_date=now + timedelta(days=2),
            widgets=copy.deepcopy(widgets),
            created_by=self.user,
        )
        # Moving the existing transition into its active interval is also rejected.
        transition.effective_date = now + timedelta(hours=36)
        with self.assertRaises(ValidationError):
            transition.save()
        valid.refresh_from_db()
        self.assertEqual(valid.widgets["main"][0]["type_version"], 1)

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
