"""
Tests for Media System Models
"""

from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.utils import timezone
import uuid

from file_manager.models import (
    MediaFile,
    MediaTag,
    MediaCollection,
    MediaUsage,
)
from content.models import Namespace
from core.models import Tenant


class MediaModelTestBase(TestCase):
    """Base class for Media model tests with tenant setup"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser_media", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            identifier="test-tenant",
            created_by=self.user
        )
        # Create namespace with tenant
        self.namespace, _ = Namespace.objects.get_or_create(
            slug="test-namespace",
            defaults={
                "name": "Test Namespace",
                "is_active": True,
                "created_by": self.user,
                "tenant": self.tenant,
            },
        )


class MediaFileModelTest(MediaModelTestBase):
    """Test MediaFile model functionality"""

    def test_media_file_creation(self):
        """Test basic MediaFile creation"""
        media_file = MediaFile.objects.create(
            title="Test Image",
            slug="test-image",
            file_type="image",
            file_path="test/image.jpg",
            file_hash="fake-hash-123",
            file_size=1024000,
            file_url="https://example.com/test.jpg",
            uploaded_by=self.user,
            created_by=self.user,
            last_modified_by=self.user,
            namespace=self.namespace,
            tenant=self.tenant,
            content_type="image/jpeg"
        )

        self.assertEqual(media_file.title, "Test Image")
        self.assertEqual(media_file.slug, "test-image")
        self.assertEqual(media_file.file_type, "image")
        self.assertEqual(media_file.namespace, self.namespace)
        self.assertEqual(media_file.tenant, self.tenant)
        self.assertIsInstance(media_file.id, uuid.UUID)

    def test_media_file_str_representation(self):
        """Test MediaFile string representation"""
        media_file = MediaFile.objects.create(
            title="Test Document",
            slug="test-document",
            file_type="document",
            file_path="test/doc.pdf",
            file_hash="fake-hash-456",
            file_size=2048000,
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
            content_type="application/pdf",
            original_filename="doc.pdf"
        )

        self.assertEqual(str(media_file), "Test Document (doc.pdf)")


class MediaTagModelTest(MediaModelTestBase):
    """Test MediaTag model functionality"""

    def test_media_tag_creation(self):
        """Test basic MediaTag creation"""
        tag = MediaTag.objects.create(
            name="Nature", slug="nature", namespace=self.namespace, created_by=self.user
        )

        self.assertEqual(tag.name, "Nature")
        self.assertEqual(tag.slug, "nature")
        self.assertEqual(tag.namespace, self.namespace)
        self.assertIsInstance(tag.id, uuid.UUID)


class MediaCollectionModelTest(MediaModelTestBase):
    """Test MediaCollection model functionality"""

    def test_media_collection_creation(self):
        """Test basic MediaCollection creation"""
        collection = MediaCollection.objects.create(
            title="Summer Photos",
            slug="summer-photos",
            description="Photos from summer vacation",
            created_by=self.user,
            last_modified_by=self.user,
            namespace=self.namespace,
        )

        self.assertEqual(collection.title, "Summer Photos")
        self.assertEqual(collection.slug, "summer-photos")
        self.assertEqual(collection.namespace, self.namespace)
        self.assertIsInstance(collection.id, uuid.UUID)


class MediaUsageModelTest(MediaModelTestBase):
    """Test MediaUsage model functionality"""

    def test_media_usage_creation(self):
        """Test basic MediaUsage creation"""
        media_file = MediaFile.objects.create(
            title="Test Image",
            slug="test-image",
            file_type="image",
            file_path="test/image.jpg",
            file_hash="fake-hash-789",
            file_size=1024000,
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
            content_type="image/jpeg"
        )
        
        usage = MediaUsage.objects.create(
            media_file=media_file,
            usage_type="other",
            object_id="some-id",
            object_type="some-type",
            created_by=self.user
        )

        self.assertEqual(usage.media_file, media_file)
        self.assertEqual(usage.usage_type, "other")
        self.assertIsInstance(usage.id, uuid.UUID)
