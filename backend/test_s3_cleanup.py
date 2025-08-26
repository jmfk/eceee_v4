#!/usr/bin/env python3
"""
Test script to verify S3 cleanup functionality for rejected files.

This script tests that rejected files are properly cleaned up from S3
when they don't exist in MediaFile, but preserved when they do.
"""

import os
import sys
import django
import hashlib
from io import BytesIO
from django.core.files.uploadedfile import SimpleUploadedFile

# Setup Django
sys.path.append('/Users/jmfk/code/eceee_v4/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from file_manager.models import MediaFile, PendingMediaFile
from file_manager.storage import S3MediaStorage
from content.models import Namespace
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

def create_test_file(content="Test file content for S3 cleanup"):
    """Create a test file with specific content."""
    file_content = content.encode('utf-8')
    file_hash = hashlib.sha256(file_content).hexdigest()
    
    uploaded_file = SimpleUploadedFile(
        name="test_s3_cleanup.txt",
        content=file_content,
        content_type="text/plain"
    )
    
    return uploaded_file, file_hash, file_content

def test_s3_cleanup():
    """Test the S3 cleanup functionality."""
    print("🧪 Testing S3 Cleanup for Rejected Files")
    print("=" * 50)
    
    # Get or create test user and namespace
    user, _ = User.objects.get_or_create(username='testuser', defaults={'email': 'test@example.com'})
    namespace = Namespace.get_default()
    storage = S3MediaStorage()
    
    print(f"📁 Using namespace: {namespace.name}")
    print(f"👤 Using user: {user.username}")
    
    # Test 1: Reject pending file when no MediaFile exists - should delete from S3
    print("\n🔄 Test 1: Reject pending file (no MediaFile exists)")
    
    test_file1, file_hash1, file_content1 = create_test_file("Test content 1")
    
    try:
        # Upload to S3
        upload_result1 = storage.upload_file(test_file1, "test-cleanup")
        print(f"✅ Uploaded to S3: {upload_result1['file_path']}")
        
        # Create PendingMediaFile
        pending_file1 = PendingMediaFile.objects.create(
            original_filename="test1.txt",
            file_path=upload_result1["file_path"],
            file_size=len(file_content1),
            content_type="text/plain",
            file_hash=file_hash1,
            file_type="other",
            namespace=namespace,
            uploaded_by=user,
            expires_at=timezone.now() + timedelta(hours=24)
        )
        print(f"✅ Created PendingMediaFile: {pending_file1.id}")
        
        # Verify file exists in S3
        file_info = storage.get_file_info(upload_result1["file_path"])
        if file_info:
            print(f"✅ File exists in S3 before rejection")
        else:
            print(f"❌ File not found in S3 before rejection")
        
        # Reject the file
        pending_file1.reject()
        print(f"✅ Rejected PendingMediaFile")
        
        # Check if file was deleted from S3
        file_info_after = storage.get_file_info(upload_result1["file_path"])
        if file_info_after:
            print(f"❌ File still exists in S3 after rejection (unexpected)")
        else:
            print(f"✅ File correctly deleted from S3 after rejection")
            
    except Exception as e:
        print(f"❌ Test 1 failed: {e}")
    
    # Test 2: Reject pending file when MediaFile exists - should NOT delete from S3
    print("\n🔄 Test 2: Reject pending file (MediaFile exists)")
    
    test_file2, file_hash2, file_content2 = create_test_file("Test content 2")
    
    try:
        # Upload to S3
        upload_result2 = storage.upload_file(test_file2, "test-cleanup")
        print(f"✅ Uploaded to S3: {upload_result2['file_path']}")
        
        # Create MediaFile first (approved file)
        media_file = MediaFile.objects.create(
            title="Test Media File",
            slug="test-media-file",
            original_filename="test2.txt",
            file_path=upload_result2["file_path"],
            file_size=len(file_content2),
            content_type="text/plain",
            file_hash=file_hash2,
            file_type="other",
            namespace=namespace,
            created_by=user,
            last_modified_by=user
        )
        print(f"✅ Created MediaFile: {media_file.title}")
        
        # Create PendingMediaFile with same hash
        pending_file2 = PendingMediaFile.objects.create(
            original_filename="test2_duplicate.txt",
            file_path=upload_result2["file_path"],
            file_size=len(file_content2),
            content_type="text/plain",
            file_hash=file_hash2,
            file_type="other",
            namespace=namespace,
            uploaded_by=user,
            expires_at=timezone.now() + timedelta(hours=24)
        )
        print(f"✅ Created PendingMediaFile with same hash: {pending_file2.id}")
        
        # Reject the pending file
        pending_file2.reject()
        print(f"✅ Rejected PendingMediaFile")
        
        # Check if file still exists in S3 (should exist because MediaFile uses it)
        file_info_after = storage.get_file_info(upload_result2["file_path"])
        if file_info_after:
            print(f"✅ File correctly preserved in S3 (MediaFile still uses it)")
        else:
            print(f"❌ File incorrectly deleted from S3 (MediaFile needs it)")
            
    except Exception as e:
        print(f"❌ Test 2 failed: {e}")
    
    # Test 3: Multiple pending files with same hash
    print("\n🔄 Test 3: Multiple pending files with same hash")
    
    test_file3, file_hash3, file_content3 = create_test_file("Test content 3")
    
    try:
        # Upload to S3
        upload_result3 = storage.upload_file(test_file3, "test-cleanup")
        print(f"✅ Uploaded to S3: {upload_result3['file_path']}")
        
        # Create two PendingMediaFiles with same hash
        pending_file3a = PendingMediaFile.objects.create(
            original_filename="test3a.txt",
            file_path=upload_result3["file_path"],
            file_size=len(file_content3),
            content_type="text/plain",
            file_hash=file_hash3,
            file_type="other",
            namespace=namespace,
            uploaded_by=user,
            expires_at=timezone.now() + timedelta(hours=24)
        )
        
        pending_file3b = PendingMediaFile.objects.create(
            original_filename="test3b.txt",
            file_path=upload_result3["file_path"],
            file_size=len(file_content3),
            content_type="text/plain",
            file_hash=file_hash3,
            file_type="other",
            namespace=namespace,
            uploaded_by=user,
            expires_at=timezone.now() + timedelta(hours=24)
        )
        print(f"✅ Created two PendingMediaFiles: {pending_file3a.id}, {pending_file3b.id}")
        
        # Reject the first one
        pending_file3a.reject()
        print(f"✅ Rejected first PendingMediaFile")
        
        # Check if file still exists in S3 (should exist because second pending file uses it)
        file_info_after = storage.get_file_info(upload_result3["file_path"])
        if file_info_after:
            print(f"✅ File correctly preserved in S3 (other PendingMediaFile still uses it)")
        else:
            print(f"❌ File incorrectly deleted from S3 (other PendingMediaFile needs it)")
        
        # Reject the second one
        pending_file3b.reject()
        print(f"✅ Rejected second PendingMediaFile")
        
        # Now check if file is deleted from S3 (should be deleted now)
        file_info_final = storage.get_file_info(upload_result3["file_path"])
        if file_info_final:
            print(f"❌ File still exists in S3 after rejecting all references")
        else:
            print(f"✅ File correctly deleted from S3 after rejecting all references")
            
    except Exception as e:
        print(f"❌ Test 3 failed: {e}")
    
    # Cleanup
    print("\n🧹 Cleaning up test data...")
    try:
        # Clean up database records
        MediaFile.objects.filter(file_hash__in=[file_hash1, file_hash2, file_hash3]).delete()
        PendingMediaFile.objects.filter(file_hash__in=[file_hash1, file_hash2, file_hash3]).delete()
        
        # Clean up any remaining S3 files
        for upload_result in [upload_result1, upload_result2, upload_result3]:
            try:
                storage.delete_file(upload_result["file_path"])
            except:
                pass  # File might already be deleted
        
        print("✅ Cleanup completed")
    except Exception as e:
        print(f"⚠️  Cleanup warning: {e}")
    
    print("\n🎉 S3 cleanup test completed!")
    print("=" * 50)

if __name__ == "__main__":
    test_s3_cleanup()
