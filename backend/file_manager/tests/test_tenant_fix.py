"""
Tests for missing tenant_id during media file approval.
"""

import uuid
import hashlib
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaFile, PendingMediaFile


class MediaApprovalTenantFixTests(TestCase):
    """Test cases for the tenant_id fix during media file approval."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser_fix", password="testpass")
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            identifier="test-tenant-fix",
            created_by=self.user
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            created_by=self.user,
            tenant=self.tenant
        )
        self.test_hash = hashlib.sha256(b"test content fix").hexdigest()
        self.client.force_authenticate(user=self.user)

    def test_approve_existing_file_without_tenant(self):
        """
        Test that approving a pending file when an existing MediaFile 
        is missing tenant_id correctly assigns the tenant.
        """
        # Create an existing MediaFile WITHOUT tenant_id (bypassing model validation if possible, 
        # or simulate the state where it might be null if the column was added later)
        # Since the model has tenant as non-nullable, we might need to use .update() to set it to null
        # if the database allows it, or just test that our fix handles it if it were null.
        
        existing_file = MediaFile.objects.create(
            title="Existing File",
            original_filename="test.jpg",
            file_path="test/test.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_type="image",
            file_hash=self.test_hash,
            namespace=self.namespace,
            tenant=self.tenant, # Initially created with tenant
            created_by=self.user,
            last_modified_by=self.user,
        )
        
        # Manually set tenant_id to NULL to simulate the problematic state
        # Use a raw SQL update to bypass Django's validation if needed, 
        # but even SQLite might enforce NOT NULL if the schema says so.
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute(f"UPDATE file_manager_mediafile SET tenant_id = NULL WHERE id = '{existing_file.id.hex}'")
        
        existing_file.refresh_from_db()
        self.assertIsNone(existing_file.tenant_id)
        
        # Create a pending file with same hash
        pending = PendingMediaFile.objects.create(
            original_filename="new_test.jpg",
            file_path="test/test.jpg",
            file_size=1000,
            content_type="image/jpeg",
            file_hash=self.test_hash,
            file_type="image",
            namespace=self.namespace,
            uploaded_by=self.user,
            expires_at=timezone.now() + timezone.timedelta(hours=24),
        )
        
        # Approve pending file via API
        url = f"/api/v1/media/pending-files/{pending.id}/approve/"
        data = {
            "title": "Approved File",
            "tag_ids": [] # Will be handled by serializer context if needed, but we just need the merge logic
        }
        
        # We need to provide at least one tag because of serializer validation
        from file_manager.models import MediaTag
        tag = MediaTag.objects.create(name="Test Tag", slug="test-tag", namespace=self.namespace, created_by=self.user)
        data["tag_ids"] = [str(tag.id)]
        
        response = self.client.post(url, data, format='json')
        
        # Check response
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "approved")
        
        # Verify existing file now has the tenant
        existing_file.refresh_from_db()
        self.assertIsNotNone(existing_file.tenant_id)
        self.assertEqual(existing_file.tenant_id, self.tenant.id)
