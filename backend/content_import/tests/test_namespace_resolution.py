from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.test import TestCase

from content.models import Namespace
from content_import.serializers import ProcessImportSerializer
from core.models import Tenant

User = get_user_model()


class ContentImportNamespaceResolutionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="content-importer")
        self.tenant = Tenant.objects.create(
            name="Import Tenant",
            identifier="import-tenant",
            created_by=self.user,
        )
        self.other_tenant = Tenant.objects.create(
            name="Other Import Tenant",
            identifier="other-import-tenant",
            created_by=self.user,
        )
        self.default = Namespace.objects.create(
            name="Default",
            slug="default",
            tenant=self.tenant,
            is_default=True,
            created_by=self.user,
        )
        Namespace.objects.create(
            name="Default",
            slug="default",
            tenant=self.other_tenant,
            is_default=True,
            created_by=self.user,
        )
        Namespace.objects.create(
            name="Other tenant only",
            slug="other-tenant-only",
            tenant=self.other_tenant,
            created_by=self.user,
        )
        self.request = SimpleNamespace(tenant=self.tenant)

    def serializer(self, namespace):
        return ProcessImportSerializer(
            data={
                "html": "<p>Imported</p>",
                "slot_name": "main",
                "page_id": 1,
                "namespace": namespace,
                "uploaded_media_urls": [],
            },
            context={"request": self.request},
        )

    def test_default_resolves_within_the_request_tenant(self):
        self.assertEqual(Namespace.resolve("default", tenant=self.tenant), self.default)
        serializer = self.serializer("default")
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_namespace_from_another_tenant_is_rejected(self):
        serializer = self.serializer("other-tenant-only")

        self.assertFalse(serializer.is_valid())
        self.assertIn("namespace", serializer.errors)
