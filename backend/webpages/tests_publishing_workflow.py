"""
Tests for Phase 8: Publishing Workflow & Scheduling (Refactored)

Tests cover:
- Schedule endpoint for future publication
- Bulk publish and bulk schedule endpoints
- Publication status dashboard endpoint
- Management command for automated publishing (now uses service objects)
- Publishing logic and date validation
- New "Tell, Don't Ask" methods on WebPage model
- PublishingService business logic
"""

from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.management import call_command
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from datetime import timedelta
import json
from io import StringIO

from .models import WebPage, PageVersion, PageLayout, PageTheme
from .publishing import PublishingService, PublicationSchedule


class PublishingServiceTests(TestCase):
    """Test the refactored PublishingService and value objects"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.layout = PageLayout.objects.create(
            name="Test Layout", slot_configuration={"slots": []}, created_by=self.user
        )
        self.theme = PageTheme.objects.create(
            name="Test Theme", css_variables={}, created_by=self.user
        )
        self.service = PublishingService(self.user)

    def test_publication_schedule_value_object(self):
        """Test PublicationSchedule value object functionality"""
        now = timezone.now()
        future = now + timedelta(hours=1)
        past = now - timedelta(hours=1)

        # Test valid schedule
        schedule = PublicationSchedule(now, future)
        self.assertTrue(schedule.is_valid())
        self.assertTrue(schedule.is_effective_now())

        # Test invalid schedule (effective after expiry)
        with self.assertRaises(Exception):
            PublicationSchedule(future, now)

        # Test should_be_published_at logic
        schedule = PublicationSchedule(future, None)
        self.assertFalse(schedule.should_be_published_at(now))
        self.assertTrue(schedule.should_be_published_at(future + timedelta(minutes=1)))

    def test_webpage_tell_dont_ask_methods(self):
        """Test new 'Tell, Don't Ask' methods on WebPage model"""
        page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            layout=self.layout,
            theme=self.theme,
            publication_status="scheduled",
            effective_date=timezone.now() - timedelta(hours=1),
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Test should_be_published_now
        self.assertTrue(page.should_be_published_now())

        # Test publish method
        self.assertTrue(page.publish(self.user, "Test publish"))
        page.refresh_from_db()
        self.assertEqual(page.publication_status, "published")

        # Test should_be_expired_now
        page.expiry_date = timezone.now() - timedelta(hours=1)
        page.save()
        self.assertTrue(page.should_be_expired_now())

        # Test expire method
        self.assertTrue(page.expire(self.user, "Test expire"))
        page.refresh_from_db()
        self.assertEqual(page.publication_status, "expired")

    def test_publishing_service_process_scheduled_publications(self):
        """Test service object processing scheduled publications"""
        # Create scheduled page ready for publication
        page = WebPage.objects.create(
            title="Scheduled Page",
            slug="scheduled-page",
            layout=self.layout,
            theme=self.theme,
            publication_status="scheduled",
            effective_date=timezone.now() - timedelta(minutes=30),
            created_by=self.user,
            last_modified_by=self.user,
        )

        published_count, errors = self.service.process_scheduled_publications()

        self.assertEqual(published_count, 1)
        self.assertEqual(len(errors), 0)

        page.refresh_from_db()
        self.assertEqual(page.publication_status, "published")

    def test_publishing_service_process_expired_pages(self):
        """Test service object processing expired pages"""
        # Create published page that should be expired
        page = WebPage.objects.create(
            title="Expired Page",
            slug="expired-page",
            layout=self.layout,
            theme=self.theme,
            publication_status="published",
            expiry_date=timezone.now() - timedelta(minutes=30),
            created_by=self.user,
            last_modified_by=self.user,
        )

        expired_count, errors = self.service.process_expired_pages()

        self.assertEqual(expired_count, 1)
        self.assertEqual(len(errors), 0)

        page.refresh_from_db()
        self.assertEqual(page.publication_status, "expired")


