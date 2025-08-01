# Publishing System Migration Plan

## Current System Problems

The current publishing system has several issues that make it complex and confusing:

1. **Dual Status System**: Both `WebPage` and `PageVersion` have separate status fields
   - `WebPage.publication_status` = "unpublished" | "scheduled" | "published" | "expired"
   - `PageVersion.status` = "draft" | "published" | "archived"

2. **Complex Logic**: Publication status determined by both explicit status AND date validation
   - `is_published()` checks: `publication_status == "published"` AND date logic
   - Creates confusion about what actually controls visibility

3. **Manual Status Management**: Requires explicit status changes rather than deriving from dates
   - Publishing involves updating multiple status fields
   - Easy to get into inconsistent states

4. **Version/Page Coupling**: Publishing logic split between pages and versions
   - When publishing a version, it updates the page's publication_status
   - Creates tight coupling and complex workflows

## New System Requirements

Based on user specifications:

1. **Page is published if and only if it has a version that is approved for publishing**
2. **Version is published if it has effective_date (that has passed) and either no expiration_date or expiration_date hasn't happened yet**
3. **Published version of a webpage is the last published and active version**
4. **No explicit publish status** - status derived purely from effective_date and expiration_date

## Proposed New System

### Core Principles

1. **Date-Driven Publishing**: Only dates determine publication status
2. **Single Source of Truth**: Version dates are the only authority
3. **Simplified Logic**: No manual status management
4. **Version-Centric**: Versions control everything, pages derive their status

### Model Changes

#### WebPage Model
**Remove:**
- `publication_status` field (enum)
- `effective_date` field (move to versions only)
- `expiry_date` field (move to versions only)

**Keep:**
- All other fields unchanged
- Relationships unchanged

**Update Methods:**
```python
def is_published(self, now=None):
    """Page is published if it has an active version"""
    current_version = self.get_current_published_version(now)
    return current_version is not None

def get_current_published_version(self, now=None):
    """Get the currently published version (date-based)"""
    if now is None:
        now = timezone.now()
    
    return self.versions.filter(
        effective_date__lte=now
    ).filter(
        models.Q(expiry_date__isnull=True) | models.Q(expiry_date__gt=now)
    ).order_by('-effective_date', '-version_number').first()

def get_published_version_at(self, when):
    """Get the version that was published at a specific time"""
    return self.versions.filter(
        effective_date__lte=when
    ).filter(
        models.Q(expiry_date__isnull=True) | models.Q(expiry_date__gt=when)
    ).order_by('-effective_date', '-version_number').first()
```

#### PageVersion Model
**Add:**
- `effective_date` field (moved from WebPage)
- `expiry_date` field (moved from WebPage)

**Remove:**
- `status` field (enum) - no longer needed
- `is_current` field - derived from dates
- `published_at` field - use effective_date instead
- `published_by` field - use created_by instead

**Update Methods:**
```python
def is_published(self, now=None):
    """Version is published if dates are valid"""
    if now is None:
        now = timezone.now()
    
    if not self.effective_date or self.effective_date > now:
        return False
    
    if self.expiry_date and self.expiry_date <= now:
        return False
    
    return True

def is_current(self, now=None):
    """Check if this is the current published version for its page"""
    current_version = self.page.get_current_published_version(now)
    return current_version == self
```

### API Changes

#### Simplified Publishing Endpoints
- Remove: `/pages/{id}/publish/` (no manual publishing)
- Remove: `/pages/{id}/unpublish/` (no manual unpublishing)  
- Remove: `/pages/{id}/schedule/` (scheduling is just setting dates)
- Keep: `/versions/{id}/` (PATCH to update dates)
- Add: `/versions/{id}/activate/` (set effective_date to now)

