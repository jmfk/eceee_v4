# Path Pattern System

## Overview

The Path Pattern System enables dynamic object publishing by allowing pages to capture URL path variables using **predefined, secure pattern templates**. This allows a single page to display both listings and individual object details based on the URL path.

**Security Note**: Path patterns use a registry-based system where patterns are defined in code rather than as arbitrary regex strings. This prevents ReDoS (Regular Expression Denial of Service) attacks and provides better UX through validated metadata.

## How It Works

### Concept

Instead of creating a separate page for each content object (e.g., each news article), you create one page (e.g., `/news/`) with a `path_pattern` that captures the object identifier from the URL. Widgets on the page inspect the captured variables to determine what to display.

### Example Flow

1. User requests: `/news/my-article/`
2. System checks for exact page match at `/news/my-article/` - not found
3. System finds page at `/news/` with `path_pattern_key = "news_slug"`
4. System looks up pattern "news_slug" in registry, gets regex `^(?P<slug>[\w-]+)/$`
5. System extracts `slug = "my-article"` from remaining path
6. Widgets receive `path_variables = {"slug": "my-article"}` in context
7. Widget checks: if `slug` exists, show article detail; else show listing

## Configuration

### Adding a Path Pattern to a Page

Pages use the `path_pattern_key` field to select from predefined patterns in the registry. Set it through the page editor or API:

```python
from webpages.models import WebPage

news_page = WebPage.objects.get(slug="news")
news_page.path_pattern_key = "news_slug"  # Select from registry
news_page.save()
```

**In the Frontend**: Use the Path Pattern Selector component in the Settings Editor to choose from available patterns with visual previews.

### Available Patterns

Patterns are defined in code and registered at startup. Common patterns include:

- **news_slug**: Captures article slugs (e.g., `my-article/`)
- **event_slug**: Captures event slugs
- **date_slug**: Captures year/month/slug (e.g., `2025/10/article/`)
- **year_slug**: Captures year/slug (e.g., `2025/report/`)
- **category_slug**: Captures category/slug
- **numeric_id**: Captures numeric IDs
- **member_slug**: Captures member profile slugs

View all patterns at: `/api/webpages/path-patterns/list/`

### Creating Custom Patterns

Third-party apps can register custom patterns by creating a `path_patterns` module:

```python
# myapp/path_patterns.py
from webpages.path_pattern_registry import BasePathPattern, register_path_pattern

@register_path_pattern
class CustomPattern(BasePathPattern):
    key = "custom_pattern"
    name = "My Custom Pattern"
    description = "Captures custom URL structure"
    regex_pattern = r"^(?P<year>\d{4})/(?P<slug>[\w-]+)/$"
    example_url = "2025/my-article/"
    extracted_variables = [
        {
            "name": "year",
            "type": "string",
            "description": "Year",
            "example": "2025",
        },
        {
            "name": "slug",
            "type": "string",
            "description": "Article slug",
            "example": "my-article",
        },
    ]
```

Patterns are automatically discovered at startup.

### Pattern Examples

#### Simple slug capture
```regex
^(?P<news_slug>[\w-]+)/$
```
Matches: `/news/my-article/` → `{"news_slug": "my-article"}`

#### Year and slug
```regex
^(?P<year>\d{4})/(?P<slug>[\w-]+)/$
```
Matches: `/events/2024/conference/` → `{"year": "2024", "slug": "conference"}`

#### Category and item
```regex
^(?P<category>[\w-]+)/(?P<item_slug>[\w-]+)/$
```
Matches: `/library/reports/annual-report/` → `{"category": "reports", "item_slug": "annual-report"}`

#### Optional language prefix
```regex
^(?:(?P<lang>en|es|fr)/)?(?P<slug>[\w-]+)/$
```
Matches:
- `/news/article/` → `{"slug": "article", "lang": None}`
- `/news/es/article/` → `{"slug": "article", "lang": "es"}`

## URL Resolution Precedence

The system prioritizes **explicit child pages** over pattern matching:

