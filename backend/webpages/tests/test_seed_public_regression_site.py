from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase

from core.models import Tenant
from webpages.models import PageVersion, WebPage


class SeedPublicRegressionSiteTests(TestCase):
    def test_command_is_idempotent(self):
        hostname = "public-regression.test"

        call_command("seed_public_regression_site", hostname=hostname, stdout=StringIO())

        first_versions = {
            version.page.slug: (version.pk, version.effective_date)
            for version in PageVersion.objects.select_related("page").filter(
                page__tenant__identifier="playwright-regression"
            )
        }

        call_command("seed_public_regression_site", hostname=hostname, stdout=StringIO())

        second_versions = {
            version.page.slug: (version.pk, version.effective_date)
            for version in PageVersion.objects.select_related("page").filter(
                page__tenant__identifier="playwright-regression"
            )
        }
        root = WebPage.objects.get(
            tenant__identifier="playwright-regression",
            slug="public-regression-root",
        )

        self.assertEqual(first_versions, second_versions)
        self.assertEqual(set(second_versions), {"public-regression-root", "about"})
        self.assertEqual(root.hostnames, [hostname])
        self.assertEqual(Tenant.objects.filter(identifier="playwright-regression").count(), 1)
        self.assertEqual(User.objects.filter(username="playwright_regression").count(), 1)
