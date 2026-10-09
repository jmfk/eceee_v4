from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock

from django.contrib.auth.models import User
from django.template.loader import render_to_string
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

    def create_object(
        self,
        title,
        tenant,
        effective_date,
        *,
        object_type=None,
        parent=None,
        widgets=None,
        publish_date=None,
    ):
        obj = ObjectInstance.objects.create(
            object_type=object_type or self.object_type,
            title=title,
            slug=title.lower().replace(" ", "-"),
            tenant=tenant,
            parent=parent,
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

        self.assertNotIn("error", context, context)
        self.assertEqual([obj.id for obj in context["objects"]], [newer.id, older.id])

    def test_list_and_detail_fail_closed_without_tenant_context(self):
        list_context = ObjectListWidget().get_context_data(
            ObjectListConfig(object_type=self.object_type.name),
            {},
        )
        detail_context = ObjectDetailWidget().get_context_data(
            ObjectDetailConfig(object_type=self.object_type.name, object_slug="missing"),
            {},
        )

        self.assertEqual(list_context["objects"], [])
        self.assertEqual(list_context["error"], "Tenant context is required")
        self.assertIsNone(detail_context["object"])
        self.assertEqual(detail_context["error"], "Tenant context is required")

    def test_list_status_filters_never_include_objects_without_a_published_version(self):
        published, _ = self.create_object("Published object", self.tenant, timezone.now())
        unpublished = ObjectInstance.objects.create(
            object_type=self.object_type,
            title="Unpublished draft",
            slug="unpublished-draft",
            tenant=self.tenant,
            status="draft",
            created_by=self.user,
        )

        for status_filter in ("all", "draft"):
            with self.subTest(status_filter=status_filter):
                context = ObjectListWidget().get_context_data(
                    ObjectListConfig(object_type=self.object_type.name, status_filter=status_filter),
                    {"current_page": SimpleNamespace(tenant=self.tenant)},
                )

                self.assertNotIn("error", context, context)
                self.assertIn(published, context["objects"])
                self.assertNotIn(unpublished, context["objects"])

    def test_list_and_detail_accept_tenant_objects_using_a_legacy_null_namespace_type(self):
        legacy_type = ObjectTypeDefinition.objects.create(
            name="legacy_public_widget_test",
            label="Legacy public widget test",
            plural_label="Legacy public widget tests",
            namespace=None,
            created_by=self.user,
        )
        obj, _ = self.create_object(
            "Legacy object",
            self.tenant,
            timezone.now(),
            object_type=legacy_type,
        )
        foreign_obj, _ = self.create_object(
            "Foreign legacy object",
            self.other_tenant,
            timezone.now(),
            object_type=legacy_type,
        )
        page_context = {"current_page": SimpleNamespace(tenant=self.tenant)}

        list_context = ObjectListWidget().get_context_data(
            ObjectListConfig(object_type=legacy_type.name),
            page_context,
        )
        detail_context = ObjectDetailWidget().get_context_data(
            ObjectDetailConfig(object_type=legacy_type.name, object_slug=obj.slug),
            page_context,
        )

        self.assertNotIn("error", list_context, list_context)
        self.assertEqual(list_context["objects"], [obj])
        self.assertNotIn(foreign_obj, list_context["objects"])
        self.assertEqual(detail_context["object"], obj)

    def test_detail_id_cannot_cross_tenant_boundary(self):
        foreign_object, _ = self.create_object("Foreign object", self.other_tenant, timezone.now())

        context = ObjectDetailWidget().get_context_data(
            ObjectDetailConfig(object_id=foreign_object.id),
            {"current_page": SimpleNamespace(tenant=self.tenant)},
        )

        self.assertIsNone(context["object"])

    def test_detail_id_requires_an_active_tenant_owned_or_legacy_type(self):
        inactive_type = ObjectTypeDefinition.objects.create(
            name="inactive_public_widget_test",
            label="Inactive public widget test",
            plural_label="Inactive public widget tests",
            namespace=self.namespace,
            is_active=False,
            created_by=self.user,
        )
        inactive_object, _ = self.create_object(
            "Inactive type object",
            self.tenant,
            timezone.now(),
            object_type=inactive_type,
        )
        foreign_namespace = Namespace.objects.create(
            name="Foreign object widget namespace",
            slug="foreign-object-widget-namespace",
            tenant=self.other_tenant,
            created_by=self.user,
        )
        foreign_type = ObjectTypeDefinition.objects.create(
            name="foreign_public_widget_test",
            label="Foreign public widget test",
            plural_label="Foreign public widget tests",
            namespace=foreign_namespace,
            created_by=self.user,
        )
        foreign_type_object, _ = self.create_object(
            "Foreign type object",
            self.tenant,
            timezone.now(),
            object_type=foreign_type,
        )
        page_context = {"current_page": SimpleNamespace(tenant=self.tenant)}

        inactive_context = ObjectDetailWidget().get_context_data(
            ObjectDetailConfig(object_id=inactive_object.id),
            page_context,
        )
        foreign_context = ObjectDetailWidget().get_context_data(
            ObjectDetailConfig(object_id=foreign_type_object.id),
            page_context,
        )

        self.assertIsNone(inactive_context["object"])
        self.assertIsNone(foreign_context["object"])

    def test_detail_uses_semantic_slug_from_multi_part_path(self):
        obj, _ = self.create_object("Annual report", self.tenant, timezone.now())

        context = ObjectDetailWidget().get_context_data(
            ObjectDetailConfig(object_type=self.object_type.name),
            {
                "current_page": SimpleNamespace(tenant=self.tenant),
                "path_variables": {"year": "2026", "month": "10", "date_slug": obj.slug},
            },
        )

        self.assertEqual(context["object"], obj)

    def test_detail_uses_numeric_path_id(self):
        obj, _ = self.create_object("Numeric object", self.tenant, timezone.now())

        context = ObjectDetailWidget().get_context_data(
            ObjectDetailConfig(),
            {
                "current_page": SimpleNamespace(tenant=self.tenant),
                "path_variables": {"id": str(obj.id)},
            },
        )

        self.assertEqual(context["object"], obj)

    def test_explicit_detail_slug_wins_over_numeric_path_id(self):
        configured, _ = self.create_object("Configured object", self.tenant, timezone.now())
        routed, _ = self.create_object("Routed object", self.tenant, timezone.now())

        context = ObjectDetailWidget().get_context_data(
            ObjectDetailConfig(object_type=self.object_type.name, object_slug=configured.slug),
            {
                "current_page": SimpleNamespace(tenant=self.tenant),
                "path_variables": {"id": str(routed.id)},
            },
        )

        self.assertEqual(context["object"], configured)

    def test_detail_renders_widgets_from_current_published_version(self):
        now = timezone.now()
        obj, published = self.create_object(
            "Versioned object",
            self.tenant,
            now - timedelta(days=1),
            widgets={
                "main": [
                    {"type": "easy_widgets.ContentWidget", "config": {"content": "Published"}},
                    {
                        "type": "easy_widgets.ContentWidget",
                        "config": {"content": "Hidden", "isVisible": False},
                    },
                    {
                        "type": "easy_widgets.ContentWidget",
                        "config": {"content": "Inactive", "is_active": False},
                    },
                    {
                        "type": "easy_widgets.ContentWidget",
                        "isPublished": False,
                        "config": {"content": "Unpublished"},
                    },
                    {
                        "type": "easy_widgets.ContentWidget",
                        "publishEffectiveDate": (now + timedelta(days=2)).isoformat(),
                        "config": {"content": "Scheduled"},
                    },
                    {
                        "type": "easy_widgets.ContentWidget",
                        "publish_expire_date": (now - timedelta(days=2)).isoformat(),
                        "config": {"content": "Expired"},
                    },
                    {
                        "type": "easy_widgets.ContentWidget",
                        "publishEffectiveDate": "invalid",
                        "publishExpireDate": (now - timedelta(days=2)).isoformat(),
                        "config": {"content": "Invalid effective but expired"},
                    },
                    {
                        "type": "easy_widgets.ContentWidget",
                        "publishEffectiveDate": (now + timedelta(days=2)).isoformat(),
                        "publishExpireDate": "invalid",
                        "config": {"content": "Scheduled with invalid expiry"},
                    },
                ]
            },
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
        self.assertEqual(context["rendered_widgets"]["main"], ["<p>Rendered</p>"])
        html = render_to_string(
            "object_storage/widgets/object_detail.html",
            {**context, "current_page": page_context["current_page"]},
        )
        self.assertIn('data-widget-slot="main"', html)
        self.assertIn('data-owner-widget-type="object_storage.ObjectDetailWidget"', html)

    def test_detail_hierarchy_uses_dynamic_page_paths(self):
        now = timezone.now()
        parent, _ = self.create_object("Parent object", self.tenant, now - timedelta(days=2))
        obj, _ = self.create_object("Middle object", self.tenant, now - timedelta(days=1), parent=parent)
        child, _ = self.create_object("Child object", self.tenant, now, parent=obj)
        current_page = SimpleNamespace(tenant=self.tenant, cached_path="/objects/")

        context = ObjectDetailWidget().prepare_template_context(
            {"object_id": obj.id},
            {"current_page": current_page},
        )
        html = render_to_string(
            "object_storage/widgets/object_detail.html",
            {**context, "current_page": current_page},
        )

        self.assertIn(f'href="/objects/{parent.slug}/"', html)
        self.assertIn(f'href="/objects/{child.slug}/"', html)
