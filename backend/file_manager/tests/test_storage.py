"""
Tests for Media System Storage Integration

Tests cover:
- S3MediaStorage functionality
- File upload and storage
- Thumbnail generation
- Metadata extraction
- Error handling
- Storage configuration
"""

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.models import User
from unittest.mock import patch, MagicMock, Mock
import boto3
from moto import mock_s3
import io
from PIL import Image

from file_manager.storage import S3MediaStorage
from file_manager.models import MediaFile
from content.models import Namespace


class S3MediaStorageTest(TestCase):
    """Test S3MediaStorage functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
        )
        self.storage = S3MediaStorage()

    @mock_s3
    def test_s3_storage_initialization(self):
        """Test S3MediaStorage initialization"""
        # Create mock S3 bucket
        conn = boto3.resource("s3", region_name="us-east-1")
        conn.create_bucket(Bucket="test-bucket")

        with override_settings(
            AWS_STORAGE_BUCKET_NAME="test-bucket", AWS_S3_REGION_NAME="us-east-1"
        ):
            storage = S3MediaStorage()
            self.assertIsNotNone(storage.bucket_name)
            self.assertEqual(storage.bucket_name, "test-bucket")

    @patch("file_manager.storage.boto3.client")
    def test_upload_file_to_s3(self, mock_boto_client):
        """Test uploading file to S3"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        mock_boto_client.return_value = mock_s3_client
        mock_s3_client.upload_fileobj.return_value = None

        # Create test file
        test_file = SimpleUploadedFile(
            "test.jpg", b"fake image content", content_type="image/jpeg"
        )

        # Test upload
        result = self.storage.save("uploads/test.jpg", test_file)

        self.assertIsNotNone(result)
        mock_s3_client.upload_fileobj.assert_called_once()

    @patch("file_manager.storage.boto3.client")
    def test_generate_signed_url(self, mock_boto_client):
        """Test generating signed URLs"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        mock_boto_client.return_value = mock_s3_client
        mock_s3_client.generate_presigned_url.return_value = (
            "https://signed-url.example.com"
        )

        # Test signed URL generation
        signed_url = self.storage.generate_signed_url("uploads/test.jpg")

        self.assertEqual(signed_url, "https://signed-url.example.com")
        mock_s3_client.generate_presigned_url.assert_called_once()

    @patch("file_manager.storage.boto3.client")
    def test_delete_file_from_s3(self, mock_boto_client):
        """Test deleting file from S3"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        mock_boto_client.return_value = mock_s3_client
        mock_s3_client.delete_object.return_value = None

        # Test deletion
        self.storage.delete("uploads/test.jpg")

        mock_s3_client.delete_object.assert_called_once()

    def test_get_file_url(self):
        """Test getting file URL"""
        with override_settings(
            AWS_STORAGE_BUCKET_NAME="test-bucket", AWS_S3_REGION_NAME="us-east-1"
        ):
            storage = S3MediaStorage()
            url = storage.url("uploads/test.jpg")

            self.assertIn("test-bucket", url)
            self.assertIn("uploads/test.jpg", url)


