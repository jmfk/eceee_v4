from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from content.models import Namespace
from core.models import Tenant

from .models import ObjectInstance, ObjectTypeDefinition, ObjectVersion
from .widgets import ObjectDetailConfig, ObjectDetailWidget, ObjectListConfig, ObjectListWidget


class PublicObjectWidgetTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="object-widget-user")
        self.tenant = Tenant.objects.create(
            name="Object widget tenant", identifier="object-widget-tenant", created_by=self.user
        )
        self.other_tenant = Tenant.objects.create(
            name="Other object widget tenant", identifier="other-object-widget-tenant", created_by=self.user
        )
        self.namespace = Namespace.objects.create(
            name="Object widget namespace",
            slug="object-widget-namespace",
            tenant=self.tenant,
            created_by=self.user,
        )
        self.object_type = ObjectTypeDefinition.objects.create(
            name="public_widget_test",
            label="Public widget test",
            plural_label="Public widget tests",
            namespace=self.namespace,
            created_by=self.user,
        )

    def create_object(self, title, tenant, effective_date, *, widgets=None, publish_date=None):
        obj = ObjectInstance.objects.create(
            object_type=self.object_type,
            title=title,
            slug=title.lower().replace(" ", "-"),
            tenant=tenant,
            created_by=self.user,
            publish_date=publish_date,
        )
        version = ObjectVersion.objects.create(
            object_instance=obj,
            version_number=1,
            data={"summary": f"{title} summary"},
            widgets=widgets or {},
            effective_date=effective_date,
            created_by=self.user,
        )
        obj.current_version = version
        obj.save(update_fields=["current_version"])
        return obj, version

    def test_list_uses_published_version_date_and_current_tenant(self):
        now = timezone.now()
        older, _ = self.create_object(
            "Older legacy date",
            self.tenant,
            now - timedelta(days=1),
            publish_date=now,
        )
        newer, _ = self.create_object(
            "Newer published version",
            self.tenant,
            now - timedelta(hours=1),
            publish_date=now - timedelta(days=10),
        )
        self.create_object("Other tenant", self.other_tenant, now - timedelta(minutes=1))

        context = ObjectListWidget().get_context_data(
            ObjectListConfig(object_type=self.object_type.name, order_by="-publish_date"),
            {"current_page": SimpleNamespace(tenant=self.tenant)},
        )

        self.assertEqual([obj.id for obj in context["objects"]], [newer.id, older.id])

    def test_detail_id_cannot_cross_tenant_boundary(self):
        foreign_object, _ = self.create_object("Foreign object", self.other_tenant, timezone.now())

        context = ObjectDetailWidget().get_context_data(
            ObjectDetailConfig(object_id=foreign_object.id),
            {"current_page": SimpleNamespace(tenant=self.tenant)},
        )

        self.assertIsNone(context["object"])

    def test_detail_renders_widgets_from_current_published_version(self):
        now = timezone.now()
        obj, published = self.create_object(
            "Versioned object",
            self.tenant,
            now - timedelta(days=1),
            widgets={"main": [{"type": "easy_widgets.ContentWidget", "config": {"content": "Published"}}]},
        )
        scheduled = ObjectVersion.objects.create(
            object_instance=obj,
            version_number=2,
            widgets={"main": [{"type": "easy_widgets.ContentWidget", "config": {"content": "Scheduled"}}]},
            effective_date=now + timedelta(days=1),
            created_by=self.user,
        )
        obj.current_version = scheduled
        obj.save(update_fields=["current_version"])
        renderer = Mock()
        renderer.render_widget_json.return_value = "<p>Rendered</p>"
        page_context = {"current_page": SimpleNamespace(tenant=self.tenant), "renderer": renderer}

        context = ObjectDetailWidget().prepare_template_context(
            {"object_id": obj.id},
            page_context,
        )

        self.assertEqual(context["published_version"], published)
        renderer.render_widget_json.assert_called_once_with(published.widgets["main"][0], page_context)