#### Updated Serializers
```python
class WebPageSerializer(serializers.ModelSerializer):
    # Remove publication_status, effective_date, expiry_date
    is_published = serializers.SerializerMethodField()
    current_version = serializers.SerializerMethodField()
    
    def get_is_published(self, obj):
        return obj.is_published()
    
    def get_current_version(self, obj):
        version = obj.get_current_published_version()
        if version:
            return PageVersionSerializer(version).data
        return None

class PageVersionSerializer(serializers.ModelSerializer):
    # Add effective_date, expiry_date
    # Remove status, is_current, published_at, published_by
    is_published = serializers.SerializerMethodField()
    is_current = serializers.SerializerMethodField()
    
    def get_is_published(self, obj):
        return obj.is_published()
    
    def get_is_current(self, obj):
        return obj.is_current()
```

### Migration Strategy

#### Phase 1: Add New Fields
1. Add `effective_date` and `expiry_date` to PageVersion model
2. Create migration to copy data from WebPage to PageVersion
3. Update all references to use version dates instead of page dates

#### Phase 2: Update Logic
1. Update all `is_published()` methods to use date-based logic
2. Update queries and filters to use new logic
3. Update API endpoints and serializers

#### Phase 3: Remove Old Fields
1. Remove `publication_status`, `effective_date`, `expiry_date` from WebPage
2. Remove `status`, `is_current`, `published_at`, `published_by` from PageVersion
3. Update all remaining references

#### Phase 4: Clean Up
1. Update frontend to work with new system
2. Update all tests
3. Update documentation

### Data Migration

```python
def migrate_publishing_data(apps, schema_editor):
    WebPage = apps.get_model('webpages', 'WebPage')
    PageVersion = apps.get_model('webpages', 'PageVersion')
    
    for page in WebPage.objects.all():
        # Find current published version
        current_version = page.versions.filter(
            status='published', 
            is_current=True
        ).first()
        
        if current_version:
            # Copy dates from page to current version
            current_version.effective_date = page.effective_date
            current_version.expiry_date = page.expiry_date
            current_version.save()
        
        # For pages without versions, create a version if published
        elif page.publication_status == 'published':
            page.create_version(
                user=page.last_modified_by,
                description="Migrated from old publishing system",
                effective_date=page.effective_date,
                expiry_date=page.expiry_date
            )
```

### Benefits of New System

1. **Simplicity**: No more dual status system
2. **Clarity**: Dates are the single source of truth
3. **Flexibility**: Easy to schedule content for any time
4. **Consistency**: No risk of status/date mismatches
5. **Version-Centric**: Clean separation of concerns

### Frontend Impact

1. **Publishing UI**: Remove publish/unpublish buttons, replace with date pickers
2. **Status Display**: Show "Published" if dates are valid, "Scheduled" if future, "Expired" if past
3. **Bulk Operations**: Update bulk publish to set effective_date to now
4. **Dashboard**: Update publication status dashboard to use date-based calculations

### Testing Strategy

1. **Unit Tests**: Test all new date-based methods
2. **Integration Tests**: Test API endpoints with new logic
3. **Migration Tests**: Ensure data migration works correctly
4. **Frontend Tests**: Update all UI tests

### Rollback Plan

If issues arise:
1. Keep old fields during migration phase
2. Can temporarily re-enable old logic
3. Full rollback possible until Phase 3 completion

## Timeline

- **Week 1**: Analysis and planning (complete)
- **Week 2**: Phase 1 implementation (add fields, migrate data)
- **Week 3**: Phase 2 implementation (update logic)
- **Week 4**: Phase 3 implementation (remove old fields)
- **Week 5**: Testing and frontend updates
- **Week 6**: Documentation and deployment

## Risk Assessment

**Low Risk:**
- Date-based logic is simpler than current system
- Migration can be done incrementally
- Easy to test and validate

**Medium Risk:**
- Frontend components need updates
- Need to ensure no breaking changes to public API

**Mitigation:**
- Thorough testing at each phase
- Keep old fields during transition
- Staged deployment with rollback capability