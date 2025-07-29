# Unified Save API Implementation Plan

## 📊 Current Architecture Analysis

### Backend Structure (✅ Well Foundation)
```python
# PageVersion Model (already exists)
class PageVersion(models.Model):
    page_data = models.JSONField()  # Page metadata
    widgets = models.JSONField()    # Widget data ✅ Already exists!
    status = models.CharField()     # draft/published
    is_current = models.BooleanField()
```

### Current API Endpoints
```bash
# Page metadata only
GET  /api/v1/webpages/pages/{id}/           # Returns page data (NO widgets)
PATCH /api/v1/webpages/pages/{id}/          # Updates page data only

# Widget data only  
POST /api/v1/webpages/pages/{id}/update_widgets/  # Updates widgets only

# Version data (has both but is separate)
GET  /api/v1/webpages/versions/{id}/        # Returns page_data + widgets
GET  /api/v1/webpages/versions/{id}/widgets/  # Returns widgets only
```

## 🎯 Proposed Unified API

### New Unified Endpoints
```bash
# Unified page endpoint (NEW)
GET  /api/v1/webpages/pages/{id}/           # Returns page data + widgets
PATCH /api/v1/webpages/pages/{id}/          # Updates page data + widgets (optional)

# Payload structure
{
  "page_data": {
    "title": "string",
    "slug": "string", 
    "description": "string",
    "meta_title": "string",
    "meta_description": "string",
    "hostnames": ["array"],
    "publication_status": "string"
  },
  "widgets": {
    "slot-name": [
      {
        "id": "widget-123",
        "type": "text",
        "name": "Welcome Text",
        "config": { "content": "Hello world!" }
      }
    ]
  },
  "version_options": {
    "description": "string",
    "auto_publish": boolean
  }
}
```

## 🔧 Implementation Changes Required

### 1. Backend Changes

#### 1.1 Modify WebPageDetailSerializer
```python
# backend/webpages/serializers.py
class WebPageDetailSerializer(serializers.ModelSerializer):
    # ... existing fields ...
    widgets = serializers.SerializerMethodField()  # ADD THIS
    
    class Meta:
        model = WebPage
        fields = [
            # ... existing fields ...
            "widgets",  # ADD THIS
        ]
    
    def get_widgets(self, obj):
        """Get widgets from current version"""
        current_version = obj.get_current_version()
        return current_version.widgets if current_version else {}
    
    def update(self, instance, validated_data):
        """Handle unified save: page_data + widgets"""
        # Extract widgets and version options if present
        widgets_data = validated_data.pop('widgets', None)
        version_options = validated_data.pop('version_options', {})
        
        # Update page metadata (existing logic)
        super().update(instance, validated_data)
        
        # If widgets provided, create/update version
        if widgets_data is not None:
            description = version_options.get('description', 'Unified update via API')
            auto_publish = version_options.get('auto_publish', False)
            
            # Create new version with both page_data and widgets
            self._create_unified_version(instance, widgets_data, description, auto_publish)
        
        return instance
    
    def _create_unified_version(self, page, widgets_data, description, auto_publish):
        """Create version with both page data and widgets"""
        # Get current page data
        from .serializers import WebPageDetailSerializer
        page_serializer = WebPageDetailSerializer(page)
        current_page_data = {k: v for k, v in page_serializer.data.items() 
                           if k not in ['widgets', 'id', 'created_at', 'updated_at']}
        
        # Create new version
        version = page.create_version(
            user=self.context['request'].user,
            description=description,
            status="published" if auto_publish else "draft",
            auto_publish=auto_publish,
        )
        
        # Update version with unified data
        version.page_data = current_page_data
        version.widgets = widgets_data
        version.save()
        
        return version
```

#### 1.2 Modify WebPageViewSet.perform_update()
```python
# backend/webpages/views.py
class WebPageViewSet(viewsets.ModelViewSet):
    def perform_update(self, serializer):
        """Enhanced to handle unified saves"""
        # Get widgets and version options from request
        widgets_data = self.request.data.get('widgets')
        version_options = self.request.data.get('version_options', {})
        
        # Pass to serializer for unified handling
        update_data = serializer.validated_data.copy()
        if widgets_data is not None:
            update_data['widgets'] = widgets_data
        if version_options:
            update_data['version_options'] = version_options
            
        serializer.save(last_modified_by=self.request.user, **update_data)
```

#### 1.3 Keep Backward Compatibility
```python
# Keep existing update_widgets endpoint for backward compatibility
@action(detail=True, methods=["post"])
def update_widgets(self, request, pk=None):
    """Legacy endpoint - now internally calls unified save"""
    page = self.get_object()
    
    # Convert to unified format
    unified_data = {
        'widgets': request.data.get('widgets', {}),
        'version_options': {
            'description': request.data.get('description', 'Widget update via API'),
            'auto_publish': request.data.get('auto_publish', False)
        }
    }
    
    # Use unified save logic
    serializer = self.get_serializer(page, data=unified_data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    
    return Response({
        "message": "Widgets updated successfully (via unified API)",
        "page": serializer.data,
    })
```

### 2. Frontend Changes

#### 2.1 Update API Client
```javascript
// frontend/src/api/pages.js

// NEW: Unified save function
export const savePageWithWidgets = async (pageId, pageData, widgets, options = {}) => {
    const payload = {
        ...pageData,  // page metadata
        widgets,      // widget data
        version_options: {
            description: options.description || 'Unified save',
            auto_publish: options.autoPublish || false
        }
    };
    
    const response = await api.patch(`${API_BASE}/pages/${pageId}/`, payload);
    return response.data;
};

// Keep existing functions for backward compatibility
export const updatePageWidgets = async (pageId, widgets, options = {}) => {
    console.warn('updatePageWidgets is deprecated, use savePageWithWidgets');
    return savePageWithWidgets(pageId, {}, widgets, options);
};
```

