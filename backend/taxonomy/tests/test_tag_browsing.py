"""Browsing remains available before classification setup is completed."""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from content.models import Namespace
from core.models import Tenant
from taxonomy.models import Tag


@override_settings(ROOT_URLCONF="config.urls")
class LegacyTagBrowsingTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username="tag-browser")
        self.tenant = Tenant.objects.create(name="Browse", identifier="tag-browse", created_by=self.owner)
        self.namespace = Namespace.objects.create(
            tenant=self.tenant, name="Editorial", slug="editorial", created_by=self.owner, is_default=True
        )
        for name, tag_type in [("Energy", "topic"), ("Energy policy", "topic"), ("Energy source", "source")]:
            Tag.objects.create(tenant=self.tenant, namespace=self.namespace, name=name, tag_type=tag_type)
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.headers = {"HTTP_X_TENANT_ID": str(self.tenant.pk)}

    def test_types_cover_all_pages_and_ignore_term_filters(self):
        response = self.client.get(
            "/api/v1/taxonomy/terms/tag_types/",
            {"namespace": "editorial", "search": "missing", "tag_type": "topic", "page_size": 1},
            **self.headers,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, ["source", "topic"])

    def test_search_and_type_filter_combine_before_pagination(self):
        response = self.client.get(
            "/api/v1/taxonomy/terms/",
            {
                "namespace": "editorial",
                "search": "energy",
                "tag_type": "topic",
                "page_size": 1,
                "ordering": "name",
                "page": 2,
            },
            **self.headers,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual([term["name"] for term in response.data["results"]], ["Energy policy"])

    def test_types_respect_namespace_tenant_and_membership(self):
        other_namespace = Namespace.objects.create(
            tenant=self.tenant, name="Other", slug="other", created_by=self.owner
        )
        Tag.objects.create(tenant=self.tenant, namespace=other_namespace, name="Other", tag_type="private")
        other_tenant = Tenant.objects.create(name="Other", identifier="other-browse", created_by=self.owner)
        other_scope = Namespace.objects.create(
            tenant=other_tenant, name="Other", slug="editorial", created_by=self.owner
        )
        Tag.objects.create(tenant=other_tenant, namespace=other_scope, name="Foreign", tag_type="foreign")
        response = self.client.get("/api/v1/taxonomy/terms/tag_types/", {"namespace": "editorial"}, **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, ["source", "topic"])
        self.client.force_authenticate(get_user_model().objects.create_user(username="outsider"))
        response = self.client.get("/api/v1/taxonomy/terms/tag_types/", **self.headers)
        self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(None)
        response = self.client.get("/api/v1/taxonomy/terms/tag_types/", **self.headers)
        self.assertIn(response.status_code, [401, 403])
