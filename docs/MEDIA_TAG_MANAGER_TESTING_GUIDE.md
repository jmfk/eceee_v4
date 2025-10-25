# Media Tag Manager Testing Guide

## Prerequisites

1. Docker services running:
   ```bash
   docker-compose up db redis -d
   docker-compose up backend
   docker-compose up frontend
   ```

2. Admin user created:
   ```bash
   docker-compose exec backend python manage.py createsuperuser
   ```

3. At least one namespace created
4. Some media files uploaded with tags

## Backend API Testing

### 1. Test Tag CRUD Operations

#### List Tags
```bash
curl -X GET "http://localhost:8000/api/v1/media/tags/?namespace=default" \
  -H "Authorization: Token YOUR_TOKEN"
```

Expected: 200 OK with list of tags

#### Create Tag
```bash
curl -X POST "http://localhost:8000/api/v1/media/tags/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Token YOUR_TOKEN" \
  -d '{
    "name": "Test Tag",
    "slug": "test-tag",
    "color": "#FF5733",
    "description": "A test tag",
    "namespace": "default"
  }'
```

Expected: 201 Created with tag object

#### Update Tag
```bash
curl -X PATCH "http://localhost:8000/api/v1/media/tags/{TAG_ID}/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Token YOUR_TOKEN" \
  -d '{
    "name": "Updated Tag",
    "color": "#33FF57"
  }'
```

Expected: 200 OK with updated tag object

#### Delete Tag
```bash
curl -X DELETE "http://localhost:8000/api/v1/media/tags/{TAG_ID}/" \
  -H "Authorization: Token YOUR_TOKEN"
```

Expected: 204 No Content

### 2. Test New Custom Actions

#### Get Tag Usage Statistics
```bash
curl -X GET "http://localhost:8000/api/v1/media/tags/usage_stats/?namespace=default" \
  -H "Authorization: Token YOUR_TOKEN"
```

Expected: 200 OK with tags annotated with `usage_count` field

#### Get Files for a Tag
```bash
curl -X GET "http://localhost:8000/api/v1/media/tags/{TAG_ID}/files/" \
  -H "Authorization: Token YOUR_TOKEN"
```

Expected: 200 OK with paginated list of media files

#### Merge Tags
```bash
curl -X POST "http://localhost:8000/api/v1/media/tags/merge_tags/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Token YOUR_TOKEN" \
  -d '{
    "target_tag_id": "{TARGET_TAG_ID}",
    "source_tag_ids": ["{SOURCE_TAG_ID_1}", "{SOURCE_TAG_ID_2}"]
  }'
```

Expected: 200 OK with merge results (files_transferred, tags_deleted)

#### Bulk Delete Tags
```bash
curl -X POST "http://localhost:8000/api/v1/media/tags/bulk_delete/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Token YOUR_TOKEN" \
  -d '{
    "tag_ids": ["{TAG_ID_1}", "{TAG_ID_2}"]
  }'
```

Expected: 200 OK with deletion count

## Frontend UI Testing

### 1. Access Tag Manager

1. Navigate to http://localhost:3000
2. Log in with admin credentials
3. Go to Media Manager page
4. Click "Tags" tab

**Expected:** Tag management interface loads with tag list

### 2. Create New Tag

1. Click "Create Tag" button
2. Enter tag name: "UI Test Tag"
3. Observe slug auto-generation
4. Select a color using color picker
5. Enter description (optional)
6. Click "Create Tag"

**Expected:** 
- Success notification appears
- Tag appears in list
- Modal closes

### 3. Edit Existing Tag

1. Find a tag in the list
2. Click edit icon (pencil)
3. Change name, color, or description
4. Click "Update Tag"

**Expected:**
- Success notification appears
- Changes reflected in list
- Modal closes

### 4. View Files by Tag

1. Find a tag with files (usage count > 0)
2. Click on the file count badge
3. Observe MediaBrowser opens filtered by that tag

**Expected:**
- MediaBrowser shows only files with that tag
- "Back to Tags" button appears
- Clicking "Back to Tags" returns to tag list

### 5. Search Tags

1. Enter text in search bar
2. Wait 300ms (debounce delay)

**Expected:**
- Tag list filters to matching tags
- No tags found message if no matches

### 6. Sort Tags

1. Change sort dropdown to "Usage Count"
2. Observe tags reorder by usage count (descending)
3. Change to "Name"
4. Observe tags reorder alphabetically

**Expected:**
- Tags reorder correctly based on sort option
- Page resets to 1 when sorting changes