#### 2.2 Update PageEditor Save Logic
```javascript
// frontend/src/components/PageEditor.jsx

const handleUnifiedSave = useCallback(async () => {
    try {
        console.log('🔄 UNIFIED SAVE: Collecting all data...');
        
        // Collect all data
        const widgetData = contentEditorRef.current?.saveWidgets?.() || {};
        const settingsData = settingsEditorRef.current?.saveSettings?.() || {};
        const metadataData = metadataEditorRef.current?.saveMetadata?.() || {};
        
        // Combine all page data
        const unifiedPageData = {
            ...settingsData.data,
            ...metadataData.data
        };
        
        console.log('🔄 UNIFIED SAVE: Saving to API...', {
            pageData: unifiedPageData,
            widgets: widgetData
        });
        
        // Single API call for everything!
        const response = await savePageWithWidgets(
            pageData.id,
            unifiedPageData,
            widgetData,
            {
                description: 'Unified save from page editor',
                autoPublish: false
            }
        );
        
        console.log('✅ UNIFIED SAVE: Success!', response);
        
        // Update UI state
        setPageData(response);
        setIsDirty(false);
        
        addNotification({
            type: 'success',
            message: 'All changes saved successfully!'
        });
        
        // Invalidate queries
        queryClient.invalidateQueries(['page', pageData.id]);
        
    } catch (error) {
        console.error('❌ UNIFIED SAVE: Failed', error);
        showError(`Save failed: ${error.message}`);
    }
}, [/* dependencies */]);
```

## 🚀 Migration Strategy

### Phase 1: Backend Implementation (Week 1)
1. ✅ Add `widgets` field to `WebPageDetailSerializer`
2. ✅ Modify `perform_update()` to handle unified saves
3. ✅ Update `update_widgets` for backward compatibility
4. ✅ Add comprehensive tests

### Phase 2: Frontend Integration (Week 2)  
1. ✅ Create `savePageWithWidgets()` API function
2. ✅ Update PageEditor to use unified save
3. ✅ Test with existing save signal chain
4. ✅ Add error handling and loading states

### Phase 3: Optimization (Week 3)
1. ✅ Performance optimization for large widget datasets
2. ✅ Add optimistic updates
3. ✅ Improve error messages and retry logic
4. ✅ Add change detection and smart saves

### Phase 4: Cleanup (Week 4)
1. ✅ Remove deprecated widget-only endpoints (optional)
2. ✅ Update documentation
3. ✅ Performance monitoring and optimization

## 📈 Benefits of Unified API

### 1. **Atomic Operations**
- All-or-nothing saves prevent partial state corruption
- Better data consistency

### 2. **Simpler Frontend Logic**
- Single save operation instead of coordination
- Easier error handling
- Reduced race conditions

### 3. **Better Performance**
- Fewer HTTP requests
- Single database transaction
- Reduced server load

### 4. **Improved Version Management**
- Page metadata + widgets always in sync
- Cleaner version history
- Better rollback capabilities

### 5. **Developer Experience**
- Single API endpoint to understand
- Consistent save patterns
- Better debugging

## 🔄 Data Flow Comparison

### Current (Complex)
```
Frontend Changes → 
├── Page Metadata → PATCH /pages/{id}/ → Create Version (page_data only)
└── Widgets → POST /pages/{id}/update_widgets/ → Create Version (widgets only)
```

### New (Unified)
```
Frontend Changes → PATCH /pages/{id}/ → Create Version (page_data + widgets)
```

## 🛡️ Backward Compatibility

### Keep Working
- ✅ Existing `update_widgets` endpoint (internally uses unified save)
- ✅ Existing version endpoints
- ✅ All current frontend code

### Deprecation Path
1. **Phase 1**: Add unified API alongside existing
2. **Phase 2**: Update frontend to use unified API
3. **Phase 3**: Mark old endpoints as deprecated
4. **Phase 4** (Optional): Remove deprecated endpoints

## 🧪 Testing Strategy

### Backend Tests
```python
def test_unified_save_page_and_widgets():
    """Test saving page metadata + widgets in one call"""
    payload = {
        'title': 'Updated Title',
        'widgets': {'main': [{'type': 'text', 'config': {}}]},
        'version_options': {'description': 'Test save'}
    }
    response = client.patch(f'/api/pages/{page.id}/', payload)
    assert response.status_code == 200
    assert 'widgets' in response.data
    
def test_backward_compatibility():
    """Test old update_widgets still works"""
    payload = {'widgets': {'main': []}}
    response = client.post(f'/api/pages/{page.id}/update_widgets/', payload)
    assert response.status_code == 200
```

### Frontend Tests
```javascript
test('unified save updates everything', async () => {
  const pageData = { title: 'New Title' };
  const widgets = { main: [{ type: 'text' }] };
  
  const result = await savePageWithWidgets(1, pageData, widgets);
  
  expect(result.title).toBe('New Title');
  expect(result.widgets.main).toHaveLength(1);
});
```

## 💡 Implementation Notes

### Error Handling
- If page save succeeds but version creation fails → rollback page changes
- If widgets are invalid → return validation errors before saving anything
- Add field-level validation for both page data and widgets

### Performance Considerations
- Lazy load widgets for page lists (keep widgets only in detail view)
- Add pagination for large widget datasets
- Consider compression for large widget JSON

### Security
- Validate widget data structure
- Sanitize widget configurations
- Check permissions for both page and widget modifications

---

This unified approach will significantly simplify the save system while maintaining all existing functionality and providing a clear migration path. The atomic nature of the saves will also improve data consistency and reduce bugs related to partial saves. 