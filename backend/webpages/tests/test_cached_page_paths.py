from django.contrib.auth.models import User
from django.test import TestCase

from core.models import Tenant
from webpages.models import WebPage


class CachedPagePathTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="cached-path-test")
        self.tenant = Tenant.objects.create(
            name="Cached Path Tenant",
            identifier="cached-path",
            created_by=self.user,
        )

    def create_page(self, title, slug, parent=None, hostnames=None):
        return WebPage.objects.create(
            title=title,
            slug=slug,
            parent=parent,
            hostnames=hostnames or [],
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
        )

    def test_hostname_backed_root_slug_is_removed_from_all_descendant_paths(self):
        root = self.create_page("Summer Study", "summerstudy")
        section = self.create_page("For authors", "for-authors", parent=root)
        page = self.create_page("Review process", "review-process", parent=section)

        self.assertEqual(page.cached_path, "/summerstudy/for-authors/review-process/")

        root.hostnames = ["summerstudy.localhost"]
        root.save()

        section.refresh_from_db()
        page.refresh_from_db()
        self.assertEqual(section.cached_path, "/for-authors/")
        self.assertEqual(page.cached_path, "/for-authors/review-process/")
        self.assertEqual(page.cached_root_hostnames, ["summerstudy.localhost"])

    def test_hostname_changes_propagate_when_root_path_stays_silent(self):
        root = self.create_page(
            "Summer Study",
            "summerstudy",
            hostnames=["old-summerstudy.localhost"],
        )
        section = self.create_page("For authors", "for-authors", parent=root)
        page = self.create_page("Review process", "review-process", parent=section)

        root.hostnames = ["summerstudy.localhost"]
        root.save()

        section.refresh_from_db()
        page.refresh_from_db()
        self.assertEqual(section.cached_path, "/for-authors/")
        self.assertEqual(page.cached_path, "/for-authors/review-process/")
        self.assertEqual(section.cached_root_hostnames, ["summerstudy.localhost"])
        self.assertEqual(page.cached_root_hostnames, ["summerstudy.localhost"])