### 7. Bulk Select Tags

1. Click checkbox on multiple tags
2. Observe bulk actions bar appears
3. Selected count shows correctly

**Expected:**
- Checkboxes toggle correctly
- Selected tags highlighted
- Bulk actions bar shows count

### 8. Merge Tags

1. Select 2 or more tags
2. Click "Merge Tags"
3. Select target tag from dropdown
4. Review source tags list
5. Review transfer statistics
6. Confirm merge

**Expected:**
- Merge modal shows
- Source tags listed correctly
- File count totals correct
- After merge:
  - Success notification
  - Source tags removed from list
  - Target tag file count updated
  - Selection cleared

### 9. Bulk Delete Tags

1. Select one or more tags
2. Click "Delete Selected"
3. Confirm deletion

**Expected:**
- Confirmation dialog appears
- After confirmation:
  - Success notification
  - Tags removed from list
  - Selection cleared

### 10. Delete Single Tag

1. Find a tag
2. Click delete icon (trash)
3. Confirm deletion

**Expected:**
- Confirmation dialog appears
- After confirmation:
  - Success notification
  - Tag removed from list

### 11. Pagination

1. If more than 20 tags exist:
2. Observe pagination controls
3. Click "Next" button
4. Click "Previous" button

**Expected:**
- Pagination shows correct page numbers
- Tags load for each page
- Buttons disabled appropriately

## Edge Cases to Test

### Backend

1. **Merge tags from different namespaces**
   - Expected: 400 Bad Request with error message

2. **Merge with non-existent target tag**
   - Expected: 404 Not Found

3. **Delete tag without permission**
   - Expected: 403 Forbidden

4. **Create tag with duplicate name**
   - Expected: 400 Bad Request with validation error

5. **Get files for tag with no files**
   - Expected: 200 OK with empty results array

### Frontend

1. **Create tag with empty name**
   - Expected: Browser validation prevents submission

2. **Search with special characters**
   - Expected: No errors, filters correctly

3. **Select all tags, then merge**
   - Expected: Merge button disabled or shows appropriate error

4. **Navigate away with unsaved changes in modal**
   - Expected: Modal closes without saving

5. **Network error during operation**
   - Expected: Error notification displayed

## Performance Testing

1. **Load tag list with 100+ tags**
   - Expected: Pagination works, no lag

2. **Search with rapid typing**
   - Expected: Debounce prevents excessive API calls

3. **Merge tags with 1000+ files**
   - Expected: Operation completes successfully (may take time)

## Integration Testing

1. **Create tag, add to file, view files by tag**
   - Expected: Full workflow works end-to-end

2. **Create tag in one namespace, verify isolation**
   - Expected: Tags only visible in their namespace

3. **Delete tag, verify removed from all files**
   - Expected: Tag removed from file associations

4. **Merge tags, verify file associations transferred**
   - Expected: Target tag has all files from source tags

## Automated Testing

Run backend tests:
```bash
docker-compose exec backend python manage.py test file_manager.tests.test_api.MediaTagAPITest
```

Run frontend tests (if created):
```bash
docker-compose exec frontend npm test -- MediaTagManager
```

## Checklist

- [ ] All CRUD operations work
- [ ] Usage statistics accurate
- [ ] Files by tag displays correctly
- [ ] Search and sort work
- [ ] Pagination works
- [ ] Bulk selection works
- [ ] Merge tags transfers files correctly
- [ ] Bulk delete removes all selected tags
- [ ] Namespace isolation works
- [ ] Error handling works
- [ ] No console errors
- [ ] No linting errors
- [ ] Mobile responsive
- [ ] Accessibility (keyboard navigation)

## Common Issues and Solutions

### Issue: Tags not loading
**Solution:** Check namespace is selected, verify API endpoint is correct

### Issue: Merge button disabled
**Solution:** Ensure at least 2 tags are selected

### Issue: File count doesn't match
**Solution:** Refresh browser, check backend data consistency

### Issue: Color picker not working
**Solution:** Check browser compatibility, try entering hex code directly

### Issue: Search not working
**Solution:** Wait for debounce delay (300ms), check console for errors

## Success Criteria

✅ All tag CRUD operations work without errors
✅ Usage statistics display correctly
✅ File viewing by tag works
✅ Merge operation transfers files correctly
✅ Bulk delete removes all tags and associations
✅ Search and filtering work as expected
✅ UI is responsive and user-friendly
✅ No console errors or linting issues
✅ Namespace isolation enforced

