"""API and copy boundaries for published theme widget definitions."""

import copy

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from content.models import Namespace
from core.models import Tenant
from object_storage.models import ObjectTypeDefinition
from object_storage.views import ObjectTypeDefinitionViewSet
from webpages.models import PageTheme
from webpages.serializers.theme_sync import ThemeSyncSerializer
from webpages.tests.test_theme_widgets import TYPE, working_document
from webpages.theme_widgets import empty_widget_types, publish_widget_types
from webpages.views.page_theme_views import PageThemeViewSet


class ThemeWidgetWriteBoundaryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("widget-boundary-owner")
        self.tenant = Tenant.objects.create(name="Widget boundary", identifier="widget-boundary", created_by=self.user)
        self.published = publish_widget_types(working_document(), empty_widget_types())
        self.theme = PageTheme.objects.create(
            name="Widget boundary theme",
            tenant=self.tenant,
            created_by=self.user,
            is_default=True,
            widget_types=copy.deepcopy(self.published),
        )
        self.namespace = Namespace.objects.create(
            name="Widget boundary namespace", slug="widget-boundary", tenant=self.tenant, created_by=self.user
        )
        self.factory = APIRequestFactory()

    def _request(self, method, path, data, tenant=None):
        request = getattr(self.factory, method)(path, data, format="json")
        request.tenant = tenant or self.tenant
        force_authenticate(request, self.user)
        return request

    def test_object_type_api_accepts_published_default_theme_widget(self):
        slot = {
            "name": "main",
            "label": "Main",
            "widget_controls": [{"widget_type": TYPE, "label": "Person"}],
            "allowed_widgets": [TYPE],
        }
        request = self._request(
            "post",
            "/object-types/",
            {
                "name": "person_cards",
                "label": "Person cards",
                "plural_label": "Person cards",
                "namespace_id": self.namespace.pk,
                "slot_configuration": {"slots": [slot]},
            },
        )
        response = ObjectTypeDefinitionViewSet.as_view({"post": "create"})(request)
        self.assertEqual(response.status_code, 201, response.data)
        stored = ObjectTypeDefinition.objects.get(name="person_cards")
        self.assertEqual(stored.slot_configuration["slots"][0]["widget_controls"], slot["widget_controls"])
        self.assertEqual(stored.slot_configuration["slots"][0]["allowed_widgets"], [TYPE])

    def test_object_type_api_cannot_use_another_tenants_theme_widget(self):
        other = Tenant.objects.create(name="Other boundary", identifier="other-boundary", created_by=self.user)
        request = self._request(
            "post",
            "/object-types/",
            {
                "name": "foreign_cards",
                "label": "Foreign cards",
                "plural_label": "Foreign cards",
                "namespace_id": self.namespace.pk,
                "slot_configuration": {"slots": [{"name": "main", "label": "Main", "allowed_widgets": [TYPE]}]},
            },
            tenant=other,
        )
        response = ObjectTypeDefinitionViewSet.as_view({"post": "create"})(request)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(ObjectTypeDefinition.objects.filter(name="foreign_cards").exists())

    def test_ordinary_theme_api_cannot_publish_or_replace_widget_releases(self):
        changed = copy.deepcopy(self.published)
        changed["items"][0]["releases"].append(copy.deepcopy(changed["items"][0]["releases"][0]))
        changed["items"][0]["releases"][1]["version"] = 2
        changed["items"][0]["active_version"] = 2
        patch = self._request("patch", "/themes/", {"widget_types": changed})
        response = PageThemeViewSet.as_view({"patch": "partial_update"})(patch, pk=self.theme.pk)
        self.assertEqual(response.status_code, 200, response.data)
        self.theme.refresh_from_db()
        self.assertEqual(self.theme.widget_types, self.published)

        create = self._request("post", "/themes/", {"name": "Ordinary copy", "widget_types": changed})
        response = PageThemeViewSet.as_view({"post": "create"})(create)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(PageTheme.objects.get(name="Ordinary copy").widget_types, empty_widget_types())

    def test_clone_keeps_independent_copy_of_all_published_releases(self):
        cloned = self.theme.clone(new_name="Cloned widget theme")
        self.assertEqual(cloned.widget_types, self.published)
        cloned.widget_types["items"][0]["releases"][0]["template"] = "<p>Changed clone</p>"
        self.assertEqual(self.theme.widget_types, self.published)
        cloned.refresh_from_db()
        self.assertEqual(cloned.widget_types, self.published)

    def test_object_create_rejects_bad_revision_without_creating_partial_object(self):
        from object_storage.models import ObjectInstance
        from object_storage.views import ObjectInstanceViewSet

        object_type = ObjectTypeDefinition.objects.create(
            name="invalid_revision",
            label="Invalid",
            plural_label="Invalid",
            namespace=self.namespace,
            created_by=self.user,
        )
        request = self._request(
            "post",
            "/objects/",
            {
                "object_type_id": object_type.pk,
                "data": {"title": "Invalid reference"},
                "widgets": {
                    "main": [{"id": "person", "type": TYPE, "type_version": 99, "config": {"personName": "Alex"}}]
                },
            },
        )
        response = ObjectInstanceViewSet.as_view({"post": "create"})(request)
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(ObjectInstance.objects.filter(object_type=object_type).exists())

    def test_trusted_sync_accepts_definitions_but_rejects_changed_release(self):
        target = PageTheme.objects.create(name="Synced theme", tenant=self.tenant, created_by=self.user)
        serializer = ThemeSyncSerializer(target, data={"widget_types": self.published}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        target.refresh_from_db()
        self.assertEqual(target.widget_types, self.published)

        changed = copy.deepcopy(self.published)
        changed["items"][0]["releases"][0]["template"] = "<p>Changed release</p>"
        serializer = ThemeSyncSerializer(target, data={"widget_types": changed}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn("widget_types", serializer.errors)
        target.refresh_from_db()
        self.assertEqual(target.widget_types, self.published)
