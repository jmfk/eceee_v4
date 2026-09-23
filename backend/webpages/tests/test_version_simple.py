from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from webpages.models import PageVersion, WebPage


class PageVersionCoreTest(TestCase):
    """Core tests for PageVersion functionality"""

    def setUp(self):
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
        from core.models import Tenant

        self.user = User.objects.create_superuser(username="testuser", email="test@example.com", password="testpass123")
        self.user2 = User.objects.create_user(username="testuser2", email="test2@example.com", password="testpass123")
        self.tenant, _ = Tenant.objects.get_or_create(
            identifier="default", defaults={"name": "Default Tenant", "created_by": self.user}
        )

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_draft_to_published_workflow(self):
        """Test complete draft to published workflow"""
        # Create draft
        draft = self.page.create_version(self.user, "Initial draft")
        self.assertEqual(draft.get_publication_status(), "draft")
        self.assertFalse(draft.is_current_published())

        # Publish draft
        published = draft.publish(self.user2)
        self.assertEqual(published.get_publication_status(), "published")
        self.assertTrue(published.is_current_published())
        self.assertEqual(published.page.last_modified_by, self.user2)
        self.assertIsNotNone(published.effective_date)

    def test_create_draft_from_published(self):
        """Test creating draft from published version"""
        # Create and publish version
        published = self.page.create_version(self.user, "Published version", auto_publish=True)

        # Create draft from it
        draft = published.create_draft_from_published(self.user2, "New draft")
        self.assertEqual(draft.get_publication_status(), "draft")
        self.assertEqual(draft.version_number, 2)
        self.assertEqual(draft.created_by, self.user2)

    def test_version_comparison(self):
        """Test version comparison functionality"""
        # Create first version
        v1 = self.page.create_version(self.user, "Version 1")

        # Modify page
        self.page.title = "Modified Title"
        self.page.save()

        # Create second version
        v2 = self.page.create_version(self.user, "Version 2")

        # Compare
        changes = v2.compare_with(v1)
        self.assertIn("fields_changed", changes)

        # Check title change
        title_changes = [c for c in changes["fields_changed"] if c["field"] == "title"]
        self.assertEqual(len(title_changes), 1)
        self.assertEqual(title_changes[0]["old_value"], "Test Page")
        self.assertEqual(title_changes[0]["new_value"], "Modified Title")

    def test_page_helper_methods(self):
        """Test page helper methods for version management"""
        # Initially no versions
        self.assertIsNone(self.page.get_current_published_version())
        self.assertIsNone(self.page.get_latest_version())
        self.assertFalse(self.page.has_newer_versions())

        # Create draft
        draft = self.page.create_version(self.user, "Draft")
        self.assertIsNone(self.page.get_current_published_version())
        self.assertEqual(self.page.get_latest_version(), draft)
        self.assertTrue(self.page.has_newer_versions())

        # Publish draft
        draft.publish(self.user)
        self.assertEqual(self.page.get_current_published_version(), draft)
        self.assertFalse(self.page.has_newer_versions())