class PublishingWorkflowAPITests(APITestCase):
    """Test API endpoints for publishing workflow"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.layout = PageLayout.objects.create(
            name="Test Layout", slot_configuration={"slots": []}, created_by=self.user
        )
        self.theme = PageTheme.objects.create(
            name="Test Theme", css_variables={}, created_by=self.user
        )

        # Create test pages
        self.page1 = WebPage.objects.create(
            title="Test Page 1",
            slug="test-page-1",
            layout=self.layout,
            theme=self.theme,
            publication_status="unpublished",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.page2 = WebPage.objects.create(
            title="Test Page 2",
            slug="test-page-2",
            layout=self.layout,
            theme=self.theme,
            publication_status="unpublished",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.client.force_authenticate(user=self.user)

    def test_schedule_endpoint_success(self):
        """Test scheduling a page for future publication"""
        future_date = timezone.now() + timedelta(hours=2)
        expiry_date = timezone.now() + timedelta(days=7)

        url = f"/api/v1/webpages/api/pages/{self.page1.pk}/schedule/"
        data = {
            "effective_date": future_date.isoformat(),
            "expiry_date": expiry_date.isoformat(),
        }

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Refresh page from database
        self.page1.refresh_from_db()
        self.assertEqual(self.page1.publication_status, "scheduled")
        self.assertAlmostEqual(
            self.page1.effective_date, future_date, delta=timedelta(seconds=1)
        )
        self.assertAlmostEqual(
            self.page1.expiry_date, expiry_date, delta=timedelta(seconds=1)
        )

    def test_schedule_endpoint_past_date_error(self):
        """Test scheduling with past date returns error"""
        past_date = timezone.now() - timedelta(hours=1)

        url = f"/api/v1/webpages/api/pages/{self.page1.pk}/schedule/"
        data = {"effective_date": past_date.isoformat()}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("effective_date must be in the future", response.data["error"])

    def test_schedule_endpoint_invalid_expiry_date(self):
        """Test scheduling with expiry before effective date returns error"""
        future_date = timezone.now() + timedelta(hours=2)
        earlier_date = timezone.now() + timedelta(hours=1)

        url = f"/api/v1/webpages/api/pages/{self.page1.pk}/schedule/"
        data = {
            "effective_date": future_date.isoformat(),
            "expiry_date": earlier_date.isoformat(),
        }

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            "expiry_date must be after effective_date", response.data["error"]
        )

    def test_bulk_publish_success(self):
        """Test bulk publishing multiple pages"""
        url = "/api/v1/webpages/api/pages/bulk_publish/"
        data = {"page_ids": [self.page1.pk, self.page2.pk]}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Successfully published 2 pages", response.data["message"])

        # Check pages are published
        self.page1.refresh_from_db()
        self.page2.refresh_from_db()
        self.assertEqual(self.page1.publication_status, "published")
        self.assertEqual(self.page2.publication_status, "published")
        self.assertIsNotNone(self.page1.effective_date)
        self.assertIsNotNone(self.page2.effective_date)

    def test_bulk_publish_empty_list_error(self):
        """Test bulk publish with empty page list returns error"""
        url = "/api/v1/webpages/api/pages/bulk_publish/"
        data = {"page_ids": []}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("page_ids list is required", response.data["error"])

    def test_bulk_schedule_success(self):
        """Test bulk scheduling multiple pages"""
        future_date = timezone.now() + timedelta(hours=2)

        url = "/api/v1/webpages/api/pages/bulk_schedule/"
        data = {
            "page_ids": [self.page1.pk, self.page2.pk],
            "effective_date": future_date.isoformat(),
        }

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Successfully scheduled 2 pages", response.data["message"])

        # Check pages are scheduled
        self.page1.refresh_from_db()
        self.page2.refresh_from_db()
        self.assertEqual(self.page1.publication_status, "scheduled")
        self.assertEqual(self.page2.publication_status, "scheduled")

    def test_publication_status_endpoint(self):
        """Test publication status overview endpoint"""
        # Set up pages with different statuses
        self.page1.publication_status = "published"
        self.page1.effective_date = timezone.now() - timedelta(hours=1)
        self.page1.save()

        self.page2.publication_status = "scheduled"
        self.page2.effective_date = timezone.now() + timedelta(hours=1)
        self.page2.save()

        url = "/api/v1/webpages/api/pages/publication_status/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertIn("status_counts", data)
        self.assertIn("upcoming_scheduled", data)
        self.assertIn("recently_expired", data)
        self.assertIn("total_pages", data)

        # Check status counts
        status_counts = data["status_counts"]
        self.assertEqual(status_counts["published"], 1)
        self.assertEqual(status_counts["scheduled"], 1)


class PublishingManagementCommandTests(TransactionTestCase):
    """Test the process_scheduled_publishing management command"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.layout = PageLayout.objects.create(
            name="Test Layout", slot_configuration={"slots": []}, created_by=self.user
        )

    def test_process_scheduled_publications(self):
        """Test processing pages scheduled for publication"""
        # Create a page scheduled to be published
        past_date = timezone.now() - timedelta(minutes=30)
        page = WebPage.objects.create(
            title="Scheduled Page",
            slug="scheduled-page",
            layout=self.layout,
            publication_status="scheduled",
            effective_date=past_date,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Run the command
        out = StringIO()
        call_command("process_scheduled_publishing", "--verbose", stdout=out)

        # Check page was published
        page.refresh_from_db()
        self.assertEqual(page.publication_status, "published")

        # Check command output
        output = out.getvalue()
        self.assertIn("Processed 1 pages: 1 published, 0 expired", output)

    def test_process_page_expirations(self):
        """Test processing pages that should be expired"""
        # Create a published page that should be expired
        past_date = timezone.now() - timedelta(hours=1)
        page = WebPage.objects.create(
            title="Expired Page",
            slug="expired-page",
            layout=self.layout,
            publication_status="published",
            effective_date=timezone.now() - timedelta(days=1),
            expiry_date=past_date,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Run the command
        out = StringIO()
        call_command("process_scheduled_publishing", "--verbose", stdout=out)

        # Check page was expired
        page.refresh_from_db()
        self.assertEqual(page.publication_status, "expired")

        # Check command output
        output = out.getvalue()
        self.assertIn("Processed 1 pages: 0 published, 1 expired", output)

    def test_dry_run_mode(self):
        """Test dry run mode doesn't make changes"""
        # Create a page scheduled to be published
        past_date = timezone.now() - timedelta(minutes=30)
        page = WebPage.objects.create(
            title="Scheduled Page",
            slug="scheduled-page",
            layout=self.layout,
            publication_status="scheduled",
            effective_date=past_date,
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Run the command in dry run mode
        out = StringIO()
        call_command(
            "process_scheduled_publishing", "--dry-run", "--verbose", stdout=out
        )

        # Check page status unchanged
        page.refresh_from_db()
        self.assertEqual(page.publication_status, "scheduled")

        # Check command output indicates dry run
        output = out.getvalue()
        self.assertIn("DRY RUN MODE", output)
        self.assertIn("Would publish 1 pages", output)

    def test_no_changes_needed(self):
        """Test command when no pages need processing"""
        # Create a page that doesn't need processing
        WebPage.objects.create(
            title="Normal Page",
            slug="normal-page",
            layout=self.layout,
            publication_status="unpublished",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Run the command
        out = StringIO()
        call_command("process_scheduled_publishing", "--verbose", stdout=out)

        # Check command output
        output = out.getvalue()
        self.assertIn("No pages required processing", output)


class PublishingLogicTests(TestCase):
    """Test the core publishing logic in models"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.layout = PageLayout.objects.create(
            name="Test Layout", slot_configuration={"slots": []}, created_by=self.user
        )

    def test_is_published_method_unpublished(self):
        """Test is_published method with unpublished page"""
        page = WebPage.objects.create(
            title="Unpublished Page",
            slug="unpublished",
            layout=self.layout,
            publication_status="unpublished",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertFalse(page.is_published())

    def test_is_published_method_published_current(self):
        """Test is_published method with currently published page"""
        page = WebPage.objects.create(
            title="Published Page",
            slug="published",
            layout=self.layout,
            publication_status="published",
            effective_date=timezone.now() - timedelta(hours=1),
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertTrue(page.is_published())

    def test_is_published_method_scheduled_future(self):
        """Test is_published method with page scheduled for future"""
        page = WebPage.objects.create(
            title="Future Page",
            slug="future",
            layout=self.layout,
            publication_status="published",
            effective_date=timezone.now() + timedelta(hours=1),
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertFalse(page.is_published())

    def test_is_published_method_expired(self):
        """Test is_published method with expired page"""
        page = WebPage.objects.create(
            title="Expired Page",
            slug="expired",
            layout=self.layout,
            publication_status="published",
            effective_date=timezone.now() - timedelta(days=2),
            expiry_date=timezone.now() - timedelta(hours=1),
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertFalse(page.is_published())

    def test_version_creation_on_publish(self):
        """Test that versions are created when publishing"""
        page = WebPage.objects.create(
            title="Test Page",
            slug="test",
            layout=self.layout,
            publication_status="unpublished",
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Initially no versions
        self.assertEqual(page.versions.count(), 0)

        # Create a version manually (simulating API call)
        version = page.create_version(
            self.user, "Published via API", status="published", auto_publish=True
        )

        # Check version was created
        self.assertEqual(page.versions.count(), 1)
        self.assertEqual(version.status, "published")
        self.assertTrue(version.is_current)
        self.assertIsNotNone(version.published_at)
        self.assertEqual(version.published_by, self.user)


class PublishingWorkflowIntegrationTests(APITestCase):
    """Integration tests for complete publishing workflow"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.layout = PageLayout.objects.create(
            name="Test Layout", slot_configuration={"slots": []}, created_by=self.user
        )
        self.client.force_authenticate(user=self.user)

    def test_complete_publishing_workflow(self):
        """Test complete workflow from creation to publishing to expiry"""
        # 1. Create page
        page = WebPage.objects.create(
            title="Workflow Test Page",
            slug="workflow-test",
            layout=self.layout,
            publication_status="unpublished",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.assertFalse(page.is_published())

        # 2. Schedule for publication
        future_date = timezone.now() + timedelta(minutes=5)
        expiry_date = timezone.now() + timedelta(hours=1)

        schedule_url = f"/api/v1/webpages/api/pages/{page.pk}/schedule/"
        schedule_data = {
            "effective_date": future_date.isoformat(),
            "expiry_date": expiry_date.isoformat(),
        }

        response = self.client.post(schedule_url, schedule_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        page.refresh_from_db()
        self.assertEqual(page.publication_status, "scheduled")
        self.assertFalse(page.is_published())  # Still not published

        # 3. Simulate time passing and run publishing command
        # Update the effective date to the past
        page.effective_date = timezone.now() - timedelta(minutes=5)
        page.save()

        # Run publishing command
        call_command("process_scheduled_publishing")

        page.refresh_from_db()
        self.assertEqual(page.publication_status, "published")
        self.assertTrue(page.is_published())

        # 4. Simulate expiry
        page.expiry_date = timezone.now() - timedelta(minutes=5)
        page.save()

        # Run publishing command again
        call_command("process_scheduled_publishing")

        page.refresh_from_db()
        self.assertEqual(page.publication_status, "expired")
        self.assertFalse(page.is_published())

    def test_bulk_operations_with_status_dashboard(self):
        """Test bulk operations and verify with status dashboard"""
        # Create multiple pages
        pages = []
        for i in range(3):
            page = WebPage.objects.create(
                title=f"Bulk Test Page {i}",
                slug=f"bulk-test-{i}",
                layout=self.layout,
                publication_status="unpublished",
                created_by=self.user,
                last_modified_by=self.user,
            )
            pages.append(page)

        # Check initial status
        status_url = "/api/v1/webpages/api/pages/publication_status/"
        response = self.client.get(status_url)
        initial_counts = response.data["status_counts"]

        # Bulk publish
        bulk_url = "/api/v1/webpages/api/pages/bulk_publish/"
        bulk_data = {"page_ids": [p.pk for p in pages]}

        response = self.client.post(bulk_url, bulk_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check updated status
        response = self.client.get(status_url)
        updated_counts = response.data["status_counts"]

        # Verify counts changed
        self.assertEqual(updated_counts["published"], initial_counts["published"] + 3)
        self.assertEqual(
            updated_counts["unpublished"], initial_counts["unpublished"] - 3
        )
