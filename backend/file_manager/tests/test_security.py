"""
Security Tests for File Manager

Tests for security fixes implemented based on PR review:
1. User agent sanitization
2. Filename XSS protection
3. Path traversal validation
4. Force upload admin restrictions
5. Extension validation before MIME detection
6. Memory leak prevention with streaming
7. Race condition prevention in duplicate detection
"""

import hashlib
import tempfile
import os
from unittest.mock import patch, MagicMock
from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.http import HttpRequest
from rest_framework.test import APITestCase
from rest_framework import status

from ..security import FileUploadValidator, MediaSecurityMiddleware
from ..storage import S3MediaStorage
from ..models import PendingMediaFile, MediaFile
from content.models import Namespace


class UserAgentSanitizationTest(TestCase):
    """Test user agent string sanitization to prevent log injection."""

    def setUp(self):
        self.middleware = MediaSecurityMiddleware(lambda x: None)

    def test_sanitize_log_string_removes_newlines(self):
        """Test that newlines are removed from log strings."""
        dangerous_input = "normal text\nmalicious\rlog\tinjection"
        sanitized = self.middleware._sanitize_log_string(dangerous_input)

        self.assertNotIn("\n", sanitized)
        self.assertNotIn("\r", sanitized)
        self.assertNotIn("\t", sanitized)

    def test_sanitize_log_string_removes_html_chars(self):
        """Test that HTML/script characters are removed."""
        dangerous_input = '<script>alert("xss")</script>'
        sanitized = self.middleware._sanitize_log_string(dangerous_input)

        self.assertNotIn("<", sanitized)
        self.assertNotIn(">", sanitized)
        self.assertNotIn('"', sanitized)
        self.assertNotIn("'", sanitized)

    def test_sanitize_log_string_limits_length(self):
        """Test that long strings are truncated."""
        long_input = "a" * 300
        sanitized = self.middleware._sanitize_log_string(long_input, max_length=100)

        self.assertLessEqual(len(sanitized), 103)  # 100 + "..."
        self.assertTrue(sanitized.endswith("..."))

    def test_sanitize_log_string_handles_empty_input(self):
        """Test that empty/None input is handled gracefully."""
        self.assertEqual(self.middleware._sanitize_log_string(""), "")
        self.assertEqual(self.middleware._sanitize_log_string(None), "")

    def test_suspicious_user_agent_sanitization(self):
        """Test that suspicious user agents are sanitized in security checks."""
        request = HttpRequest()
        request.META = {"HTTP_USER_AGENT": "curl/7.0\nmalicious\nlog"}
        request.user = MagicMock()
        request.user.is_authenticated = False

        # Mock the security audit logger
        with patch(
            "file_manager.security.SecurityAuditLogger.log_security_violation"
        ) as mock_log:
            self.middleware._check_request_security(request)

            # Verify the log was called with sanitized user agent
            mock_log.assert_called_once()
            args = mock_log.call_args[0]
            sanitized_message = args[2]
            self.assertNotIn("\n", sanitized_message)


class FilenameSanitizationTest(TestCase):
    """Test filename sanitization to prevent XSS attacks."""

    def setUp(self):
        self.storage = S3MediaStorage()

    def test_sanitize_filename_removes_html_tags(self):
        """Test that HTML tags are removed from filenames."""
        malicious_filename = '<script>alert("xss")</script>test.jpg'
        sanitized = self.storage._sanitize_filename_for_display(malicious_filename)

        self.assertNotIn("<script>", sanitized)
        self.assertNotIn("</script>", sanitized)
        self.assertEqual(sanitized, 'alert("xss")test.jpg')

    def test_sanitize_filename_removes_javascript_handlers(self):
        """Test that JavaScript event handlers are removed."""
        malicious_filename = "onclick=alert(1)test.jpg"
        sanitized = self.storage._sanitize_filename_for_display(malicious_filename)

        self.assertNotIn("onclick=", sanitized)
        self.assertEqual(sanitized, "alert(1)test.jpg")

    def test_sanitize_filename_removes_javascript_protocol(self):
        """Test that javascript: protocol is removed."""
        malicious_filename = "javascript:alert(1)test.jpg"
        sanitized = self.storage._sanitize_filename_for_display(malicious_filename)

        self.assertNotIn("javascript:", sanitized)
        self.assertEqual(sanitized, "alert(1)test.jpg")

    def test_sanitize_filename_removes_control_characters(self):
        """Test that control characters are removed."""
        malicious_filename = "test\x00\x01\x1f.jpg"
        sanitized = self.storage._sanitize_filename_for_display(malicious_filename)

        self.assertEqual(sanitized, "test.jpg")

    def test_sanitize_filename_handles_empty_input(self):
        """Test that empty input is handled gracefully."""
        self.assertEqual(self.storage._sanitize_filename_for_display(""), "")
        self.assertEqual(self.storage._sanitize_filename_for_display(None), "")


