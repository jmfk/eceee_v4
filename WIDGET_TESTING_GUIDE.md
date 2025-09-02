# Widget System Testing Guide

This guide helps you test all three integrated widget features:
1. **React Widget Editor Components** (#110)
2. **Standardized Widget Backend APIs** (#112)
3. **Widget Preview System** (#113)

## Quick Start

### Automated Testing
```bash
# Run comprehensive test suite
./test_widget_system.sh
```

### Manual Testing Setup
```bash
# 1. Start all services
docker-compose up -d

# 2. Start frontend dev server
cd frontend && npm run dev

# 3. Open browser
open http://localhost:5173
```

## Feature Testing Checklist

### 1. React Widget Editor Components (#110)

#### Test Specialized Editors
- [ ] Navigate to Page Editor
- [ ] Add a new widget to a page
- [ ] Test each widget type editor:
  - [ ] **Text Block**: Rich text formatting, alignment controls
  - [ ] **Image**: Upload, alt text, caption fields
  - [ ] **Button**: Style selector, link configuration
  - [ ] **Gallery**: Multiple image management
  - [ ] **HTML Block**: Code editor with syntax highlighting
  - [ ] **Events**: Date/time pickers, location fields
  - [ ] **Forms**: Field configuration, validation rules

#### Verify Editor Features
- [ ] Field validation shows inline errors
- [ ] Changes trigger real-time validation
- [ ] Custom UI controls work (color pickers, dropdowns, etc.)
- [ ] DefaultEditor fallback works for unknown types

### 2. Widget Backend APIs (#112)

#### Test API Endpoints via curl or Postman

##### List Widget Types
```bash
curl -X GET http://localhost:8000/api/webpages/widgets/types/
```
- [ ] Returns all registered widget types
- [ ] Includes configuration schemas
- [ ] Search filter works (`?search=text`)

##### Get Widget Type Details
```bash
curl -X GET http://localhost:8000/api/webpages/widgets/types/text-block/
```
- [ ] Returns widget configuration schema
- [ ] Includes default values
- [ ] Shows CSS variables

##### Validate Widget Configuration
```bash
curl -X POST http://localhost:8000/api/webpages/widgets/types/text-block/validate/ \
  -H "Content-Type: application/json" \
  -d '{
    "configuration": {
      "title": "Test Title",
      "content": "Test content",
      "alignment": "left"
    }
  }'
```
- [ ] Valid config returns `is_valid: true`
- [ ] Invalid config returns detailed errors
- [ ] Pydantic validation works

##### Widget CRUD Operations
```bash
# Create widget
curl -X POST http://localhost:8000/api/webpages/widgets/pages/1/widgets/create/ \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text-block",
    "slot": "main",
    "configuration": {
      "title": "New Widget",
      "content": "Content here"
    }
  }'
```
- [ ] Create widget works
- [ ] Update widget works
- [ ] Delete widget works
- [ ] Reorder widgets works
- [ ] Duplicate widget works

### 3. Widget Preview System (#113)

#### Test Live Preview
1. Open Widget Editor Panel
2. Click the eye icon to show preview
3. Test preview features:
   - [ ] Preview updates as you type (500ms debounce)
   - [ ] No page refresh needed
   - [ ] CSS isolation works (widget styles don't leak)

#### Test Responsive Preview
- [ ] Desktop mode shows full width
- [ ] Tablet mode shows 768px width
- [ ] Mobile mode shows 375px width
- [ ] Viewport switching works smoothly

#### Test Preview Controls
- [ ] Refresh button manually updates preview
- [ ] Fullscreen mode works
- [ ] Hide/show preview toggle works

#### Test React vs Django Parity
1. Open WidgetPreviewComparison component (if integrated)
2. Check rendering:
   - [ ] React preview matches Django preview
   - [ ] Same HTML structure
   - [ ] Same styling applied
   - [ ] Performance metrics shown

## Integration Testing

### End-to-End Widget Workflow
1. **Create Page**
   ```
   - Navigate to Pages
   - Create new page
   - Add page title and slug
   ```

2. **Add Widgets**
   ```
   - Click "Add Widget"
   - Select widget type
   - Configure using specialized editor
   - See live preview update
   - Save widget
   ```

3. **Edit Widgets**
   ```
   - Click edit on existing widget
   - Modify configuration
   - Preview shows changes instantly
   - Validation errors appear inline
   - Save changes
   ```

4. **Reorder Widgets**
   ```
   - Drag widgets to reorder
   - API updates order
   - Preview reflects new order
   ```

5. **Publish Page**
   ```
   - Preview full page
   - Publish page
   - View on frontend
   - Verify widgets render correctly
   ```

## Performance Testing

### Widget Editor Performance
- [ ] Editors load within 1 second
- [ ] Typing is responsive (no lag)
- [ ] Validation runs without blocking UI

### Preview Performance
- [ ] Preview updates within 500ms of changes
- [ ] No memory leaks during extended editing
- [ ] Multiple widgets don't slow down preview

### API Performance
- [ ] Widget type list loads < 200ms
- [ ] Validation responds < 100ms
- [ ] Preview render < 300ms

## Browser Compatibility

Test in multiple browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Mobile Testing

Test on mobile devices:
- [ ] Editor panels are responsive
- [ ] Touch interactions work
- [ ] Preview modes display correctly

## Error Handling

Test error scenarios:
- [ ] Invalid widget configuration shows errors
- [ ] Network failures show user-friendly messages
- [ ] Backend errors don't crash frontend
- [ ] Preview errors are contained

## Security Testing

Verify security measures:
- [ ] HTML content is sanitized (no XSS)
- [ ] CSRF protection works
- [ ] Authentication required for APIs
- [ ] No sensitive data in responses

## Debugging Tips

### Check Console Logs
```javascript
// Frontend console
localStorage.debug = 'api:*'  // Enable API debugging

// Backend logs
docker-compose logs -f backend
```

### Check Network Tab
- Monitor API calls
- Verify request/response payloads
- Check response times

### Database Inspection
```bash
# Check widget data in database
docker-compose exec backend python manage.py shell
>>> from webpages.models import PageVersion
>>> pv = PageVersion.objects.latest('created_at')
>>> print(pv.widgets)
```

## Common Issues & Solutions

### Issue: Widget preview not updating
**Solution**: 
- Check browser console for errors
- Verify API endpoint is accessible
- Check CORS settings

### Issue: Widget editor not loading
**Solution**:
- Clear browser cache
- Rebuild frontend: `npm run build`
- Check for JavaScript errors

### Issue: API returns 403 Forbidden
**Solution**:
- Check authentication token
- Verify CSRF token is included
- Check user permissions

### Issue: Widget validation failing
**Solution**:
- Check Pydantic model requirements
- Verify field types match schema
- Look for missing required fields

## Regression Testing

After any changes, verify:
- [ ] All widget types still work
- [ ] Existing widgets still render
- [ ] API backwards compatibility maintained
- [ ] No performance degradation

## Test Data

### Sample Widget Configurations

**Text Block**
```json
{
  "title": "Welcome",
  "content": "<p>Welcome to our site!</p>",
  "alignment": "center",
  "style": "normal"
}
```

**Image**
```json
{
  "image_url": "/media/sample.jpg",
  "alt_text": "Sample image",
  "caption": "This is a sample image",
  "alignment": "center"
}
```

**Button**
```json
{
  "text": "Click Me",
  "url": "https://example.com",
  "style": "primary",
  "size": "medium",
  "target": "_blank"
}
```

## Reporting Issues

When reporting issues, include:
1. Browser and version
2. Steps to reproduce
3. Expected vs actual behavior
4. Console errors
5. Network requests/responses
6. Screenshots if applicable