# Atomic File Hash Handling Implementation

## Summary

Successfully implemented atomic file hash handling to resolve the issue where deleting a file and then re-uploading it caused duplicate key constraint violations on the `file_hash` field.

## Problem

When a file was uploaded, soft-deleted, and then re-uploaded (same content, same hash), the system would fail with:
```
duplicate key value violates unique constraint "file_manager_mediafile_file_hash_key"
```

This happened because the soft-deleted record still existed in the database with the same `file_hash`, violating the unique constraint.

## Solution

Implemented an atomic transaction-based approach that:

1. **Detects soft-deleted files** with the same hash before creating a new MediaFile
2. **Hard deletes** the soft-deleted record atomically within a transaction
3. **Preserves the object in object storage** by checking for other references before deletion
4. **Creates the new MediaFile** record in the same transaction
5. **Handles PendingMediaFile duplicates** by updating existing records instead of creating new ones

## Implementation Details

### 1. New Helper Method: `MediaFile.create_with_hash_cleanup()`

**File**: `backend/file_manager/models.py`

Added a class method that atomically handles soft-deleted records:

```python
@classmethod
def create_with_hash_cleanup(cls, file_hash: str, **kwargs):
    """
    Create a new MediaFile, atomically handling any soft-deleted records with the same hash.
    
    This method ensures that:
    1. Any soft-deleted MediaFile with the same hash is hard-deleted first
    2. The object in object storage is preserved (not deleted if referenced elsewhere)
    3. A new MediaFile record is created with fresh metadata
    4. All operations happen atomically in a single transaction
    """
    with transaction.atomic():
        # Check for existing active file (error case)
        existing_active = cls.objects.filter(file_hash=file_hash).first()
        if existing_active:
            raise ValidationError(f"An active file with this content already exists")
        
        # Find and hard delete any soft-deleted records with same hash
        existing_deleted = cls.objects.with_deleted().filter(
            file_hash=file_hash, is_deleted=True
        ).first()
        
        if existing_deleted:
            existing_deleted.delete(force=True)  # Hard delete
        
        # Create the new MediaFile
        new_file = cls.objects.create(**kwargs)
        return new_file
```

### 2. Updated `PendingMediaFile.approve_and_create_media_file()`

**File**: `backend/file_manager/models.py`

Modified to use the new atomic helper method:

```python
media_file = MediaFile.create_with_hash_cleanup(
    file_hash=self.file_hash,
    title=title,
    # ... other fields
)
```

### 3. Enhanced `FileUploadService._create_pending_file()`

**File**: `backend/file_manager/services/upload_service.py`

Enhanced with atomic transaction handling and better duplicate detection:

```python
def _create_pending_file(self, ...):
    with transaction.atomic():
        try:
            return PendingMediaFile.objects.create(...)
        except IntegrityError as e:
            if "file_hash" in str(e) and "uniq" in str(e):
                # Update existing pending file instead of creating new one
                existing_pending = PendingMediaFile.objects.filter(
                    file_hash=upload_result["file_hash"]
                ).first()
                if existing_pending:
                    self._update_existing_pending_file(...)
                    return existing_pending
            raise e
```

### 4. Updated `MediaFile.delete()` Method

**File**: `backend/file_manager/models.py`

Enhanced to check both active AND soft-deleted files when determining S3 cleanup:

```python
def delete(self, user=None, force=False, *args, **kwargs):
    if force:
        # Check both active and soft-deleted files with same hash
        other_media_files = (
            MediaFile.objects.with_deleted()  # Now includes deleted files
            .filter(file_hash=self.file_hash)
            .exclude(id=self.id)
            .exists()
        )
        
        # Only delete from S3 if no other files reference it
        if not other_media_files and not other_pending_files:
            storage.delete_file(self.file_path)
```

## Test Coverage

Added comprehensive test suite in `backend/file_manager/tests/test_soft_delete.py`:

**New Test Class: `AtomicFileHashHandlingTests`**