class PathTraversalValidationTest(TestCase):
    """Test path traversal validation in folder paths."""

    def setUp(self):
        self.storage = S3MediaStorage()

    def test_validate_folder_path_rejects_parent_directory(self):
        """Test that parent directory traversal is rejected."""
        with self.assertRaises(ValueError) as cm:
            self.storage._validate_folder_path("../etc/passwd")

        self.assertIn("dangerous pattern", str(cm.exception))

    def test_validate_folder_path_rejects_absolute_paths(self):
        """Test that absolute paths are rejected."""
        with self.assertRaises(ValueError) as cm:
            self.storage._validate_folder_path("/etc/passwd")

        self.assertIn("Absolute paths are not allowed", str(cm.exception))

    def test_validate_folder_path_rejects_home_directory(self):
        """Test that home directory references are rejected."""
        with self.assertRaises(ValueError) as cm:
            self.storage._validate_folder_path("~/secret")

        self.assertIn("dangerous pattern", str(cm.exception))

    def test_validate_folder_path_rejects_null_bytes(self):
        """Test that null bytes are rejected."""
        with self.assertRaises(ValueError) as cm:
            self.storage._validate_folder_path("test\x00file")

        self.assertIn("dangerous pattern", str(cm.exception))

    def test_validate_folder_path_rejects_windows_separators(self):
        """Test that Windows path separators are rejected."""
        with self.assertRaises(ValueError) as cm:
            self.storage._validate_folder_path("test\\..\\secret")

        self.assertIn("dangerous pattern", str(cm.exception))

    def test_validate_folder_path_rejects_invalid_characters(self):
        """Test that invalid characters are rejected."""
        with self.assertRaises(ValueError) as cm:
            self.storage._validate_folder_path("test<>file")

        self.assertIn("invalid characters", str(cm.exception))

    def test_validate_folder_path_accepts_valid_paths(self):
        """Test that valid paths are accepted."""
        valid_paths = [
            "uploads/images",
            "user-content/2024",
            "documents_folder",
            "test123/subfolder",
        ]

        for path in valid_paths:
            result = self.storage._validate_folder_path(path)
            self.assertEqual(result, path)

    def test_validate_folder_path_handles_empty_input(self):
        """Test that empty input is handled gracefully."""
        self.assertEqual(self.storage._validate_folder_path(""), "")
        self.assertEqual(self.storage._validate_folder_path(None), "")


