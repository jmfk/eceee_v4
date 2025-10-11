# Path Pattern Registry Implementation Summary

**Date**: October 10, 2025  
**Issue**: Signal-based ReDoS protection not working in multi-threaded Django environment  
**Solution**: Registry-based path pattern system with predefined, validated patterns

## Problem Statement

The original implementation used arbitrary regex strings in `path_pattern` field with signal-based timeout protection. This caused:

1. **ValueError**: "signal only works in main thread of the main interpreter" in Django request handlers
2. **Security risk**: User-supplied regex could cause ReDoS attacks
3. **Poor UX**: No validation, examples, or metadata for patterns

## Solution Overview

Replaced raw regex strings with a secure, pluggable pattern registry system:

- **Security**: Patterns defined in code, not user-supplied
- **UX**: Visual selector with pattern previews and metadata
- **Extensibility**: Third-party apps can register custom patterns
- **No threading issues**: Simple pattern lookup, no signal/timeout needed

## Implementation Details

### Backend Changes

#### 1. Path Pattern Registry (`backend/webpages/path_pattern_registry.py`)

Created registry system following widget/layout architecture:

- `BasePathPattern`: Abstract base class for pattern definitions
- `PathPatternRegistry`: Central registry for managing patterns
- `@register_path_pattern`: Decorator for registration
- Validation at import time (fail-fast)
- Safe pattern matching with error handling

**Key features**:
- Validates regex on registration
- Enforces named capture groups
- Tests example URLs against patterns
- Serializes to JSON for API

#### 2. Autodiscovery (`backend/webpages/path_pattern_autodiscovery.py`)

Automatic discovery of patterns from all Django apps:

- Looks for `path_patterns` module in each app
- Imports at startup to trigger registration
- Validates all patterns in DEBUG mode
- Integrated into `webpages/apps.py`

#### 3. Common Patterns (`backend/webpages/path_patterns/__init__.py`)

Predefined patterns for common use cases:

- `news_slug`: News articles
- `event_slug`: Events
- `library_slug`: Library items
- `member_slug`: Member profiles
- `date_slug`: Date-based URLs (YYYY/MM/slug)
- `year_slug`: Year-based URLs (YYYY/slug)
- `numeric_id`: Numeric IDs
- `category_slug`: Category/slug combinations

Each pattern includes:
- Unique key
- Human-readable name and description
- Regex pattern with named groups
- Example URL
- Variable metadata (name, type, description, example)

#### 4. Model Changes (`backend/webpages/models.py`)

Updated `WebPage` model:

```python
# Old
path_pattern = models.CharField(max_length=500, ...)  # Raw regex string

# New
path_pattern_key = models.CharField(
    max_length=100,
    db_column="path_pattern",  # Keep same DB column
    ...
)
```

Updated `clean()` method to validate against registry instead of compiling raw regex.

#### 5. Migration (`backend/webpages/migrations/0037_path_pattern_to_registry.py`)

- Clears old raw regex values
- Maintains same database column name
- Users must re-select patterns using new selector

#### 6. Public Views (`backend/webpages/public_views.py`)

Simplified `_extract_path_variables()` method:

```python
# Old (70+ lines with signal handling)
def _extract_path_variables(self, pattern, remaining_path):
    import signal
    # Complex timeout handling...

# New (20 lines)
def _extract_path_variables(self, pattern_key, remaining_path):
    pattern = path_pattern_registry.get_pattern(pattern_key)
    return pattern.validate_match(remaining_path)
```

**Benefits**:
- No signal/threading issues
- Simpler, more maintainable code
- Better error handling
- No ReDoS risk

#### 7. API Endpoint (`backend/webpages/views/path_pattern_views.py`)

New `PathPatternViewSet` with actions:

- `list`: Get all registered patterns with metadata
- `detail`: Get specific pattern details
- `validate`: Validate a path against a pattern

Registered at `/api/webpages/path-patterns/`

#### 8. Serializers (`backend/webpages/serializers.py`)

Updated serializers to use `path_pattern_key` instead of `path_pattern`:

- `WebPageTreeSerializer`
- `WebPageSimpleSerializer`

### Frontend Changes

#### 9. API Client (`frontend/src/api/pathPatterns.js`)

New API client for path patterns:

```javascript
fetchPathPatterns()  // Get all patterns
fetchPathPattern(key)  // Get specific pattern
validatePath(key, path)  // Validate path
```

#### 10. Pattern Selector Component (`frontend/src/components/PathPatternSelector.jsx`)

Rich React component with:

- Dropdown for pattern selection
- Pattern description and example URL
- Expandable details showing regex and variables
- Variable table with names, types, descriptions, examples
- Visual preview of what gets captured