1. **Exact page matches**: If `/news/archive/` exists as a child page, it will be used
2. **Pattern matching**: If no exact match, pattern is applied to remaining path

### Example

Given:
- Page at `/news/` with pattern `^(?P<news_slug>[\w-]+)/$`
- Child page at `/news/archive/`

Requests:
- `/news/archive/` → Shows the archive page (exact match wins)
- `/news/my-article/` → Shows news page with `news_slug = "my-article"` (pattern match)

## Using Path Variables in Widgets

### Accessing Path Variables

Widgets receive path variables in the rendering context:

```python
class NewsWidget(BaseWidget):
    def prepare_template_context(self, config, context=None):
        path_vars = context.get('path_variables', {})
        
        if 'news_slug' in path_vars:
            # Detail mode - show specific article
            from content.models import News
            article = News.objects.get(slug=path_vars['news_slug'])
            return {
                'mode': 'detail',
                'article': article,
            }
        else:
            # List mode - show all articles
            from content.models import News
            articles = News.objects.filter(is_published=True)
            return {
                'mode': 'list',
                'articles': articles,
            }
```

### Widget Context Structure

```python
{
    '_context': {
        'path_variables': {
            'news_slug': 'my-article',  # Captured from URL
            # ... more captured variables
        },
        'page': <WebPage object>,
        'current_page': <WebPage object>,
        'request': <HttpRequest object>,
        # ... other context data
    }
}
```

### Conditional Rendering

Widgets can use path variables to decide whether to render at all:

```python
def prepare_template_context(self, config, context=None):
    path_vars = context.get('path_variables', {})
    
    # Only show list widget when NO path variables present
    if not path_vars:
        return {'articles': get_article_list()}
    
    # Don't render this widget for detail views
    return None
```

## Implementation Details

### URL Resolution Algorithm

1. **Generate candidate paths**: For URL `/news/my-article/`, generate: `['/news/my-article/', '/news/', '/']`
2. **Single database query**: Find longest matching page using single query
3. **Extract remaining path**: If page found at `/news/`, remaining is `my-article/`
4. **Apply pattern**: If page has `path_pattern`, match against remaining path
5. **Extract variables**: Use regex named groups to extract variables into dict

### Performance

- **Single query resolution**: All possible paths checked in one database query
- **Ordered by length**: Longest match returned first (explicit pages take precedence)
- **Regex timeout**: 1-second timeout prevents ReDoS attacks
- **No performance impact**: Pages without `path_pattern` work exactly as before

### Security

**Major Security Improvements (Registry-Based System)**:

- **No ReDoS risk**: Patterns are pre-validated in code, not user-supplied regex
- **No signal/threading issues**: Simple pattern lookup, no timeout mechanisms needed
- **Code-level validation**: Patterns validated at import time, not runtime
- **Impossible to inject malicious regex**: Users select from predefined keys only
- **Audit trail**: All patterns defined in version-controlled code

**Pattern Validation**:

- Patterns validated on registration (app startup)
- Invalid regex causes app startup failure (fail-fast)
- Named groups enforced at pattern definition
- Example URLs tested against their own patterns

## Migration Guide

### Registry-Based System Migration (October 2025)

**Breaking Change**: The `path_pattern` field has been replaced with `path_pattern_key` which references the pattern registry.

**Migration Steps**:

1. **Automatic**: Migration `0037_path_pattern_to_registry.py` clears old regex strings
2. **Manual**: Re-select patterns using the new Path Pattern Selector in the page editor
3. **Custom Patterns**: If you had custom regex patterns, create them as code-based patterns (see "Creating Custom Patterns" above)

**What Changed**:

- Old: `path_pattern = "^(?P<slug>[\w-]+)/$"` (arbitrary regex string)
- New: `path_pattern_key = "news_slug"` (registry key)

**Benefits**:

- Eliminates ReDoS security vulnerabilities
- Better UX with pattern previews and metadata
- Easier to maintain and document patterns
- Patterns can be shared across apps