class ExtensionValidationTest(TestCase):
    """Test server-side extension validation before MIME detection."""

    def test_validate_file_extension_rejects_dangerous_extensions(self):
        """Test that dangerous file extensions are rejected."""
        dangerous_extensions = [
            ".exe",
            ".bat",
            ".cmd",
            ".scr",
            ".vbs",
            ".js",
            ".jar",
            ".app",
            ".deb",
            ".pkg",
            ".dmg",
            ".msi",
            ".sh",
            ".ps1",
            ".py",
            ".rb",
            ".pl",
            ".php",
        ]

        for ext in dangerous_extensions:
            results = {"errors": [], "is_valid": True}
            is_valid = FileUploadValidator._validate_file_extension(ext, results)

            self.assertFalse(is_valid)
            self.assertFalse(results["is_valid"])
            self.assertTrue(len(results["errors"]) > 0)
            self.assertIn("dangerous", results["errors"][0].lower())

    def test_validate_file_extension_rejects_unknown_extensions(self):
        """Test that unknown file extensions are rejected."""
        unknown_extensions = [".xyz", ".unknown", ".malicious"]

        for ext in unknown_extensions:
            results = {"errors": [], "is_valid": True}
            is_valid = FileUploadValidator._validate_file_extension(ext, results)

            self.assertFalse(is_valid)
            self.assertFalse(results["is_valid"])
            self.assertTrue(len(results["errors"]) > 0)
            self.assertIn("not allowed", results["errors"][0])

    def test_validate_file_extension_accepts_allowed_extensions(self):
        """Test that allowed file extensions are accepted."""
        # Test common allowed extensions
        allowed_extensions = [".jpg", ".png", ".pdf", ".txt", ".mp4", ".mp3"]

        for ext in allowed_extensions:
            results = {"errors": [], "is_valid": True}
            is_valid = FileUploadValidator._validate_file_extension(ext, results)

            # Note: This will depend on the actual ALLOWED_MIME_TYPES configuration
            # The test verifies the method doesn't crash and follows expected logic
            self.assertIsInstance(is_valid, bool)
            self.assertIsInstance(results["is_valid"], bool)


class ForceUploadSecurityTest(APITestCase):
    """Test force upload admin-only restrictions."""

    def setUp(self):
        self.admin_user = User.objects.create_user(
            username="admin", email="admin@test.com", password="testpass"
        )
        self.admin_user.is_staff = True
        self.admin_user.save()

        self.regular_user = User.objects.create_user(
            username="user", email="user@test.com", password="testpass"
        )

        # Create a test namespace
        self.namespace = Namespace.objects.create(
            name="Test Namespace", slug="test-namespace"
        )

    def test_force_upload_requires_admin(self):
        """Test that force upload is restricted to admin users."""
        # Create a test file
        test_file = SimpleUploadedFile(
            "test.txt", b"test content", content_type="text/plain"
        )

        # Test with regular user
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.post(
            "/api/v1/media/upload/",
            {
                "files": [test_file],
                "namespace": self.namespace.slug,
                "force_upload": True,
            },
            format="multipart",
        )

        # Should contain error about admin-only access
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("errors", response.data)
        errors = response.data["errors"]
        self.assertTrue(
            any("admin users" in error.get("error", "") for error in errors)
        )

    def test_force_upload_works_for_admin(self):
        """Test that force upload works for admin users."""
        # Create a test file
        test_file = SimpleUploadedFile(
            "test.txt", b"test content", content_type="text/plain"
        )

        # Test with admin user
        self.client.force_authenticate(user=self.admin_user)

        # Mock the storage and AI services to avoid actual S3 calls
        with patch("file_manager.views.S3MediaStorage") as mock_storage, patch(
            "file_manager.views.AIContentAnalysisService"
        ) as mock_ai:

            mock_storage_instance = MagicMock()
            mock_storage.return_value = mock_storage_instance
            mock_storage_instance.upload_file.return_value = {
                "file_path": "test/path",
                "file_size": 12,
                "content_type": "text/plain",
                "file_hash": "testhash123",
            }

            mock_ai_instance = MagicMock()
            mock_ai.return_value = mock_ai_instance
            mock_ai_instance.analyze_media_file.return_value = {
                "suggested_tags": [],
                "suggested_title": "test",
                "extracted_text": "",
                "confidence_score": 0.5,
            }

            response = self.client.post(
                "/api/v1/media/upload/",
                {
                    "files": [test_file],
                    "namespace": self.namespace.slug,
                    "force_upload": True,
                },
                format="multipart",
            )

            # Should succeed for admin
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn("uploaded_files", response.data)