#### 11. Settings Editor Integration (`frontend/src/components/SettingsEditor.tsx`)

Replaced text input with `PathPatternSelector`:

```tsx
// Old
<input type="text" value={pathPattern} ... />

// New
<PathPatternSelector
    value={pathPatternKey}
    onChange={(value) => handlePageFieldChange('pathPatternKey', value)}
/>
```

### Testing

#### 12. Registry Tests (`backend/webpages/tests/test_path_pattern_registry.py`)

Comprehensive test coverage:

- Pattern registration and unregistration
- Invalid pattern detection
- Pattern validation
- Serialization
- Decorator functionality

#### 13. Pattern Tests (`backend/webpages/tests/test_path_patterns.py`)

Tests for all common patterns:

- Pattern matching for valid URLs
- Rejection of invalid URLs
- Metadata completeness
- Example URL validation

### Documentation

#### 14. Updated Documentation (`docs/PATH_PATTERN_SYSTEM.md`)

Comprehensive documentation updates:

- Registry-based approach explanation
- Security improvements section
- Migration guide
- Creating custom patterns
- API access examples
- Frontend integration examples

## Migration Path

### For Users

1. **Automatic**: Migration clears old regex patterns
2. **Manual**: Re-select patterns in page editor using new selector
3. **Custom patterns**: Create code-based patterns for custom regex

### For Developers

To create custom patterns in third-party apps:

```python
# myapp/path_patterns.py
from webpages.path_pattern_registry import BasePathPattern, register_path_pattern

@register_path_pattern
class MyPattern(BasePathPattern):
    key = "my_pattern"
    name = "My Pattern"
    description = "Description here"
    regex_pattern = r"^(?P<slug>[\w-]+)/$"
    example_url = "example/"
    extracted_variables = [...]
```

Patterns automatically discovered at startup.

## Security Improvements

### Before (Signal-Based)

❌ User-supplied regex strings  
❌ ReDoS risk from malicious patterns  
❌ Signal timeout only works on main thread  
❌ Fails in multi-threaded Django  
❌ Complex error-prone code  

### After (Registry-Based)

✅ Code-defined patterns only  
✅ No ReDoS risk  
✅ No signal/threading issues  
✅ Works in all environments  
✅ Simple, maintainable code  
✅ Better UX with metadata  
✅ Patterns in version control  
✅ Validated at import time  

## Files Changed

### Backend

- `backend/webpages/path_pattern_registry.py` (new)
- `backend/webpages/path_pattern_autodiscovery.py` (new)
- `backend/webpages/path_patterns/__init__.py` (new)
- `backend/webpages/models.py` (modified)
- `backend/webpages/public_views.py` (modified)
- `backend/webpages/serializers.py` (modified)
- `backend/webpages/apps.py` (modified)
- `backend/webpages/api_urls.py` (modified)
- `backend/webpages/views/path_pattern_views.py` (new)
- `backend/webpages/migrations/0037_path_pattern_to_registry.py` (new)
- `backend/webpages/tests/test_path_pattern_registry.py` (new)
- `backend/webpages/tests/test_path_patterns.py` (new)

### Frontend

- `frontend/src/api/pathPatterns.js` (new)
- `frontend/src/components/PathPatternSelector.jsx` (new)
- `frontend/src/components/SettingsEditor.tsx` (modified)

### Documentation

- `docs/PATH_PATTERN_SYSTEM.md` (modified)
- `PATH_PATTERN_REGISTRY_IMPLEMENTATION_SUMMARY.md` (new, this file)

## Testing Checklist

- [x] Pattern registry registration works
- [x] Pattern validation works correctly
- [x] All common patterns match expected URLs
- [x] API endpoints return correct data
- [x] Frontend selector displays patterns
- [x] Settings editor integration works
- [x] Migration clears old patterns
- [x] Public views use registry lookup
- [x] No signal-related errors
- [x] Documentation updated

## Benefits

1. **Security**: Eliminates ReDoS vulnerabilities
2. **Reliability**: No threading issues
3. **UX**: Visual pattern selector with examples
4. **Maintainability**: Simpler codebase
5. **Extensibility**: Easy to add custom patterns
6. **Validation**: Patterns tested at startup
7. **Documentation**: Self-documenting with metadata
8. **Performance**: Faster pattern lookup

## Future Enhancements

Potential improvements:

1. Pattern testing UI in page editor
2. Pattern usage analytics
3. Auto-generation from model structure
4. Debug toolbar integration
5. Multiple patterns per page with priority

## Conclusion

The registry-based path pattern system successfully resolves the signal/threading issues while providing significant security and UX improvements. The system is extensible, maintainable, and provides a better developer and user experience.

