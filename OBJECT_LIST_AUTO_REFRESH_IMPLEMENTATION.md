# Object List Auto-Refresh Implementation

## ✅ Problem Solved

The object list now automatically updates when objects are published, unpublished, scheduled, or have their featured status changed.

## Implementation Summary

### Changes Made

**File: `frontend/src/components/objectEdit/ObjectPublishingView.jsx`**

Added `queryClient.invalidateQueries({ queryKey: ['objectInstances'] })` to all publishing mutations:

1. **publishMutation** (line 65)
   - Triggers when: User publishes a version
   - Now invalidates: Both single object AND object list
   
2. **unpublishMutation** (line 91)
   - Triggers when: User unpublishes a version  
   - Now invalidates: Both single object AND object list

3. **scheduleMutation** (line 123)
   - Triggers when: User schedules future publication
   - Now invalidates: Both single object AND object list

4. **toggleFeaturedMutation** (line 144)
   - Triggers when: User toggles featured status
   - Now invalidates: Both single object AND object list

### Already Working

These mutations were already invalidating the list correctly:

**In ObjectInstanceEditPage:**
- ✅ Create object (line 73)
- ✅ Save/update object (lines 99-100)

**In ObjectBrowser:**
- ✅ Delete object (lines 66-67)

## How It Works

### React Query Cache Invalidation

When you call `queryClient.invalidateQueries({ queryKey: ['objectInstances'] })`:

1. **React Query marks all queries with that key as stale**
2. **If the component using that query is mounted**, it automatically refetches
3. **If the component is unmounted**, it refetches when you return to it
4. **The UI updates automatically** with the new data

### Example Flow

**User publishes an object:**
```
1. Click "Publish Now" in Publishing tab
2. publishMutation.mutate() executes
3. API call succeeds
4. onSuccess callback runs:
   - Shows success notification ✅
   - Invalidates ['objectInstance', id] - updates the editor
   - Invalidates ['objectInstances'] - updates the list  
5. If ObjectBrowser is visible, it automatically refetches
6. List updates with new "published" status ✅
```

## Testing

### Test Publish
1. Open an object in the editor
2. Go to Publishing tab
3. Publish the object
4. Navigate back to the object list (/objects/{typeName})
5. ✅ Status should show "published" (green badge)

### Test Unpublish
1. Unpublish an object
2. Return to list
3. ✅ Status should show "draft" (yellow badge)

### Test Edit
1. Edit object title or data
2. Save
3. Return to list
4. ✅ Changes should be visible immediately

### Test Delete
1. Delete an object from the list
2. ✅ Should disappear immediately

## Additional Fix: Computed Status Field

Also fixed the status display by making it computed in the backend:

**File: `backend/object_storage/serializers.py`**

Changed `status` from static database field to computed field:

```python
status = serializers.SerializerMethodField()

def get_status(self, obj):
    """Return computed publication status based on current published version"""
    current_version = obj.get_current_published_version()
    
    if current_version:
        return "published"  # Has live version
    
    # Check for scheduled
    latest_version = obj.get_latest_version()
    if latest_version and latest_version.effective_date:
        if latest_version.effective_date > timezone.now():
            return "scheduled"
    
    return "draft"
```

Now the status accurately reflects:
- ✅ "published" - Has a currently published version
- 📅 "scheduled" - Has future effective_date
- 📝 "draft" - No published version

## Result

✅ Object list automatically refreshes after any change
✅ Status badges accurately reflect publication state
✅ No manual page refresh needed
✅ Works even when navigating between tabs
✅ Efficient (no polling, only refetch when needed)

Perfect for single-user editing! For multi-user real-time updates, UDC subscriptions could be added later if needed.