class ThumbnailGenerationTest(TestCase):
    """Test thumbnail generation functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
        )
        self.storage = S3MediaStorage()

    def create_test_image(self, width=800, height=600, format="JPEG"):
        """Helper to create test image"""
        image = Image.new("RGB", (width, height), color="red")
        image_io = io.BytesIO()
        image.save(image_io, format=format)
        image_io.seek(0)
        return SimpleUploadedFile(
            f"test.{format.lower()}",
            image_io.getvalue(),
            content_type=f"image/{format.lower()}",
        )


class MetadataExtractionTest(TestCase):
    """Test metadata extraction functionality"""

    def setUp(self):
        self.storage = S3MediaStorage()

    def create_test_image_with_exif(self):
        """Helper to create test image with EXIF data"""
        image = Image.new("RGB", (800, 600), color="blue")

        # Add some basic EXIF data (PIL doesn't support full EXIF creation easily)
        image_io = io.BytesIO()
        image.save(image_io, format="JPEG")
        image_io.seek(0)

        return SimpleUploadedFile(
            "test_with_exif.jpg", image_io.getvalue(), content_type="image/jpeg"
        )

    @patch("PIL.Image.open")
    def test_extract_image_metadata(self, mock_image_open):
        """Test extracting metadata from images"""
        # Mock PIL Image with EXIF data
        mock_image = MagicMock()
        mock_image.size = (1920, 1080)
        mock_image.format = "JPEG"
        mock_image.mode = "RGB"
        mock_image._getexif.return_value = {
            "DateTime": "2024:01:15 10:30:00",
            "Make": "Canon",
            "Model": "EOS R5",
        }
        mock_image_open.return_value = mock_image

        # Create test file
        test_file = self.create_test_image_with_exif()

        # Test metadata extraction
        metadata = self.storage.extract_metadata(test_file)

        self.assertEqual(metadata["width"], 1920)
        self.assertEqual(metadata["height"], 1080)
        self.assertEqual(metadata["format"], "JPEG")
        self.assertIn("exif", metadata)

    def test_extract_metadata_no_exif(self):
        """Test metadata extraction for files without EXIF"""
        # Create simple test file
        test_file = SimpleUploadedFile(
            "simple.txt", b"simple text content", content_type="text/plain"
        )

        # Test metadata extraction
        metadata = self.storage.extract_metadata(test_file)

        self.assertIn("file_size", metadata)
        self.assertIn("content_type", metadata)
        self.assertEqual(metadata["content_type"], "text/plain")

    def test_extract_metadata_corrupted_file(self):
        """Test metadata extraction for corrupted files"""
        # Create corrupted image file
        corrupted_file = SimpleUploadedFile(
            "corrupted.jpg", b"not a real image", content_type="image/jpeg"
        )

        # Test metadata extraction (should not crash)
        metadata = self.storage.extract_metadata(corrupted_file)

        # Should still return basic metadata
        self.assertIn("file_size", metadata)
        self.assertIn("content_type", metadata)


class StorageErrorHandlingTest(TestCase):
    """Test storage error handling"""

    def setUp(self):
        self.storage = S3MediaStorage()

    @patch("file_manager.storage.boto3.client")
    def test_s3_connection_error(self, mock_boto_client):
        """Test handling S3 connection errors"""
        # Mock S3 client to raise exception
        mock_boto_client.side_effect = Exception("Connection failed")

        # Test that storage handles connection errors gracefully
        with self.assertRaises(Exception):
            storage = S3MediaStorage()
            test_file = SimpleUploadedFile(
                "test.jpg", b"fake content", content_type="image/jpeg"
            )
            storage.save("test.jpg", test_file)

    @patch("file_manager.storage.boto3.client")
    def test_s3_upload_error(self, mock_boto_client):
        """Test handling S3 upload errors"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        mock_boto_client.return_value = mock_s3_client
        mock_s3_client.upload_fileobj.side_effect = Exception("Upload failed")

        # Test upload error handling
        test_file = SimpleUploadedFile(
            "test.jpg", b"fake content", content_type="image/jpeg"
        )

        with self.assertRaises(Exception):
            self.storage.save("test.jpg", test_file)

    @patch("file_manager.storage.boto3.client")
    def test_s3_delete_error(self, mock_boto_client):
        """Test handling S3 deletion errors"""
        # Mock S3 client
        mock_s3_client = MagicMock()
        mock_boto_client.return_value = mock_s3_client
        mock_s3_client.delete_object.side_effect = Exception("Delete failed")

        # Test delete error handling
        with self.assertRaises(Exception):
            self.storage.delete("test.jpg")

    def test_invalid_file_type(self):
        """Test handling invalid file types"""
        # Create file with invalid type
        invalid_file = SimpleUploadedFile(
            "test.exe", b"executable content", content_type="application/x-executable"
        )

        # Test validation (assuming storage validates file types)
        with self.assertRaises(ValueError):
            self.storage.validate_file_type(invalid_file)

    def test_file_size_limit(self):
        """Test file size limit validation"""
        # Create oversized file
        large_content = b"x" * (100 * 1024 * 1024 + 1)  # 100MB + 1 byte
        large_file = SimpleUploadedFile(
            "large.jpg", large_content, content_type="image/jpeg"
        )

        # Test size validation
        with self.assertRaises(ValueError):
            self.storage.validate_file_size(large_file)


class StorageConfigurationTest(TestCase):
    """Test storage configuration options"""

    @override_settings(
        AWS_STORAGE_BUCKET_NAME="custom-bucket",
        AWS_S3_REGION_NAME="eu-west-1",
        AWS_S3_CUSTOM_DOMAIN="cdn.example.com",
    )
    def test_custom_storage_settings(self):
        """Test custom storage configuration"""
        storage = S3MediaStorage()

        self.assertEqual(storage.bucket_name, "custom-bucket")
        self.assertEqual(storage.region_name, "eu-west-1")
        self.assertEqual(storage.custom_domain, "cdn.example.com")

    @override_settings(USE_S3=False)
    def test_local_storage_fallback(self):
        """Test fallback to local storage when S3 is disabled"""
        # This would test local file storage implementation
        # when S3 is not available or disabled
        pass

    def test_storage_security_settings(self):
        """Test storage security configuration"""
        storage = S3MediaStorage()

        # Test that security settings are properly configured
        self.assertTrue(hasattr(storage, "default_acl"))
        self.assertTrue(hasattr(storage, "file_overwrite"))

        # Verify secure defaults
        self.assertEqual(storage.default_acl, "private")
        self.assertFalse(storage.file_overwrite)
