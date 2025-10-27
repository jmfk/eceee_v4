"""
Tests for table import functionality
"""

import io
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class TableImportTests(TestCase):
    """Test table import API endpoint"""

    def setUp(self):
        """Set up test client and user"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

    def test_import_csv_file(self):
        """Test importing a simple CSV file"""
        csv_content = b"Name,Age,City\nJohn,30,NYC\nJane,25,LA"
        csv_file = io.BytesIO(csv_content)
        csv_file.name = "test.csv"

        response = self.client.post(
            "/api/file-manager/import-table/", {"file": csv_file}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("rows", response.data)
        self.assertEqual(len(response.data["rows"]), 3)  # Header + 2 data rows
        self.assertEqual(len(response.data["rows"][0]["cells"]), 3)  # 3 columns

        # Check first cell content
        self.assertEqual(response.data["rows"][0]["cells"][0]["content"], "Name")
        self.assertEqual(response.data["rows"][1]["cells"][0]["content"], "John")

    def test_import_csv_with_empty_cells(self):
        """Test importing CSV with empty cells"""
        csv_content = b"A,B,C\n1,,3\n,2,"
        csv_file = io.BytesIO(csv_content)
        csv_file.name = "test.csv"

        response = self.client.post(
            "/api/file-manager/import-table/", {"file": csv_file}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["rows"]), 3)
        # Empty cells should have empty string content
        self.assertEqual(response.data["rows"][1]["cells"][1]["content"], "")

    def test_import_without_file(self):
        """Test error when no file is provided"""
        response = self.client.post("/api/file-manager/import-table/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_import_invalid_file_type(self):
        """Test error with invalid file type"""
        txt_content = b"This is not a table file"
        txt_file = io.BytesIO(txt_content)
        txt_file.name = "test.txt"

        response = self.client.post(
            "/api/file-manager/import-table/", {"file": txt_file}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertIn("Invalid file type", response.data["error"])

    def test_import_requires_authentication(self):
        """Test that endpoint requires authentication"""
        self.client.force_authenticate(user=None)

        csv_content = b"A,B\n1,2"
        csv_file = io.BytesIO(csv_content)
        csv_file.name = "test.csv"

        response = self.client.post(
            "/api/file-manager/import-table/", {"file": csv_file}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_csv_encoding_detection(self):
        """Test that CSV encoding is properly detected"""
        # UTF-8 with BOM
        csv_content = "\ufeffName,Value\nTest,123".encode("utf-8-sig")
        csv_file = io.BytesIO(csv_content)
        csv_file.name = "test.csv"

        response = self.client.post(
            "/api/file-manager/import-table/", {"file": csv_file}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["rows"][0]["cells"][0]["content"], "Name")
