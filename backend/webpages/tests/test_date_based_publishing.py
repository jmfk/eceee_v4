"""
Tests for date-based publishing system functionality.
Tests core model methods, version logic, and PublishingService operations.
"""

from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

from webpages.models import WebPage, PageVersion
from webpages.publishing import PublishingService, PublicationSchedule


class DateBasedPublishingTestCase(TestCase):
    """Test the core date-based publishing functionality"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username="test_publisher", email="test@example.com"
        )

        self.test_page = WebPage.objects.create(
            title="Test Date Publishing Page",
            slug="test-date-publishing",
            description="Testing the new date-based publishing system",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_scheduled_version_not_published(self):
        """Test that versions with future effective dates are not published"""
        future_date = timezone.now() + timedelta(days=1)

        scheduled_version = self.test_page.create_version(
            self.user, "Scheduled version for future publishing", status="draft"
        )
        scheduled_version.effective_date = future_date
        scheduled_version.save()

        # Assertions
        self.assertFalse(scheduled_version.is_published())
        self.assertEqual(scheduled_version.get_publication_status(), "scheduled")
        self.assertFalse(scheduled_version.is_current_published())
        self.assertFalse(self.test_page.is_published())

    def test_current_published_version(self):
        """Test that versions with past effective dates are published"""
        past_date = timezone.now() - timedelta(hours=1)

        published_version = self.test_page.create_version(
            self.user, "Currently published version", status="draft"
        )
        published_version.effective_date = past_date
        published_version.save()

        # Assertions
        self.assertTrue(published_version.is_published())
        self.assertEqual(published_version.get_publication_status(), "published")
        self.assertTrue(published_version.is_current_published())
        self.assertTrue(self.test_page.is_published())

        current_version = self.test_page.get_current_published_version()
        self.assertEqual(current_version, published_version)

    def test_expired_version_not_published(self):
        """Test that versions with past expiry dates are not published"""
        past_effective = timezone.now() - timedelta(days=2)
        past_expiry = timezone.now() - timedelta(hours=1)

        expired_version = self.test_page.create_version(
            self.user, "Expired version", status="draft"
        )
        expired_version.effective_date = past_effective
        expired_version.expiry_date = past_expiry
        expired_version.save()

        # Assertions
        self.assertFalse(expired_version.is_published())
        self.assertEqual(expired_version.get_publication_status(), "expired")
        self.assertFalse(expired_version.is_current_published())

    def test_draft_version_not_published(self):
        """Test that versions without effective dates are drafts"""
        draft_version = self.test_page.create_version(
            self.user, "Draft version", status="draft"
        )

        # Assertions
        self.assertFalse(draft_version.is_published())
        self.assertEqual(draft_version.get_publication_status(), "draft")
        self.assertFalse(draft_version.is_current_published())

    def test_multiple_versions_current_selection(self):
        """Test that the latest published version is selected as current"""
        now = timezone.now()

        # Create multiple versions
        v1 = self.test_page.create_version(self.user, "Version 1")
        v1.effective_date = now - timedelta(days=3)
        v1.save()

        v2 = self.test_page.create_version(self.user, "Version 2")
        v2.effective_date = now - timedelta(days=1)
        v2.expiry_date = now + timedelta(days=1)
        v2.save()

        v3 = self.test_page.create_version(self.user, "Version 3")
        v3.effective_date = now + timedelta(days=1)
        v3.save()

        # Test which version is current
        current = self.test_page.get_current_published_version()
        self.assertEqual(current, v2)

        self.assertTrue(v1.is_published())
        self.assertTrue(v2.is_published())
        self.assertFalse(v3.is_published())

        self.assertFalse(v1.is_current_published())
        self.assertTrue(v2.is_current_published())
        self.assertFalse(v3.is_current_published())


class PublishingServiceTestCase(TestCase):
    """Test PublishingService bulk operations"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username="test_service_user", email="service@example.com"
        )

        self.test_page = WebPage.objects.create(
            title="Service Test Page",
            slug="service-test-page",
            description="Testing publishing service",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.service = PublishingService(self.user)

    def test_bulk_publish_pages(self):
        """Test bulk publishing sets effective dates correctly"""
        result_count, errors = self.service.bulk_publish_pages(
            [self.test_page.id], "Bulk publish test"
        )

        self.assertEqual(result_count, 1)
        self.assertEqual(len(errors), 0)

        # Check that page is now published
        self.test_page.refresh_from_db()
        self.assertTrue(self.test_page.is_published())

        # Check that latest version has effective date set
        latest_version = self.test_page.versions.order_by("-version_number").first()
        self.assertIsNotNone(latest_version.effective_date)
        self.assertTrue(latest_version.is_published())

    def test_bulk_schedule_pages(self):
        """Test bulk scheduling sets dates correctly"""
        future_schedule = PublicationSchedule(
            effective_date=timezone.now() + timedelta(days=1),
            expiry_date=timezone.now() + timedelta(days=7),
        )

        schedule_count, schedule_errors = self.service.bulk_schedule_pages(
            [self.test_page.id], future_schedule, "Bulk schedule test"
        )

        self.assertEqual(schedule_count, 1)
        self.assertEqual(len(schedule_errors), 0)

        # Check that latest version has scheduled dates
        latest_version = self.test_page.versions.order_by("-version_number").first()
        self.assertEqual(latest_version.effective_date, future_schedule.effective_date)
        self.assertEqual(latest_version.expiry_date, future_schedule.expiry_date)
        self.assertEqual(latest_version.get_publication_status(), "scheduled")

    def test_invalid_schedule_rejected(self):
        """Test that invalid schedules are rejected"""
        invalid_schedule = PublicationSchedule(
            effective_date=timezone.now() + timedelta(days=7),
            expiry_date=timezone.now() + timedelta(days=1),  # Before effective date
        )

        self.assertFalse(invalid_schedule.is_valid())

        schedule_count, schedule_errors = self.service.bulk_schedule_pages(
            [self.test_page.id], invalid_schedule, "Invalid schedule test"
        )

        self.assertEqual(schedule_count, 0)
        self.assertGreater(len(schedule_errors), 0)


class PublicationScheduleTestCase(TestCase):
    """Test the PublicationSchedule value object"""

    def test_valid_schedule(self):
        """Test valid schedule creation"""
        now = timezone.now()
        schedule = PublicationSchedule(
            effective_date=now, expiry_date=now + timedelta(days=1)
        )

        self.assertTrue(schedule.is_valid())

    def test_invalid_schedule_effective_after_expiry(self):
        """Test invalid schedule where effective date is after expiry"""
        now = timezone.now()
        schedule = PublicationSchedule(
            effective_date=now + timedelta(days=1), expiry_date=now
        )

        self.assertFalse(schedule.is_valid())

    def test_valid_schedule_no_expiry(self):
        """Test valid schedule with no expiry date"""
        schedule = PublicationSchedule(
            effective_date=timezone.now(), expiry_date=None
        )

        self.assertTrue(schedule.is_valid())

    def test_valid_schedule_no_effective_date(self):
        """Test valid schedule with no effective date (draft)"""
        schedule = PublicationSchedule(
            effective_date=None, expiry_date=timezone.now() + timedelta(days=1)
        )

        self.assertTrue(schedule.is_valid())