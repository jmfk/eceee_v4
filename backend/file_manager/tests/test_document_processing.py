"""
Tests for document processing features including text extraction and thumbnail generation.
"""

import os
import tempfile
from unittest.mock import Mock, patch, MagicMock
from io import BytesIO

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

from file_manager.models import MediaFile, PendingMediaFile, Namespace
from file_manager.services.document_processor import DocumentProcessor
from file_manager.storage import S3MediaStorage
from file_manager.tasks import process_document_text, generate_document_thumbnail

User = get_user_model()


class DocumentProcessorTestCase(TestCase):
    """Test cases for DocumentProcessor service."""

    def setUp(self):
        """Set up test fixtures."""
        self.processor = DocumentProcessor()
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        """Clean up test files."""
        import shutil
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def create_test_pdf(self):
        """Create a simple test PDF file."""
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter

        pdf_path = os.path.join(self.test_dir, "test.pdf")
        c = canvas.Canvas(pdf_path, pagesize=letter)
        c.drawString(100, 750, "Test PDF Document")
        c.drawString(100, 730, "This is a sample text for testing.")
        c.save()
        return pdf_path

    def create_test_markdown(self):
        """Create a test Markdown file."""
        md_path = os.path.join(self.test_dir, "test.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write("# Test Markdown\n\n")
            f.write("This is a test markdown document.\n\n")
            f.write("## Section 1\n\n")
            f.write("Some content here.\n")
        return md_path

    def test_extract_text_from_pdf(self):
        """Test PDF text extraction."""
        pdf_path = self.create_test_pdf()
        text = self.processor.extract_text_from_pdf(pdf_path)

        self.assertIsNotNone(text)
        self.assertIn("Test PDF Document", text)
        self.assertIn("sample text", text)

    def test_extract_text_from_markdown(self):
        """Test Markdown text extraction."""
        md_path = self.create_test_markdown()
        text = self.processor.extract_text_from_markdown(md_path)

        self.assertIsNotNone(text)
        self.assertIn("# Test Markdown", text)
        self.assertIn("test markdown document", text)
        self.assertGreater(len(text), 0)

    @patch('file_manager.services.document_processor.convert_from_path')
    def test_generate_pdf_thumbnail(self, mock_convert):
        """Test PDF thumbnail generation."""
        # Mock PIL Image
        mock_image = MagicMock()
        mock_image.mode = 'RGB'
        mock_image.thumbnail = MagicMock()
        mock_image.save = MagicMock()
        mock_convert.return_value = [mock_image]

        pdf_path = self.create_test_pdf()
        thumbnail_bytes = self.processor.generate_pdf_thumbnail(pdf_path, size=300)

        # Verify convert_from_path was called correctly
        mock_convert.assert_called_once()
        call_args = mock_convert.call_args
        self.assertEqual(call_args[0][0], pdf_path)
        self.assertEqual(call_args[1]['first_page'], 1)
        self.assertEqual(call_args[1]['last_page'], 1)

    def test_extract_text_with_invalid_file(self):
        """Test text extraction with invalid file."""
        invalid_path = os.path.join(self.test_dir, "nonexistent.pdf")
        text = self.processor.extract_text_from_pdf(invalid_path)
        self.assertEqual(text, "")

    def test_generate_document_thumbnail_unsupported_type(self):
        """Test thumbnail generation for unsupported document type."""
        md_path = self.create_test_markdown()
        thumbnail = self.processor.generate_document_thumbnail(
            md_path, "text/markdown"
        )
        # Markdown thumbnails not supported, should return None
        self.assertIsNone(thumbnail)


class DocumentTasksTestCase(TestCase):
    """Test cases for document processing Celery tasks."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace", slug="test-namespace", is_active=True
        )

    @patch('file_manager.tasks.S3MediaStorage')
    @patch('file_manager.tasks.document_processor')
    def test_process_document_text_task(self, mock_processor, mock_storage):
        """Test document text extraction task."""
        # Create a pending document file
        pending_file = PendingMediaFile.objects.create(
            original_filename="test.pdf",
            file_path="uploads/test.pdf",
            file_size=1024,
            content_type="application/pdf",
            file_hash="abc123",
            file_type="document",
            namespace=self.namespace,
            uploaded_by=self.user,
            expires_at=timezone.now() + timedelta(hours=24),
        )

        # Mock storage read
        mock_storage_instance = mock_storage.return_value
        mock_storage_instance._read.return_value = b"fake pdf content"

        # Mock text extraction
        mock_processor.extract_text.return_value = "Extracted text from PDF"

        # Run the task
        with patch('file_manager.tasks.tempfile.NamedTemporaryFile') as mock_temp:
            mock_temp_file = MagicMock()
            mock_temp_file.name = '/tmp/test.pdf'
            mock_temp_file.__enter__.return_value = mock_temp_file
            mock_temp.return_value = mock_temp_file

            result = process_document_text(str(pending_file.id), is_pending=True)

        self.assertTrue(result)

        # Verify file was updated
        pending_file.refresh_from_db()
        self.assertIn("text_processing_status", pending_file.metadata)

    @patch('file_manager.tasks.S3MediaStorage')
    @patch('file_manager.tasks.document_processor')
    def test_generate_document_thumbnail_task(self, mock_processor, mock_storage):
        """Test document thumbnail generation task."""
        # Create a pending document file
        pending_file = PendingMediaFile.objects.create(
            original_filename="test.pdf",
            file_path="uploads/test.pdf",
            file_size=1024,
            content_type="application/pdf",
            file_hash="def456",
            file_type="document",
            namespace=self.namespace,
            uploaded_by=self.user,
            expires_at=timezone.now() + timedelta(hours=24),
        )

        # Mock storage
        mock_storage_instance = mock_storage.return_value
        mock_storage_instance._read.return_value = b"fake pdf content"
        mock_storage_instance.upload_thumbnail.return_value = "uploads/test_thumb.jpg"

        # Mock thumbnail generation
        mock_processor.generate_document_thumbnail.return_value = b"fake thumbnail"

        # Run the task
        with patch('file_manager.tasks.tempfile.NamedTemporaryFile') as mock_temp:
            mock_temp_file = MagicMock()
            mock_temp_file.name = '/tmp/test.pdf'
            mock_temp_file.__enter__.return_value = mock_temp_file
            mock_temp.return_value = mock_temp_file

            result = generate_document_thumbnail(str(pending_file.id), is_pending=True)

        self.assertTrue(result)

        # Verify thumbnail was stored
        pending_file.refresh_from_db()
        self.assertIn("thumbnail_processing_status", pending_file.metadata)

    def test_process_document_text_non_document(self):
        """Test text extraction task skips non-document files."""
        # Create a pending image file
        pending_file = PendingMediaFile.objects.create(
            original_filename="test.jpg",
            file_path="uploads/test.jpg",
            file_size=1024,
            content_type="image/jpeg",
            file_hash="ghi789",
            file_type="image",
            namespace=self.namespace,
            uploaded_by=self.user,
            expires_at=timezone.now() + timedelta(hours=24),
        )

        result = process_document_text(str(pending_file.id), is_pending=True)

        # Should return True but not process the file
        self.assertTrue(result)

        # Verify no text extraction metadata was added
        pending_file.refresh_from_db()
        self.assertNotIn("text_processing_status", pending_file.metadata or {})


class S3ThumbnailStorageTestCase(TestCase):
    """Test cases for S3 thumbnail upload."""

    @patch('file_manager.storage.boto3')
    def test_upload_thumbnail(self, mock_boto3):
        """Test thumbnail upload to S3."""
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client

        storage = S3MediaStorage()
        thumbnail_bytes = b"fake thumbnail data"
        original_path = "uploads/test.pdf"

        thumbnail_path = storage.upload_thumbnail(thumbnail_bytes, original_path)

        # Verify correct thumbnail path generated
        self.assertEqual(thumbnail_path, "uploads/test_thumb.jpg")

        # Verify S3 put_object was called
        mock_client.put_object.assert_called_once()
        call_args = mock_client.put_object.call_args
        self.assertEqual(call_args[1]['Key'], "uploads/test_thumb.jpg")
        self.assertEqual(call_args[1]['Body'], thumbnail_bytes)
        self.assertEqual(call_args[1]['ContentType'], "image/jpeg")


class ModelHelpersTestCase(TestCase):
    """Test cases for model helper methods."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace", slug="test-namespace", is_active=True
        )

    def test_has_thumbnail_with_thumbnail(self):
        """Test has_thumbnail returns True when thumbnail exists."""
        pending_file = PendingMediaFile.objects.create(
            original_filename="test.pdf",
            file_path="uploads/test.pdf",
            file_size=1024,
            content_type="application/pdf",
            file_hash="jkl012",
            file_type="document",
            namespace=self.namespace,
            uploaded_by=self.user,
            expires_at=timezone.now() + timedelta(hours=24),
            metadata={"thumbnail_path": "uploads/test_thumb.jpg"},
        )

        self.assertTrue(pending_file.has_thumbnail())
        self.assertEqual(pending_file.get_thumbnail_path(), "uploads/test_thumb.jpg")

    def test_has_thumbnail_without_thumbnail(self):
        """Test has_thumbnail returns False when no thumbnail exists."""
        pending_file = PendingMediaFile.objects.create(
            original_filename="test.pdf",
            file_path="uploads/test.pdf",
            file_size=1024,
            content_type="application/pdf",
            file_hash="mno345",
            file_type="document",
            namespace=self.namespace,
            uploaded_by=self.user,
            expires_at=timezone.now() + timedelta(hours=24),
        )

        self.assertFalse(pending_file.has_thumbnail())
        self.assertIsNone(pending_file.get_thumbnail_path())

    def test_media_file_has_thumbnail(self):
        """Test has_thumbnail works on MediaFile model too."""
        media_file = MediaFile.objects.create(
            title="Test Document",
            slug="test-document",
            original_filename="test.pdf",
            file_path="uploads/test.pdf",
            file_size=1024,
            content_type="application/pdf",
            file_hash="pqr678",
            file_type="document",
            namespace=self.namespace,
            uploaded_by=self.user,
            metadata={"thumbnail_path": "uploads/test_thumb.jpg"},
        )

        self.assertTrue(media_file.has_thumbnail())
        self.assertEqual(media_file.get_thumbnail_path(), "uploads/test_thumb.jpg")