### For Existing Pages

1. **No changes required**: Pages without path patterns work exactly as before
2. **Opt-in feature**: Only pages with `path_pattern_key` set use pattern matching
3. **Backward compatible**: Empty or null `path_pattern_key` means no pattern matching

### Adding Object Publishing

To convert a listing page to support both listing and detail views:

1. **Set path pattern on page** via Settings Editor or API:
   ```python
   news_page.path_pattern_key = "news_slug"
   news_page.save()
   ```

2. **Update or create widgets** that check for path variables:
   ```python
   def prepare_template_context(self, config, context=None):
       path_vars = context.get('path_variables', {})
       
       if 'slug' in path_vars:  # Note: variable name from pattern definition
           # Detail view
           return {'object': fetch_object(path_vars['slug'])}
       else:
           # List view
           return {'objects': fetch_list()}
   ```

3. **Test URL resolution**:
   - Visit `/news/` → should show list
   - Visit `/news/some-article/` → should show detail
   - Visit `/news/archive/` (if exists) → should show archive page

**Important**: Check the pattern's `extracted_variables` to know what variable names will be available (e.g., "slug", "news_slug", "year", etc.)

## Best Practices

### Pattern Design

1. **Use named groups**: Always use `(?P<name>...)` for captures
2. **Be specific**: Use specific patterns like `\d{4}` for years, not just `\d+`
3. **Validate format**: Ensure patterns match your slug format (e.g., `[\w-]+`)
4. **Include anchors**: Use `^` and `$` for exact matching

### Widget Design

1. **Check for path variables**: Always check if path_variables exist and are expected
2. **Fail gracefully**: Return None or empty result if variables missing
3. **Validate values**: Don't trust path variables - validate before database queries
4. **Use get() not filter()[0]**: Handle DoesNotExist gracefully

### URL Structure

1. **Consistent patterns**: Use same pattern style across similar content types
2. **Reserved slugs**: Document any slug values reserved for child pages (e.g., "archive")
3. **SEO friendly**: Keep slugs readable and meaningful

## Common Patterns

### News/Blog Articles
```python
path_pattern_key = "news_slug"
# Matches: /news/article-title/ → {"slug": "article-title"}
```

### Dated Content
```python
path_pattern_key = "date_slug"
# Matches: /blog/2024/12/post-title/ → {"year": "2024", "month": "12", "slug": "post-title"}
```

### Categorized Items
```python
path_pattern_key = "category_slug"
# Matches: /library/reports/annual-2024/ → {"category": "reports", "slug": "annual-2024"}
```

### Member Profiles
```python
path_pattern_key = "member_slug"
# Matches: /members/john-doe/ → {"slug": "john-doe"}
```

### Yearly Content
```python
path_pattern_key = "year_slug"
# Matches: /reports/2025/annual/ → {"year": "2025", "slug": "annual"}
```

### Numeric IDs
```python
path_pattern_key = "numeric_id"
# Matches: /items/12345/ → {"id": "12345"}
```

## Troubleshooting

### Pattern Not Matching

**Problem**: URL doesn't match expected pattern

**Solutions**:
- Check pattern syntax with online regex tester
- Ensure anchors (`^` and `$`) are present
- Verify remaining path format (should end with `/`)
- Check for typos in capture group names

### 404 Errors

**Problem**: Getting 404 when expecting pattern match

**Solutions**:
- Verify page has `path_pattern` set
- Check that parent page exists and is published
- Ensure pattern matches the remaining path exactly
- Look for child pages that might be taking precedence

### Variables Not in Context

**Problem**: Widget doesn't receive expected path_variables

**Solutions**:
- Verify pattern has named groups `(?P<name>...)`
- Check that URL matches pattern
- Ensure widget accesses `context.get('path_variables', {})`
- Add logging to see what variables are captured

### Widget Shows Wrong Content

**Problem**: Widget shows list when expecting detail or vice versa

**Solutions**:
- Add logging to widget's `prepare_template_context`
- Check logic for detecting path_variables presence
- Verify object lookup is correct
- Check that widget handles both modes

