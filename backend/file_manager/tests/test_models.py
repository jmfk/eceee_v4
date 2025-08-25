"""
Tests for Media System Models

Tests cover:
- MediaFile model validation and methods
- MediaTag model functionality
- MediaCollection model operations

- MediaUsage tracking
- Model relationships and constraints
- Namespace integration
"""

from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from decimal import Decimal
import uuid

from file_manager.models import (
    MediaFile,
    MediaTag,
    MediaCollection,
    MediaUsage,
)
from content.models import Namespace
from webpages.models import WebPage


class MediaFileModelTest(TestCase):
    """Test MediaFile model functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace, _ = Namespace.objects.get_or_create(
            slug="test-namespace",
            defaults={
                "name": "Test Namespace",
                "is_active": True,
                "created_by": self.user,
            },
        )

    def test_media_file_creation(self):
        """Test basic MediaFile creation"""
        media_file = MediaFile.objects.create(
            title="Test Image",
            slug="test-image",
            file_type="image/jpeg",
            file_size=1024000,
            file_url="https://example.com/test.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        self.assertEqual(media_file.title, "Test Image")
        self.assertEqual(media_file.slug, "test-image")
        self.assertEqual(media_file.file_type, "image/jpeg")
        self.assertEqual(media_file.file_size, 1024000)
        self.assertEqual(media_file.uploaded_by, self.user)
        self.assertEqual(media_file.namespace, self.namespace)
        self.assertIsInstance(media_file.id, uuid.UUID)

    def test_media_file_validation(self):
        """Test MediaFile validation rules"""
        # Test title validation
        with self.assertRaises(ValidationError):
            media_file = MediaFile(
                title="",  # Empty title should fail
                slug="test-slug",
                file_type="image/jpeg",
                file_size=1024,
                file_url="https://example.com/test.jpg",
                uploaded_by=self.user,
                namespace=self.namespace,
            )
            media_file.full_clean()

        # Test slug validation
        with self.assertRaises(ValidationError):
            media_file = MediaFile(
                title="Test Title",
                slug="",  # Empty slug should fail
                file_type="image/jpeg",
                file_size=1024,
                file_url="https://example.com/test.jpg",
                uploaded_by=self.user,
                namespace=self.namespace,
            )
            media_file.full_clean()

    def test_media_file_str_representation(self):
        """Test MediaFile string representation"""
        media_file = MediaFile.objects.create(
            title="Test Document",
            slug="test-document",
            file_type="application/pdf",
            file_size=2048000,
            file_url="https://example.com/test.pdf",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        self.assertEqual(str(media_file), "Test Document")

    def test_media_file_file_size_display(self):
        """Test file size display formatting"""
        # Test bytes
        media_file = MediaFile.objects.create(
            title="Small File",
            slug="small-file",
            file_type="text/plain",
            file_size=512,
            file_url="https://example.com/small.txt",
            uploaded_by=self.user,
            namespace=self.namespace,
        )
        self.assertEqual(media_file.file_size_display, "512 B")

        # Test KB
        media_file.file_size = 1536  # 1.5 KB
        media_file.save()
        self.assertEqual(media_file.file_size_display, "1.5 KB")

        # Test MB
        media_file.file_size = 2097152  # 2 MB
        media_file.save()
        self.assertEqual(media_file.file_size_display, "2.0 MB")

        # Test GB
        media_file.file_size = 2147483648  # 2 GB
        media_file.save()
        self.assertEqual(media_file.file_size_display, "2.0 GB")

    def test_media_file_is_image(self):
        """Test is_image property"""
        # Test image file
        image_file = MediaFile.objects.create(
            title="Test Image",
            slug="test-image",
            file_type="image/jpeg",
            file_size=1024,
            file_url="https://example.com/test.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )
        self.assertTrue(image_file.is_image)

        # Test non-image file
        doc_file = MediaFile.objects.create(
            title="Test Document",
            slug="test-document",
            file_type="application/pdf",
            file_size=1024,
            file_url="https://example.com/test.pdf",
            uploaded_by=self.user,
            namespace=self.namespace,
        )
        self.assertFalse(doc_file.is_image)

    def test_media_file_is_video(self):
        """Test is_video property"""
        # Test video file
        video_file = MediaFile.objects.create(
            title="Test Video",
            slug="test-video",
            file_type="video/mp4",
            file_size=10240000,
            file_url="https://example.com/test.mp4",
            uploaded_by=self.user,
            namespace=self.namespace,
        )
        self.assertTrue(video_file.is_video)

        # Test non-video file
        image_file = MediaFile.objects.create(
            title="Test Image",
            slug="test-image",
            file_type="image/jpeg",
            file_size=1024,
            file_url="https://example.com/test.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )
        self.assertFalse(image_file.is_video)

    def test_media_file_namespace_constraint(self):
        """Test namespace constraint on MediaFile"""
        # Create first file
        MediaFile.objects.create(
            title="Test File",
            slug="test-file",
            file_type="image/jpeg",
            file_size=1024,
            file_url="https://example.com/test.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        # Try to create another file with same slug in same namespace
        with self.assertRaises(Exception):  # Should raise IntegrityError
            MediaFile.objects.create(
                title="Another Test File",
                slug="test-file",  # Same slug
                file_type="image/png",
                file_size=2048,
                file_url="https://example.com/test2.png",
                uploaded_by=self.user,
                namespace=self.namespace,  # Same namespace
            )

        # But should work with different namespace
        other_namespace, _ = Namespace.objects.get_or_create(
            slug="other-namespace",
            defaults={
                "name": "Other Namespace",
                "is_active": True,
                "created_by": self.user,
            },
        )

        other_file = MediaFile.objects.create(
            title="Other File",
            slug="test-file",  # Same slug but different namespace
            file_type="image/png",
            file_size=2048,
            file_url="https://example.com/test2.png",
            uploaded_by=self.user,
            namespace=other_namespace,
        )

        self.assertIsNotNone(other_file)


class MediaTagModelTest(TestCase):
    """Test MediaTag model functionality"""

    def setUp(self):
        self.namespace, _ = Namespace.objects.get_or_create(
            slug="test-namespace",
            defaults={
                "name": "Test Namespace",
                "is_active": True,
                "created_by": self.user,
            },
        )

    def test_media_tag_creation(self):
        """Test basic MediaTag creation"""
        tag = MediaTag.objects.create(
            name="Nature", slug="nature", namespace=self.namespace
        )

        self.assertEqual(tag.name, "Nature")
        self.assertEqual(tag.slug, "nature")
        self.assertEqual(tag.namespace, self.namespace)
        self.assertIsInstance(tag.id, uuid.UUID)

    def test_media_tag_str_representation(self):
        """Test MediaTag string representation"""
        tag = MediaTag.objects.create(
            name="Photography", slug="photography", namespace=self.namespace
        )

        self.assertEqual(str(tag), "Photography")

    def test_media_tag_namespace_constraint(self):
        """Test namespace constraint on MediaTag"""
        # Create first tag
        MediaTag.objects.create(
            name="Landscape", slug="landscape", namespace=self.namespace
        )

        # Try to create another tag with same slug in same namespace
        with self.assertRaises(Exception):  # Should raise IntegrityError
            MediaTag.objects.create(
                name="Different Landscape",
                slug="landscape",  # Same slug
                namespace=self.namespace,  # Same namespace
            )


class MediaCollectionModelTest(TestCase):
    """Test MediaCollection model functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace, _ = Namespace.objects.get_or_create(
            slug="test-namespace",
            defaults={
                "name": "Test Namespace",
                "is_active": True,
                "created_by": self.user,
            },
        )

    def test_media_collection_creation(self):
        """Test basic MediaCollection creation"""
        collection = MediaCollection.objects.create(
            title="Summer Photos",
            slug="summer-photos",
            description="Photos from summer vacation",
            created_by=self.user,
            namespace=self.namespace,
        )

        self.assertEqual(collection.title, "Summer Photos")
        self.assertEqual(collection.slug, "summer-photos")
        self.assertEqual(collection.description, "Photos from summer vacation")
        self.assertEqual(collection.created_by, self.user)
        self.assertEqual(collection.namespace, self.namespace)
        self.assertIsInstance(collection.id, uuid.UUID)

    def test_media_collection_str_representation(self):
        """Test MediaCollection string representation"""
        collection = MediaCollection.objects.create(
            title="Winter Gallery",
            slug="winter-gallery",
            created_by=self.user,
            namespace=self.namespace,
        )

        self.assertEqual(str(collection), "Winter Gallery")

    def test_media_collection_file_count(self):
        """Test MediaCollection file count property"""
        collection = MediaCollection.objects.create(
            title="Test Collection",
            slug="test-collection",
            created_by=self.user,
            namespace=self.namespace,
        )

        # Initially should have 0 files
        self.assertEqual(collection.file_count, 0)

        # Add some files
        file1 = MediaFile.objects.create(
            title="File 1",
            slug="file-1",
            file_type="image/jpeg",
            file_size=1024,
            file_url="https://example.com/file1.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        file2 = MediaFile.objects.create(
            title="File 2",
            slug="file-2",
            file_type="image/png",
            file_size=2048,
            file_url="https://example.com/file2.png",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        collection.files.add(file1, file2)

        # Should now have 2 files
        self.assertEqual(collection.file_count, 2)


class MediaUsageModelTest(TestCase):
    """Test MediaUsage model functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace, _ = Namespace.objects.get_or_create(
            slug="test-namespace",
            defaults={
                "name": "Test Namespace",
                "is_active": True,
                "created_by": self.user,
            },
        )
        self.media_file = MediaFile.objects.create(
            title="Test Image",
            slug="test-image",
            file_type="image/jpeg",
            file_size=1024000,
            file_url="https://example.com/test.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )
        self.webpage = WebPage.objects.create(
            title="Test Page", slug="test-page", namespace=self.namespace
        )

    def test_media_usage_creation(self):
        """Test basic MediaUsage creation"""
        usage = MediaUsage.objects.create(
            media_file=self.media_file,
            content_type="webpage",
            object_id=str(self.webpage.id),
            usage_context="Featured Image",
        )

        self.assertEqual(usage.media_file, self.media_file)
        self.assertEqual(usage.content_type, "webpage")
        self.assertEqual(usage.object_id, str(self.webpage.id))
        self.assertEqual(usage.usage_context, "Featured Image")
        self.assertIsInstance(usage.id, uuid.UUID)

    def test_media_usage_str_representation(self):
        """Test MediaUsage string representation"""
        usage = MediaUsage.objects.create(
            media_file=self.media_file,
            content_type="widget",
            object_id="widget-123",
            usage_context="Gallery Image",
        )

        expected_str = f"Test Image used in widget (widget-123)"
        self.assertEqual(str(usage), expected_str)


class MediaModelRelationshipsTest(TestCase):
    """Test relationships between media models"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace, _ = Namespace.objects.get_or_create(
            slug="test-namespace",
            defaults={
                "name": "Test Namespace",
                "is_active": True,
                "created_by": self.user,
            },
        )

    def test_media_file_tags_relationship(self):
        """Test many-to-many relationship between MediaFile and MediaTag"""
        # Create media file
        media_file = MediaFile.objects.create(
            title="Nature Photo",
            slug="nature-photo",
            file_type="image/jpeg",
            file_size=1024000,
            file_url="https://example.com/nature.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        # Create tags
        tag1 = MediaTag.objects.create(
            name="Nature", slug="nature", namespace=self.namespace
        )

        tag2 = MediaTag.objects.create(
            name="Landscape", slug="landscape", namespace=self.namespace
        )

        # Add tags to media file
        media_file.tags.add(tag1, tag2)

        # Test relationships
        self.assertEqual(media_file.tags.count(), 2)
        self.assertIn(tag1, media_file.tags.all())
        self.assertIn(tag2, media_file.tags.all())

        # Test reverse relationship
        self.assertEqual(tag1.mediafile_set.count(), 1)
        self.assertIn(media_file, tag1.mediafile_set.all())

    def test_media_collection_files_relationship(self):
        """Test many-to-many relationship between MediaCollection and MediaFile"""
        # Create collection
        collection = MediaCollection.objects.create(
            title="Summer Photos",
            slug="summer-photos",
            created_by=self.user,
            namespace=self.namespace,
        )

        # Create media files
        file1 = MediaFile.objects.create(
            title="Beach Photo",
            slug="beach-photo",
            file_type="image/jpeg",
            file_size=1024000,
            file_url="https://example.com/beach.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        file2 = MediaFile.objects.create(
            title="Mountain Photo",
            slug="mountain-photo",
            file_type="image/jpeg",
            file_size=2048000,
            file_url="https://example.com/mountain.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        # Add files to collection
        collection.files.add(file1, file2)

        # Test relationships
        self.assertEqual(collection.files.count(), 2)
        self.assertIn(file1, collection.files.all())
        self.assertIn(file2, collection.files.all())

        # Test reverse relationship
        self.assertEqual(file1.collections.count(), 1)
        self.assertIn(collection, file1.collections.all())
