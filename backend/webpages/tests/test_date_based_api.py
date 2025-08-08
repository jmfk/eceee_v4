"""
Tests for API endpoints and serializers with date-based publishing.
Tests that serializers return correct date-based publishing information.
"""

from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

from webpages.models import WebPage, PageVersion
from webpages.serializers import WebPageDetailSerializer, PageVersionSerializer


class PageVersionSerializerTestCase(TestCase):
    """Test PageVersionSerializer with date-based publishing"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username="test_api_user", email="api@example.com"
        )

        self.test_page = WebPage.objects.create(
            title="API Test Page",
            slug="api-test-page",
            description="Testing API serialization",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.now = timezone.now()

    def test_draft_version_serialization(self):
        """Test serialization of draft version (no effective date)"""
        draft_version = self.test_page.create_version(self.user, "Draft version")

        serializer = PageVersionSerializer(draft_version)
        data = serializer.data

        self.assertIsNone(data.get("effective_date"))
        self.assertIsNone(data.get("expiry_date"))
        self.assertFalse(data.get("is_published"))
        self.assertFalse(data.get("is_current_published"))
        self.assertEqual(data.get("publication_status"), "draft")

    def test_published_version_serialization(self):
        """Test serialization of published version"""
        published_version = self.test_page.create_version(
            self.user, "Published version"
        )
        published_version.effective_date = self.now - timedelta(hours=1)
        published_version.save()

        serializer = PageVersionSerializer(published_version)
        data = serializer.data

        self.assertIsNotNone(data.get("effective_date"))
        self.assertIsNone(data.get("expiry_date"))
        self.assertTrue(data.get("is_published"))
        self.assertTrue(data.get("is_current_published"))
        self.assertEqual(data.get("publication_status"), "published")

    def test_scheduled_version_serialization(self):
        """Test serialization of scheduled version"""
        scheduled_version = self.test_page.create_version(
            self.user, "Scheduled version"
        )
        scheduled_version.effective_date = self.now + timedelta(days=1)
        scheduled_version.expiry_date = self.now + timedelta(days=7)
        scheduled_version.save()

        serializer = PageVersionSerializer(scheduled_version)
        data = serializer.data

        self.assertIsNotNone(data.get("effective_date"))
        self.assertIsNotNone(data.get("expiry_date"))
        self.assertFalse(data.get("is_published"))
        self.assertFalse(data.get("is_current_published"))
        self.assertEqual(data.get("publication_status"), "scheduled")

    def test_expired_version_serialization(self):
        """Test serialization of expired version"""
        expired_version = self.test_page.create_version(self.user, "Expired version")
        expired_version.effective_date = self.now - timedelta(days=2)
        expired_version.expiry_date = self.now - timedelta(hours=1)
        expired_version.save()

        serializer = PageVersionSerializer(expired_version)
        data = serializer.data

        self.assertIsNotNone(data.get("effective_date"))
        self.assertIsNotNone(data.get("expiry_date"))
        self.assertFalse(data.get("is_published"))
        self.assertFalse(data.get("is_current_published"))
        self.assertEqual(data.get("publication_status"), "expired")

    def test_serializer_model_consistency(self):
        """Test that serialized data matches model methods exactly"""
        # Create various version types
        versions = []

        # Draft
        draft = self.test_page.create_version(self.user, "Draft")
        versions.append(draft)

        # Published
        published = self.test_page.create_version(self.user, "Published")
        published.effective_date = self.now - timedelta(hours=1)
        published.save()
        versions.append(published)

        # Scheduled
        scheduled = self.test_page.create_version(self.user, "Scheduled")
        scheduled.effective_date = self.now + timedelta(days=1)
        scheduled.save()
        versions.append(scheduled)

        # Expired
        expired = self.test_page.create_version(self.user, "Expired")
        expired.effective_date = self.now - timedelta(days=1)
        expired.expiry_date = self.now - timedelta(hours=1)
        expired.save()
        versions.append(expired)

        # Test all versions
        for version in versions:
            serializer = PageVersionSerializer(version)
            data = serializer.data

            # Verify computed fields match model methods
            self.assertEqual(
                data["is_published"],
                version.is_published(),
                f"is_published mismatch for version {version.version_number}",
            )
            self.assertEqual(
                data["is_current_published"],
                version.is_current_published(),
                f"is_current_published mismatch for version {version.version_number}",
            )
            self.assertEqual(
                data["publication_status"],
                version.get_publication_status(),
                f"publication_status mismatch for version {version.version_number}",
            )


class WebPageDetailSerializerTestCase(TestCase):
    """Test WebPageDetailSerializer with date-based publishing"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username="test_page_api_user", email="pageapi@example.com"
        )

        self.test_page = WebPage.objects.create(
            title="Page API Test",
            slug="page-api-test",
            description="Testing page API serialization",
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_page_with_published_version(self):
        """Test page serialization when it has a published version"""
        published_version = self.test_page.create_version(
            self.user, "Published version"
        )
        published_version.effective_date = timezone.now() - timedelta(hours=1)
        published_version.save()

        serializer = WebPageDetailSerializer(self.test_page)
        data = serializer.data

        self.assertTrue(data.get("is_published"))

        current_version_data = data.get("current_published_version")
        self.assertIsNotNone(current_version_data)
        self.assertEqual(current_version_data["id"], published_version.id)
        self.assertEqual(
            current_version_data["version_number"], published_version.version_number
        )
        self.assertEqual(current_version_data["publication_status"], "published")

    def test_page_without_published_version(self):
        """Test page serialization when it has no published version"""
        # Create only a draft version
        draft_version = self.test_page.create_version(self.user, "Draft version")

        serializer = WebPageDetailSerializer(self.test_page)
        data = serializer.data

        self.assertFalse(data.get("is_published"))
        self.assertIsNone(data.get("current_published_version"))

    def test_page_with_multiple_versions(self):
        """Test page serialization with multiple versions of different types"""
        now = timezone.now()

        # Create multiple versions
        draft = self.test_page.create_version(self.user, "Draft")

        old_published = self.test_page.create_version(self.user, "Old published")
        old_published.effective_date = now - timedelta(days=2)
        old_published.save()

        current_published = self.test_page.create_version(
            self.user, "Current published"
        )
        current_published.effective_date = now - timedelta(hours=1)
        current_published.save()

        scheduled = self.test_page.create_version(self.user, "Scheduled")
        scheduled.effective_date = now + timedelta(days=1)
        scheduled.save()

        serializer = WebPageDetailSerializer(self.test_page)
        data = serializer.data

        self.assertTrue(data.get("is_published"))

        current_version_data = data.get("current_published_version")
        self.assertIsNotNone(current_version_data)
        # Should be the most recent published version
        self.assertEqual(current_version_data["id"], current_published.id)
        self.assertEqual(
            current_version_data["version_number"], current_published.version_number
        )

    def test_page_serializer_model_consistency(self):
        """Test that page serializer data matches model methods"""
        # Create a published version
        published_version = self.test_page.create_version(self.user, "Published")
        published_version.effective_date = timezone.now() - timedelta(hours=1)
        published_version.save()

        serializer = WebPageDetailSerializer(self.test_page)
        data = serializer.data

        # Verify page-level data matches model methods
        self.assertEqual(
            data["is_published"],
            self.test_page.is_published(),
            "Page is_published mismatch",
        )

        current_version = self.test_page.get_current_published_version()
        current_data = data.get("current_published_version")

        if current_version:
            self.assertIsNotNone(current_data)
            self.assertEqual(current_data["id"], current_version.id)
            self.assertEqual(
                current_data["version_number"], current_version.version_number
            )
        else:
            self.assertIsNone(current_data)


class PublicationStatusLogicTestCase(TestCase):
    """Test the publication status determination logic"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username="test_status_user", email="status@example.com"
        )

        self.test_page = WebPage.objects.create(
            title="Status Test Page",
            slug="status-test-page",
            description="Testing status logic",
            created_by=self.user,
            last_modified_by=self.user,
        )

        self.now = timezone.now()

    def test_publication_status_cases(self):
        """Test all publication status cases"""
        test_cases = [
            {
                "name": "Draft",
                "effective": None,
                "expiry": None,
                "expected": "draft",
                "expected_published": False,
            },
            {
                "name": "Future",
                "effective": self.now + timedelta(hours=1),
                "expiry": None,
                "expected": "scheduled",
                "expected_published": False,
            },
            {
                "name": "Current",
                "effective": self.now - timedelta(hours=1),
                "expiry": None,
                "expected": "published",
                "expected_published": True,
            },
            {
                "name": "Expired",
                "effective": self.now - timedelta(days=1),
                "expiry": self.now - timedelta(hours=1),
                "expected": "expired",
                "expected_published": False,
            },
            {
                "name": "Active with future expiry",
                "effective": self.now - timedelta(hours=1),
                "expiry": self.now + timedelta(days=1),
                "expected": "published",
                "expected_published": True,
            },
        ]

        for i, case in enumerate(test_cases, 1):
            with self.subTest(case=case["name"]):
                test_version = self.test_page.create_version(
                    self.user, f"Test case {i}"
                )
                test_version.effective_date = case["effective"]
                test_version.expiry_date = case["expiry"]
                test_version.save()

                status = test_version.get_publication_status()
                published = test_version.is_published()

                self.assertEqual(
                    status,
                    case["expected"],
                    f"Status mismatch for {case['name']}: got {status}, expected {case['expected']}",
                )
                self.assertEqual(
                    published,
                    case["expected_published"],
                    f"Published status mismatch for {case['name']}: got {published}, expected {case['expected_published']}",
                )