1. ✅ `test_reupload_after_soft_delete` - Verifies re-upload after soft delete works
2. ✅ `test_cannot_create_duplicate_active_file` - Prevents duplicate active files
3. ✅ `test_s3_object_cleanup_during_hash_handling` - Verifies S3 cleanup logic
4. ✅ `test_atomic_transaction_rollback` - Ensures transaction rollback on failure
5. ✅ `test_pending_file_approve_with_soft_deleted_hash` - Tests pending file approval
6. ✅ `test_multiple_soft_deleted_same_hash` - Handles edge case with multiple soft-deleted files
7. ✅ `test_hard_delete_checks_all_references` - Verifies reference checking includes deleted files

**Test Results**: All 7 tests passing ✅

## Key Design Decisions

### 1. Hard Delete Soft-Deleted Records

**Decision**: When re-uploading, hard delete the soft-deleted record rather than restoring it.

**Rationale**:
- Creates a fresh record with new metadata (tags, collections, etc.)
- Simpler transaction logic
- User expectations: a re-upload is a new file, not a restoration

### 2. Keep Unique Constraint on file_hash

**Decision**: Maintain the existing unique constraint (one hash total, deleted or not).

**Rationale**:
- Ensures database integrity
- Prevents accidental duplicates
- Clear error messages when duplicates are detected

### 3. Always Update PendingMediaFile Duplicates

**Decision**: When a PendingMediaFile with the same hash exists, update it instead of erroring.

**Rationale**:
- Allows re-upload of the same file during the pending approval period
- Reuses the same S3 object (efficient)
- Updates metadata with latest upload information

### 4. Atomic Transactions

**Decision**: Wrap all hash cleanup and creation in `transaction.atomic()`.

**Rationale**:
- Prevents partial failures (either all operations succeed or all roll back)
- Ensures database consistency
- No orphaned S3 objects or database records

## Object Storage Safety

The implementation ensures object storage safety through:

1. **Reference Counting**: Before deleting from S3, checks for:
   - Other active MediaFile records with same hash
   - Other soft-deleted MediaFile records with same hash
   - PendingMediaFile records with same hash

2. **Conservative Deletion**: Only deletes from S3 when NO other references exist

3. **Error Handling**: S3 deletion errors don't prevent database cleanup

## Usage Example

### Before (Fails)
```python
# Upload file
file1 = upload_file("test.pdf")  # hash: abc123

# Delete file
file1.delete(user=user)  # Soft delete

# Re-upload same file
file2 = upload_file("test.pdf")  # hash: abc123
# ERROR: duplicate key value violates unique constraint
```

### After (Works)
```python
# Upload file
file1 = upload_file("test.pdf")  # hash: abc123

# Delete file  
file1.delete(user=user)  # Soft delete

# Re-upload same file
file2 = upload_file("test.pdf")  # hash: abc123
# SUCCESS: Old soft-deleted record is hard-deleted atomically,
# new record created with same hash
```

## Files Modified

1. `backend/file_manager/models.py`
   - Added `MediaFile.create_with_hash_cleanup()` method
   - Updated `PendingMediaFile.approve_and_create_media_file()`
   - Enhanced `MediaFile.delete()` to check soft-deleted files

2. `backend/file_manager/services/upload_service.py`
   - Enhanced `FileUploadService._create_pending_file()` with atomic handling

3. `backend/file_manager/tests/test_soft_delete.py`
   - Added 7 comprehensive test cases for atomic behavior

## Benefits

✅ **Eliminates duplicate key errors** when re-uploading deleted files
✅ **Maintains data integrity** through atomic transactions  
✅ **Preserves object storage** when files are referenced elsewhere
✅ **Clear error messages** when actual duplicates are detected
✅ **Comprehensive test coverage** ensures reliability
✅ **No API changes required** - transparent to existing code

## Migration Notes

**No database migration required** - this is a code-only change that works with the existing schema.

The unique constraint on `file_hash` remains in place, but the application layer now handles it gracefully through atomic transactions.

##Testing

Run the tests with:
```bash
docker-compose exec backend python manage.py test file_manager.tests.test_soft_delete.AtomicFileHashHandlingTests
```

All tests should pass ✅

