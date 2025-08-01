"""
Tests for public views with date-based publishing.
Tests that public views correctly filter and display only published content.
"""

from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import connection, reset_queries
from datetime import timedelta

from webpages.models import WebPage, PageVersion
from webpages.public_views import PublishedPageMixin


class PublishedPageMixinTestCase(TestCase):
    """Test the PublishedPageMixin queryset filtering"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username="test_public_user", email="public@example.com"
        )

        self.now = timezone.now()

        # Create test pages with different publishing states
        self._create_test_pages()

    def _create_test_pages(self):
        """Create test pages with different publishing states"""
        # 1. Published page (has published version)
        self.published_page = WebPage.objects.create(
            title="Published Page",
            slug="published-page",
            description="This page should be visible",
            created_by=self.user,
            last_modified_by=self.user,
        )

        published_version = self.published_page.create_version(
            self.user, "Published version"
        )
        published_version.effective_date = self.now - timedelta(hours=1)
        published_version.save()

        # 2. Draft page (no published version)
        self.draft_page = WebPage.objects.create(
            title="Draft Page",
            slug="draft-page",
            description="This page should not be visible",
            created_by=self.user,
            last_modified_by=self.user,
        )

        draft_version = self.draft_page.create_version(self.user, "Draft version")
        # No effective_date set

        # 3. Scheduled page (future effective date)
        self.scheduled_page = WebPage.objects.create(
            title="Scheduled Page",
            slug="scheduled-page",
            description="This page should not be visible yet",
            created_by=self.user,
            last_modified_by=self.user,
        )

        scheduled_version = self.scheduled_page.create_version(
            self.user, "Scheduled version"
        )
        scheduled_version.effective_date = self.now + timedelta(days=1)
        scheduled_version.save()

        # 4. Expired page
        self.expired_page = WebPage.objects.create(
            title="Expired Page",
            slug="expired-page",
            description="This page should no longer be visible",
            created_by=self.user,
            last_modified_by=self.user,
        )

        expired_version = self.expired_page.create_version(self.user, "Expired version")
        expired_version.effective_date = self.now - timedelta(days=2)
        expired_version.expiry_date = self.now - timedelta(hours=1)
        expired_version.save()

    def test_published_page_mixin_filtering(self):
        """Test that PublishedPageMixin correctly filters published content"""

        class TestMixin(PublishedPageMixin):
            pass

        mixin = TestMixin()
        published_pages = mixin.get_queryset()

        published_titles = [page.title for page in published_pages]

        # Only the published page should be in the queryset
        self.assertIn("Published Page", published_titles)
        self.assertNotIn("Draft Page", published_titles)
        self.assertNotIn("Scheduled Page", published_titles)
        self.assertNotIn("Expired Page", published_titles)

    def test_individual_page_publication_status(self):
        """Test individual page publication status"""
        pages = [self.published_page, self.draft_page, self.scheduled_page, self.expired_page]
        expected_statuses = [True, False, False, False]

        for page, expected in zip(pages, expected_statuses):
            with self.subTest(page=page.title):
                is_published = page.is_published()
                self.assertEqual(
                    is_published,
                    expected,
                    f"Publication status mismatch for {page.title}",
                )

    def test_current_published_version_logic(self):
        """Test current published version logic"""
        # Test published page
        current_version = self.published_page.get_current_published_version()
        self.assertIsNotNone(current_version)
        self.assertTrue(current_version.is_published())
        self.assertTrue(current_version.is_current_published())

        # Test draft page
        current_version = self.draft_page.get_current_published_version()
        self.assertIsNone(current_version)

        # Test scheduled page
        current_version = self.scheduled_page.get_current_published_version()
        self.assertIsNone(current_version)

        # Test expired page
        current_version = self.expired_page.get_current_published_version()
        self.assertIsNone(current_version)

    def test_query_performance(self):
        """Test that queryset doesn't produce excessive database queries"""

        class TestMixin(PublishedPageMixin):
            pass

        mixin = TestMixin()

        # Test the mixin queryset
        reset_queries()
        published_pages = list(mixin.get_queryset())
        num_queries = len(connection.queries)

        # Should be efficient - just a few queries
        self.assertLessEqual(
            num_queries, 5, f"Too many queries: {num_queries}. Should be efficient."
        )


