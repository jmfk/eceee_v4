"""
Tests for Media System API Endpoints

Tests cover:
- MediaFile CRUD operations
- MediaCollection CRUD operations
- MediaTag CRUD operations
- File upload functionality
- Search and filtering
- Bulk operations
- Authentication and permissions
- Namespace isolation
- Error handling
"""

from django.test import TestCase
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
import json
import uuid
from unittest.mock import patch, MagicMock

from file_manager.models import MediaFile, MediaTag, MediaCollection
from content.models import Namespace


class MediaFileAPITest(APITestCase):
    """Test MediaFile API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
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

    def test_list_media_files(self):
        """Test listing media files"""
        url = reverse("mediafile-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["title"], "Test Image")

    def test_retrieve_media_file(self):
        """Test retrieving a specific media file"""
        url = reverse("mediafile-detail", kwargs={"pk": self.media_file.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Test Image")
        self.assertEqual(response.data["slug"], "test-image")
        self.assertEqual(response.data["file_type"], "image/jpeg")

    def test_create_media_file(self):
        """Test creating a new media file"""
        url = reverse("mediafile-list")
        data = {
            "title": "New Image",
            "slug": "new-image",
            "file_type": "image/png",
            "file_size": 2048000,
            "file_url": "https://example.com/new.png",
            "namespace": str(self.namespace.id),
        }

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "New Image")
        self.assertEqual(response.data["uploaded_by"], self.user.id)

        # Verify in database
        media_file = MediaFile.objects.get(slug="new-image")
        self.assertEqual(media_file.title, "New Image")
        self.assertEqual(media_file.uploaded_by, self.user)

    def test_update_media_file(self):
        """Test updating a media file"""
        url = reverse("mediafile-detail", kwargs={"pk": self.media_file.id})
        data = {"title": "Updated Image", "description": "Updated description"}

        response = self.client.patch(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Updated Image")
        self.assertEqual(response.data["description"], "Updated description")

        # Verify in database
        self.media_file.refresh_from_db()
        self.assertEqual(self.media_file.title, "Updated Image")
        self.assertEqual(self.media_file.description, "Updated description")

    def test_delete_media_file(self):
        """Test deleting a media file"""
        url = reverse("mediafile-detail", kwargs={"pk": self.media_file.id})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify deletion
        with self.assertRaises(MediaFile.DoesNotExist):
            MediaFile.objects.get(id=self.media_file.id)

    def test_search_media_files(self):
        """Test searching media files"""
        # Create additional files for testing
        MediaFile.objects.create(
            title="Nature Photo",
            slug="nature-photo",
            file_type="image/jpeg",
            file_size=1024000,
            file_url="https://example.com/nature.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        MediaFile.objects.create(
            title="City Landscape",
            slug="city-landscape",
            file_type="image/png",
            file_size=2048000,
            file_url="https://example.com/city.png",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        # Test search by title
        url = reverse("mediafile-list")
        response = self.client.get(url, {"search": "Nature"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["title"], "Nature Photo")

        # Test search by file type
        response = self.client.get(url, {"file_type": "image/png"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["title"], "City Landscape")

    def test_filter_by_namespace(self):
        """Test filtering media files by namespace"""
        # Create another namespace and file
        other_namespace = Namespace.objects.create(
            name="Other Namespace",
            slug="other-namespace",
            is_active=True,
            created_by=self.user,
        )

        MediaFile.objects.create(
            title="Other Image",
            slug="other-image",
            file_type="image/jpeg",
            file_size=1024000,
            file_url="https://example.com/other.jpg",
            uploaded_by=self.user,
            namespace=other_namespace,
        )

        # Test filtering by namespace
        url = reverse("mediafile-list")
        response = self.client.get(url, {"namespace": str(self.namespace.id)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["title"], "Test Image")

    def test_unauthorized_access(self):
        """Test unauthorized access to media files"""
        self.client.credentials()  # Remove authentication

        url = reverse("mediafile-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class MediaFileUploadAPITest(APITestCase):
    """Test MediaFile upload functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
        )

    @patch("file_manager.storage.S3MediaStorage.save")
    @patch("file_manager.ai_services.MediaAIService.analyze_file")
    def test_upload_single_file(self, mock_ai_analyze, mock_storage_save):
        """Test uploading a single file"""
        # Mock storage save
        mock_storage_save.return_value = "uploads/test-image.jpg"

        # Mock AI analysis
        mock_ai_analyze.return_value = {
            "suggested_tags": ["nature", "landscape"],
            "suggested_title": "Beautiful Landscape",
            "extracted_text": "",
        }

        # Create test file
        test_file = SimpleUploadedFile(
            "test.jpg", b"fake image content", content_type="image/jpeg"
        )

        url = reverse("mediafile-upload")
        data = {"file": test_file, "namespace": str(self.namespace.id)}

        response = self.client.post(url, data, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("file_url", response.data)
        self.assertIn("ai_suggestions", response.data)

        # Verify AI suggestions
        ai_suggestions = response.data["ai_suggestions"]
        self.assertEqual(ai_suggestions["suggested_title"], "Beautiful Landscape")
        self.assertEqual(ai_suggestions["suggested_tags"], ["nature", "landscape"])

    @patch("file_manager.storage.S3MediaStorage.save")
    def test_upload_multiple_files(self, mock_storage_save):
        """Test uploading multiple files"""
        mock_storage_save.side_effect = ["uploads/file1.jpg", "uploads/file2.png"]

        # Create test files
        file1 = SimpleUploadedFile(
            "file1.jpg", b"fake image content 1", content_type="image/jpeg"
        )

        file2 = SimpleUploadedFile(
            "file2.png", b"fake image content 2", content_type="image/png"
        )

        url = reverse("mediafile-bulk-upload")
        data = {"files": [file1, file2], "namespace": str(self.namespace.id)}

        response = self.client.post(url, data, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["uploaded_files"]), 2)

        # Verify both files were created
        self.assertEqual(MediaFile.objects.filter(namespace=self.namespace).count(), 2)

    def test_upload_invalid_file_type(self):
        """Test uploading invalid file type"""
        # Create test file with invalid type
        test_file = SimpleUploadedFile(
            "test.exe",
            b"fake executable content",
            content_type="application/x-executable",
        )

        url = reverse("mediafile-upload")
        data = {"file": test_file, "namespace": str(self.namespace.id)}

        response = self.client.post(url, data, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_upload_file_too_large(self):
        """Test uploading file that exceeds size limit"""
        # Create large test file (assuming 100MB limit)
        large_content = b"x" * (100 * 1024 * 1024 + 1)  # 100MB + 1 byte
        test_file = SimpleUploadedFile(
            "large.jpg", large_content, content_type="image/jpeg"
        )

        url = reverse("mediafile-upload")
        data = {"file": test_file, "namespace": str(self.namespace.id)}

        response = self.client.post(url, data, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)


class MediaCollectionAPITest(APITestCase):
    """Test MediaCollection API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
        )

        self.collection = MediaCollection.objects.create(
            title="Test Collection",
            slug="test-collection",
            description="Test collection description",
            created_by=self.user,
            namespace=self.namespace,
        )

    def test_list_collections(self):
        """Test listing media collections"""
        url = reverse("mediacollection-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["title"], "Test Collection")

    def test_create_collection(self):
        """Test creating a new collection"""
        url = reverse("mediacollection-list")
        data = {
            "title": "New Collection",
            "slug": "new-collection",
            "description": "New collection description",
            "namespace": str(self.namespace.id),
        }

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "New Collection")
        self.assertEqual(response.data["created_by"], self.user.id)

    def test_add_files_to_collection(self):
        """Test adding files to a collection"""
        # Create media files
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

        url = reverse("mediacollection-add-files", kwargs={"pk": self.collection.id})
        data = {"file_ids": [str(file1.id), str(file2.id)]}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.collection.files.count(), 2)
        self.assertIn(file1, self.collection.files.all())
        self.assertIn(file2, self.collection.files.all())

    def test_remove_files_from_collection(self):
        """Test removing files from a collection"""
        # Create and add media file
        media_file = MediaFile.objects.create(
            title="Test File",
            slug="test-file",
            file_type="image/jpeg",
            file_size=1024,
            file_url="https://example.com/test.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        self.collection.files.add(media_file)

        url = reverse("mediacollection-remove-files", kwargs={"pk": self.collection.id})
        data = {"file_ids": [str(media_file.id)]}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.collection.files.count(), 0)


class MediaTagAPITest(APITestCase):
    """Test MediaTag API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
        )

        self.tag = MediaTag.objects.create(
            name="Nature", slug="nature", namespace=self.namespace
        )

    def test_list_tags(self):
        """Test listing media tags"""
        url = reverse("mediatag-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["name"], "Nature")

    def test_create_tag(self):
        """Test creating a new tag"""
        url = reverse("mediatag-list")
        data = {
            "name": "Landscape",
            "slug": "landscape",
            "namespace": str(self.namespace.id),
        }

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Landscape")
        self.assertEqual(response.data["slug"], "landscape")

    def test_tag_usage_count(self):
        """Test tag usage count in API response"""
        # Create media file and add tag
        media_file = MediaFile.objects.create(
            title="Nature Photo",
            slug="nature-photo",
            file_type="image/jpeg",
            file_size=1024,
            file_url="https://example.com/nature.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        media_file.tags.add(self.tag)

        url = reverse("mediatag-detail", kwargs={"pk": self.tag.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["usage_count"], 1)


class MediaBulkOperationsAPITest(APITestCase):
    """Test bulk operations API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION="Token " + self.token.key)

        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
        )

        # Create test files
        self.file1 = MediaFile.objects.create(
            title="File 1",
            slug="file-1",
            file_type="image/jpeg",
            file_size=1024,
            file_url="https://example.com/file1.jpg",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

        self.file2 = MediaFile.objects.create(
            title="File 2",
            slug="file-2",
            file_type="image/png",
            file_size=2048,
            file_url="https://example.com/file2.png",
            uploaded_by=self.user,
            namespace=self.namespace,
        )

    def test_bulk_tag_files(self):
        """Test bulk tagging of files"""
        # Create tag
        tag = MediaTag.objects.create(
            name="Bulk Tag", slug="bulk-tag", namespace=self.namespace
        )

        url = reverse("mediafile-bulk-tag")
        data = {
            "file_ids": [str(self.file1.id), str(self.file2.id)],
            "tag_ids": [str(tag.id)],
        }

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify tags were added
        self.file1.refresh_from_db()
        self.file2.refresh_from_db()

        self.assertIn(tag, self.file1.tags.all())
        self.assertIn(tag, self.file2.tags.all())

    def test_bulk_delete_files(self):
        """Test bulk deletion of files"""
        url = reverse("mediafile-bulk-delete")
        data = {"file_ids": [str(self.file1.id), str(self.file2.id)]}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify files were deleted
        self.assertEqual(MediaFile.objects.filter(namespace=self.namespace).count(), 0)

    def test_bulk_move_to_collection(self):
        """Test bulk moving files to collection"""
        # Create collection
        collection = MediaCollection.objects.create(
            title="Bulk Collection",
            slug="bulk-collection",
            created_by=self.user,
            namespace=self.namespace,
        )

        url = reverse("mediafile-bulk-move-to-collection")
        data = {
            "file_ids": [str(self.file1.id), str(self.file2.id)],
            "collection_id": str(collection.id),
        }

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify files were added to collection
        self.assertEqual(collection.files.count(), 2)
        self.assertIn(self.file1, collection.files.all())
        self.assertIn(self.file2, collection.files.all())