## API Access

### Reading path_pattern_key

```python
# Via serializer
from webpages.serializers import WebPageSimpleSerializer

page = WebPage.objects.get(slug="news")
serializer = WebPageSimpleSerializer(page)
pattern_key = serializer.data['path_pattern_key']
```

### Setting path_pattern_key

```python
# Via API
PATCH /api/v1/webpages/pages/{id}/
{
    "path_pattern_key": "news_slug"
}
```

### Listing Available Patterns

```python
# Via API
GET /api/v1/webpages/path-patterns/

# Returns:
{
    "count": 8,
    "patterns": [
        {
            "key": "news_slug",
            "name": "News Article Slug",
            "description": "Captures a single news article slug...",
            "regex_pattern": "^(?P<slug>[\\w-]+)/$",
            "example_url": "my-article/",
            "extracted_variables": [...]
        },
        ...
    ]
}
```

To get a specific pattern:

```python
GET /api/v1/webpages/path-patterns/{pattern_key}/
```

### Frontend Integration

The `path_pattern_key` field is available in page editor with the PathPatternSelector component:

```javascript
// Import the component
import PathPatternSelector from './PathPatternSelector';

// Use in your form
<PathPatternSelector
    value={page.path_pattern_key}
    onChange={(value) => updatePage({ path_pattern_key: value })}
/>

// Or via API
const page = await fetch('/api/v1/webpages/pages/123/').then(r => r.json());
console.log(page.path_pattern_key);  // "news_slug"

// Update pattern
await fetch('/api/v1/webpages/pages/123/', {
    method: 'PATCH',
    body: JSON.stringify({
        path_pattern_key: "date_slug"
    })
});
```

## Testing

### Unit Tests

Test path resolution logic:

```python
def test_pattern_extraction(self):
    view = HostnamePageView()
    pattern_key = "news_slug"
    variables = view._extract_path_variables(pattern_key, "my-article/")
    
    assert variables == {"slug": "my-article"}
```

Test pattern registry:

```python
from webpages.path_pattern_registry import path_pattern_registry

def test_pattern_registry(self):
    pattern = path_pattern_registry.get_pattern("news_slug")
    assert pattern is not None
    assert pattern.key == "news_slug"
    
    result = pattern.validate_match("my-article/")
    assert result == {"slug": "my-article"}
```

### Integration Tests

Test full request flow:

```python
def test_object_page_request(self):
    response = self.client.get('/news/my-article/')
    assert response.status_code == 200
    # Verify rendered content includes article details
```

### Manual Testing

1. Create page with pattern
2. Visit listing URL (e.g., `/news/`) - should show list
3. Visit detail URL (e.g., `/news/test/`) - should show detail
4. Create child page and verify precedence
5. Test invalid paths return 404

## Implemented Enhancements (October 2025)

The following enhancements have been implemented in the registry-based system:

1. ✅ **Pattern templates**: Registry provides pre-built patterns for common use cases
2. ✅ **Variable type hints**: Patterns include metadata about variable types
3. ✅ **Pattern validation**: Patterns validated at code level, not runtime
4. ✅ **Pattern preview UI**: PathPatternSelector shows examples and variable tables
5. ✅ **Security improvements**: No ReDoS risk, code-based patterns only

## Future Enhancements

Potential future improvements:

1. **Pattern testing UI**: Test URLs against patterns in the page editor
2. **Automatic routing**: Auto-generate patterns based on model structure  
3. **Pattern debugging**: View matched variables in debug toolbar
4. **Multiple patterns**: Support multiple patterns with priority order
5. **Pattern analytics**: Track which patterns are most used

## Related Documentation

- [Widget System Documentation](WIDGET_SYSTEM_DOCUMENTATION_INDEX.md)
- [Content Models](../backend/content/models.py)
- [Public Views](../backend/webpages/public_views.py)
- [Widget Base Class](../backend/webpages/widget_registry.py)