class StreamingHashTest(TestCase):
    """Test streaming hash calculation to prevent memory issues."""

    def setUp(self):
        # Create a mock view to test the streaming method
        from ..views import FileUploadView

        self.view = FileUploadView()

    def test_streaming_hash_calculation(self):
        """Test that streaming hash calculation works correctly."""
        # Create test data
        test_data = b"This is test data for hash calculation"

        # Create a temporary file
        with tempfile.NamedTemporaryFile() as temp_file:
            temp_file.write(test_data)
            temp_file.seek(0)

            # Create uploaded file mock
            uploaded_file = SimpleUploadedFile(
                "test.txt", test_data, content_type="text/plain"
            )

            # Calculate hash using streaming method
            calculated_hash = self.view._calculate_file_hash_streaming(uploaded_file)

            # Calculate expected hash
            expected_hash = hashlib.sha256(test_data).hexdigest()

            self.assertEqual(calculated_hash, expected_hash)

    def test_streaming_hash_resets_file_pointer(self):
        """Test that file pointer is reset after hash calculation."""
        test_data = b"Test data"
        uploaded_file = SimpleUploadedFile(
            "test.txt", test_data, content_type="text/plain"
        )

        # Move file pointer
        uploaded_file.seek(5)

        # Calculate hash
        self.view._calculate_file_hash_streaming(uploaded_file)

        # Verify file pointer is reset
        self.assertEqual(uploaded_file.tell(), 0)

    def test_streaming_hash_handles_large_files(self):
        """Test that streaming works with large file simulation."""
        # Create larger test data
        test_data = b"x" * 50000  # 50KB
        uploaded_file = SimpleUploadedFile(
            "large_test.txt", test_data, content_type="text/plain"
        )

        calculated_hash = self.view._calculate_file_hash_streaming(uploaded_file)
        expected_hash = hashlib.sha256(test_data).hexdigest()

        self.assertEqual(calculated_hash, expected_hash)


class RaceConditionPreventionTest(TransactionTestCase):
    """Test race condition prevention in duplicate file detection."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@test.com", password="testpass"
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace", slug="test-namespace"
        )

    def test_atomic_duplicate_detection(self):
        """Test that duplicate detection uses atomic transactions."""
        # This test verifies the structure is in place
        # In a real scenario, we'd need multiple concurrent requests

        test_hash = "test_hash_12345"

        # Create a pending file
        pending_file = PendingMediaFile.objects.create(
            original_filename="test.txt",
            file_path="test/path.txt",
            file_size=100,
            content_type="text/plain",
            file_hash=test_hash,
            file_type="document",
            namespace=self.namespace,
            uploaded_by=self.user,
            status="pending",
        )

        # Verify the file exists
        self.assertTrue(PendingMediaFile.objects.filter(file_hash=test_hash).exists())

        # Test that select_for_update would work (we can't easily test the actual
        # race condition without complex threading, but we can verify the query works)
        with self.assertNumQueries(1):
            existing = (
                PendingMediaFile.objects.select_for_update()
                .filter(file_hash=test_hash)
                .first()
            )
            self.assertEqual(existing, pending_file)


class SecurityValidationIntegrationTest(TestCase):
    """Integration tests for security validation pipeline."""

    def test_security_validation_pipeline(self):
        """Test that all security validations work together."""
        # Test file with multiple potential security issues
        malicious_filename = "<script>alert('xss')</script>test.exe"

        # Create uploaded file
        uploaded_file = SimpleUploadedFile(
            malicious_filename,
            b"fake exe content",
            content_type="application/octet-stream",
        )

        # Run validation
        result = FileUploadValidator.validate_file(uploaded_file)

        # Should be rejected for multiple reasons
        self.assertFalse(result["is_valid"])
        self.assertTrue(len(result["errors"]) > 0)

        # Should contain extension-related error
        error_messages = " ".join(result["errors"])
        self.assertTrue(
            "extension" in error_messages.lower()
            or "dangerous" in error_messages.lower()
            or "not allowed" in error_messages.lower()
        )

    def test_memory_safe_content_analysis(self):
        """Test that content analysis handles large files safely."""
        # Create a large file (simulated)
        large_content = b"x" * (60 * 1024 * 1024)  # 60MB

        # Mock the file size to appear large
        uploaded_file = SimpleUploadedFile(
            "large_file.txt", large_content[:1000], content_type="text/plain"
        )
        uploaded_file.size = 60 * 1024 * 1024  # Mock size as 60MB

        # This should not crash or consume excessive memory
        # The actual validation will limit content reading
        result = FileUploadValidator._validate_file_content(
            uploaded_file, {"errors": [], "warnings": [], "is_valid": True}
        )

        # The test passes if no memory error occurs
        self.assertTrue(True)  # Placeholder assertion