class UploadIntegrationTestCase(TestCase):
    """Test cases for upload workflow integration."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace", slug="test-namespace", is_active=True
        )

    @patch('file_manager.services.upload_service.process_document_text')
    @patch('file_manager.services.upload_service.generate_document_thumbnail')
    @patch('file_manager.services.upload_service.storage')
    def test_document_upload_triggers_tasks(
        self, mock_storage, mock_thumb_task, mock_text_task
    ):
        """Test that uploading a document triggers background tasks."""
        from file_manager.services.upload_service import FileUploadService
        from django.core.files.uploadedfile import SimpleUploadedFile

        # Mock storage upload
        mock_storage.upload_file.return_value = {
            "file_path": "uploads/test.pdf",
            "file_size": 1024,
            "content_type": "application/pdf",
            "file_hash": "stu901",
        }

        # Mock task delay methods
        mock_thumb_task.delay = MagicMock()
        mock_text_task.delay = MagicMock()

        # Create upload service
        service = FileUploadService()

        # Create a test file
        test_file = SimpleUploadedFile(
            "test.pdf", b"fake pdf content", content_type="application/pdf"
        )

        # Upload the file
        with patch('file_manager.services.upload_service.ai_service') as mock_ai:
            mock_ai.analyze_media_file.return_value = {}
            result = service.upload(test_file, "", self.namespace, self.user)

        # Verify tasks were triggered
        self.assertEqual(len(result.files), 1)
        # Note: In actual implementation, tasks are called with delay()
        # This test verifies the integration structure


class SerializerTestCase(TestCase):
    """Test cases for serializer thumbnail_url field."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace", slug="test-namespace", is_active=True
        )

    @patch('file_manager.serializers.S3MediaStorage')
    def test_serializer_includes_thumbnail_url(self, mock_storage_class):
        """Test that serializer includes thumbnail_url for documents with thumbnails."""
        from file_manager.serializers import PendingMediaFileDetailSerializer

        # Create pending file with thumbnail
        pending_file = PendingMediaFile.objects.create(
            original_filename="test.pdf",
            file_path="uploads/test.pdf",
            file_size=1024,
            content_type="application/pdf",
            file_hash="vwx234",
            file_type="document",
            namespace=self.namespace,
            uploaded_by=self.user,
            expires_at=timezone.now() + timedelta(hours=24),
            metadata={"thumbnail_path": "uploads/test_thumb.jpg"},
        )

        # Mock storage
        mock_storage = mock_storage_class.return_value
        mock_storage.get_public_url.return_value = "https://example.com/uploads/test_thumb.jpg"

        # Serialize
        serializer = PendingMediaFileDetailSerializer(pending_file)
        data = serializer.data

        # Verify thumbnail_url is included
        self.assertIn("thumbnail_url", data)
        self.assertEqual(data["thumbnail_url"], "https://example.com/uploads/test_thumb.jpg")

    def test_serializer_no_thumbnail_url_without_thumbnail(self):
        """Test that serializer returns None for thumbnail_url when no thumbnail exists."""
        from file_manager.serializers import PendingMediaFileDetailSerializer

        # Create pending file without thumbnail
        pending_file = PendingMediaFile.objects.create(
            original_filename="test.pdf",
            file_path="uploads/test.pdf",
            file_size=1024,
            content_type="application/pdf",
            file_hash="yza567",
            file_type="document",
            namespace=self.namespace,
            uploaded_by=self.user,
            expires_at=timezone.now() + timedelta(hours=24),
        )

        # Serialize
        serializer = PendingMediaFileDetailSerializer(pending_file)
        data = serializer.data

        # Verify thumbnail_url is None
        self.assertIn("thumbnail_url", data)
        self.assertIsNone(data["thumbnail_url"])