class TimeBasedVersionSelectionTestCase(TestCase):
    """Test time-based version selection logic"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username="test_time_user", email="time@example.com"
        )

        self.now = timezone.now()

        # Create a page with multiple versions at different times
        self.time_test_page = WebPage.objects.create(
            title="Time Test Page",
            slug="time-test-page",
            description="Testing time-based logic",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_multiple_versions_current_selection(self):
        """Test that the correct version is selected when multiple versions exist"""
        # Version 1: Effective in past, no expiry
        v1 = self.time_test_page.create_version(self.user, "Version 1")
        v1.effective_date = self.now - timedelta(days=3)
        v1.save()

        # Version 2: Effective more recently, expires in future
        v2 = self.time_test_page.create_version(self.user, "Version 2")
        v2.effective_date = self.now - timedelta(days=1)
        v2.expiry_date = self.now + timedelta(days=1)
        v2.save()

        # Version 3: Effective in future
        v3 = self.time_test_page.create_version(self.user, "Version 3")
        v3.effective_date = self.now + timedelta(days=1)
        v3.save()

        # Test which version is current
        current = self.time_test_page.get_current_published_version()
        self.assertEqual(current, v2, "Version 2 should be the current published version")

        # Test individual version status
        self.assertTrue(v1.is_published())
        self.assertTrue(v2.is_published())
        self.assertFalse(v3.is_published())

        # Test current published status
        self.assertFalse(v1.is_current_published())
        self.assertTrue(v2.is_current_published())
        self.assertFalse(v3.is_current_published())

    def test_version_ordering_by_effective_date(self):
        """Test that versions are properly ordered by effective date for current selection"""
        # Create versions in reverse chronological order to test ordering
        v_future = self.time_test_page.create_version(self.user, "Future version")
        v_future.effective_date = self.now + timedelta(days=1)
        v_future.save()

        v_recent = self.time_test_page.create_version(self.user, "Recent version")
        v_recent.effective_date = self.now - timedelta(hours=1)
        v_recent.save()

        v_old = self.time_test_page.create_version(self.user, "Old version")
        v_old.effective_date = self.now - timedelta(days=1)
        v_old.save()

        # The recent version should be current
        current = self.time_test_page.get_current_published_version()
        self.assertEqual(current, v_recent)

    def test_expired_version_not_current(self):
        """Test that expired versions are not considered current"""
        # Current version (not expired)
        current_version = self.time_test_page.create_version(self.user, "Current")
        current_version.effective_date = self.now - timedelta(hours=2)
        current_version.save()

        # Expired version (more recent effective date but expired)
        expired_version = self.time_test_page.create_version(self.user, "Expired")
        expired_version.effective_date = self.now - timedelta(hours=1)
        expired_version.expiry_date = self.now - timedelta(minutes=30)
        expired_version.save()

        # The non-expired version should be current
        current = self.time_test_page.get_current_published_version()
        self.assertEqual(current, current_version)
        self.assertFalse(expired_version.is_current_published())


class PageAccessibilityTestCase(TestCase):
    """Test page accessibility logic in public views"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username="test_access_user", email="access@example.com"
        )

    def test_published_page_accessible(self):
        """Test that published pages are accessible"""
        page = WebPage.objects.create(
            title="Accessible Page",
            slug="accessible-page",
            description="This page should be accessible",
            created_by=self.user,
            last_modified_by=self.user,
        )

        version = page.create_version(self.user, "Published version")
        version.effective_date = timezone.now() - timedelta(hours=1)
        version.save()

        self.assertTrue(page.is_published())

    def test_draft_page_not_accessible(self):
        """Test that draft pages are not accessible"""
        page = WebPage.objects.create(
            title="Draft Page",
            slug="draft-page",
            description="This page should not be accessible",
            created_by=self.user,
            last_modified_by=self.user,
        )

        version = page.create_version(self.user, "Draft version")
        # No effective_date set

        self.assertFalse(page.is_published())

    def test_scheduled_page_not_accessible(self):
        """Test that scheduled pages are not accessible"""
        page = WebPage.objects.create(
            title="Scheduled Page",
            slug="scheduled-page",
            description="This page should not be accessible yet",
            created_by=self.user,
            last_modified_by=self.user,
        )

        version = page.create_version(self.user, "Scheduled version")
        version.effective_date = timezone.now() + timedelta(days=1)
        version.save()

        self.assertFalse(page.is_published())

    def test_expired_page_not_accessible(self):
        """Test that expired pages are not accessible"""
        page = WebPage.objects.create(
            title="Expired Page",
            slug="expired-page",
            description="This page should no longer be accessible",
            created_by=self.user,
            last_modified_by=self.user,
        )

        version = page.create_version(self.user, "Expired version")
        version.effective_date = timezone.now() - timedelta(days=1)
        version.expiry_date = timezone.now() - timedelta(hours=1)
        version.save()

        self.assertFalse(page.is_published())