class PageVersionAPISimpleTest(APITestCase):
    """Simplified API tests for PageVersion"""

    def setUp(self):
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
        from core.models import Tenant

        self.user = User.objects.create_user(username="testuser_api", email="test@example.com", password="testpass123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.tenant, _ = Tenant.objects.get_or_create(
            identifier="default", defaults={"name": "Default Tenant", "created_by": self.user}
        )

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Create test versions
        self.draft = self.page.create_version(self.user, "Draft version")
        self.published = self.page.create_version(self.user, "Published version", auto_publish=True)

    def test_list_versions_api(self):
        """Test listing versions via API"""
        url = reverse("api:pageversion-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check we have data (whether paginated or not)
        data = response.data
        if "results" in data:
            results = data["results"]
        else:
            results = data
        self.assertGreater(len(results), 0)

    def test_direct_version_creation_is_not_allowed(self):
        """Working copies must be created through the page workflow endpoint."""
        url = reverse("api:pageversion-list")
        count_before = self.page.versions.count()

        response = self.client.post(
            url,
            {
                "page": self.page.pk,
                "versionTitle": "Parallel draft",
                "pageData": {},
                "widgets": {},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(self.page.versions.count(), count_before)

    def test_publish_version_api(self):
        """Test publishing a version via API"""
        # Create new draft to publish
        new_draft = self.page.create_version(self.user, "New draft to publish")
        url = reverse("api:pageversion-publish", kwargs={"pk": new_draft.pk})

        response = self.client.post(
            url,
            {"clientUpdatedAt": new_draft.updated_at.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)

        # Verify it was published
        new_draft.refresh_from_db()
        self.assertEqual(new_draft.get_publication_status(), "published")

    def test_create_draft_api(self):
        """The legacy create-draft API reuses the canonical working copy."""
        url = reverse("api:pageversion-create-draft", kwargs={"pk": self.published.pk})
        data = {"description": "API created draft"}

        count_before = self.page.versions.count()

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["created"])
        self.assertEqual(response.data["version"]["id"], self.draft.id)
        self.assertEqual(self.page.versions.count(), count_before)

    def test_compare_versions_api(self):
        """Test version comparison via API"""
        url = reverse("api:pageversion-compare")
        params = {"version1": self.draft.pk, "version2": self.published.pk}

        response = self.client.get(url, params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check response structure
        self.assertIn("version1", response.data)
        self.assertIn("version2", response.data)
        self.assertIn("changes", response.data)

    def test_latest_version_for_page_returns_latest_draft_for_staff(self):
        """Test latest-version endpoint returns latest version without requiring publication."""
        staff_user = User.objects.create_user(
            username="staff_latest",
            email="staff-latest@example.com",
            password="testpass123",
            is_staff=True,
        )
        self.client.force_authenticate(user=staff_user)
        latest_draft = self.page.create_version(staff_user, "Latest draft")

        url = reverse("api:page-latest-version", kwargs={"page_id": self.page.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], latest_draft.id)
        self.assertEqual(response.data["publication_status"], "draft")

    def test_latest_version_for_page_does_not_create_missing_version(self):
        """Test latest-version endpoint returns 204 when a page has no versions."""
        staff_user = User.objects.create_user(
            username="staff_empty_latest",
            email="staff-empty-latest@example.com",
            password="testpass123",
            is_staff=True,
        )
        self.client.force_authenticate(user=staff_user)
        empty_page = WebPage.objects.create(
            title="Empty Page",
            slug="empty-page",
            tenant=self.tenant,
            created_by=staff_user,
            last_modified_by=staff_user,
        )

        url = reverse("api:page-latest-version", kwargs={"page_id": empty_page.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(PageVersion.objects.filter(page=empty_page).count(), 0)

    def test_restore_version_api(self):
        """Test restoring a version via API"""
        url = reverse("api:pageversion-restore", kwargs={"pk": self.draft.pk})

        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("message", response.data)


class PageVersionIntegrationSimpleTest(APITestCase):
    """Simple integration tests for version management"""

    def setUp(self):
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
        from core.models import Tenant

        self.user = User.objects.create_user(username="testuser_int", email="test@example.com", password="testpass123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.tenant, _ = Tenant.objects.get_or_create(
            identifier="default", defaults={"name": "Default Tenant", "created_by": self.user}
        )

        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_direct_page_update_rejects_version_controlled_fields(self):
        """Version-controlled fields must be saved through the working copy."""
        initial_count = PageVersion.objects.filter(page=self.page).count()
        url = reverse("api:webpage-detail", kwargs={"pk": self.page.pk})

        for field, value in {
            "title": "Updated Title",
            "description": "Updated description",
            "slug": "updated-slug",
            "path_pattern_key": "article_slug",
            "hostnames": ["changed.example.test"],
        }.items():
            with self.subTest(field=field):
                response = self.client.patch(url, {field: value}, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)
                self.assertEqual(response.data[field][0], "Change this field through the page working copy.")

        self.page.refresh_from_db()
        self.assertEqual(self.page.title, "Test Page")
        self.assertEqual(self.page.slug, "test-page")
        self.assertEqual(PageVersion.objects.filter(page=self.page).count(), initial_count)

    def test_direct_page_update_allows_structural_fields(self):
        url = reverse("api:webpage-detail", kwargs={"pk": self.page.pk})

        response = self.client.patch(url, {"sort_order": 3}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.page.refresh_from_db()
        self.assertEqual(self.page.sort_order, 3)

    def test_legacy_page_publish_action_is_gone(self):
        url = reverse("api:webpage-publish", kwargs={"pk": self.page.pk})

        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_410_GONE)

        # Check published version was created
        published = PageVersion.objects.filter(
            page=self.page,
            effective_date__isnull=False,
        ).first()
        self.assertIsNone(published)
