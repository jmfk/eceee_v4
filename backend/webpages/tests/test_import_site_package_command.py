from django.contrib.auth import get_user_model
from django.test import TestCase

from content.models import Namespace
from core.models import Tenant
from webpages.management.commands.import_site_package import Command


User = get_user_model()


class ImportSitePackageCommandTests(TestCase):
    def test_existing_default_namespace_is_not_replaced_by_import_name(self):
        user = User.objects.create_user(username="package-importer")
        tenant = Tenant.objects.create(
            name="ECEEE Production Copy",
            identifier="eceee-production-copy",
            created_by=user,
        )
        default_namespace = Namespace.objects.create(
            name="Default",
            slug="default",
            tenant=tenant,
            is_default=True,
            created_by=user,
        )

        resolved = Command().get_or_create_namespace(
            slug="eceee-production-copy",
            name="ECEEE Production Copy",
            tenant=tenant,
            user=user,
        )

        self.assertEqual(resolved, default_namespace)
        self.assertTrue(Namespace.objects.get(pk=default_namespace.pk).is_default)
        self.assertFalse(Namespace.objects.filter(slug="eceee-production-copy").exists())
