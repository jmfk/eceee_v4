# Content Widget Migration Strategy

## Overview

All rich text content from the legacy system will be migrated to **Content Widgets** rather than being stored as schema fields in ObjectInstance data. This is a fundamental architectural decision that separates structured metadata from unstructured content.

## Architecture Pattern

### What Goes Where

#### Schema Fields (ObjectInstance.data)
Store **structured metadata only**:
- Dates (event_start_date, deadline, etc.)
- Numbers (derivable_number, isbn, etc.)
- Titles and short text fields
- Enums/choices (event_type, priority, etc.)
- External references (external_url, etc.)

#### Content Widget (ObjectVersion.widgets)
Store **rich text content**:
- Article content/body
- Descriptions
- Abstracts
- Any HTML/Markdown formatted text
- Editorial content

### Example: News Article

```python
# ❌ OLD WAY (Don't do this)
object_data = {
    "title": "Energy Policy Update",
    "content": "<p>Long article content here...</p>",  # ❌ Wrong!
    "source_date": "2025-01-15"
}

# ✅ NEW WAY (Correct)
# Schema data (structured metadata)
object_data = {
    "title": "Energy Policy Update",
    "source_date": "2025-01-15",
    "external_url": "https://example.com/article"
}

# Content in widget (unstructured content)
content_widget = {
    "widget_type": "content",
    "content": "<p>Long article content here...</p>",  # ✅ Correct!
    "order": 0
}
```

## Benefits

### 1. Consistency
All object types use the same pattern for content editing and rendering

### 2. Flexibility
Content can include multiple widgets, not just a single text field

### 3. Clean Schema
Schemas remain focused on searchable, filterable metadata

### 4. Widget System Integration
Content leverages the full widget rendering pipeline

### 5. Future-Proof
Easy to add new widget types or enhance content capabilities

## Migration Implementation

### Step 1: Create ObjectInstance (Metadata Only)

```python
# Create the object with structured data
object_instance = ObjectInstance.objects.create(
    object_type=news_type,
    title=legacy_news.title,
    slug=legacy_news.slug,
    created_by=migration_user
)
```

### Step 2: Create ObjectVersion

```python
# Create version for the object
object_version = ObjectVersion.objects.create(
    object_instance=object_instance,
    data={
        "source_date": legacy_news.source_date,
        "external_url": legacy_news.external_url,
        # NO content field here!
    },
    effective_date=legacy_news.presentational_publishing_date,
    is_featured=legacy_news.publish_on_front_page,
    created_by=migration_user
)
```

### Step 3: Add Content Widget

```python
# Migrate content to a Content Widget
from webpages.models import ObjectWidget

content_widget = ObjectWidget.objects.create(
    object_version=object_version,
    widget_type="content",  # Use your content widget identifier
    configuration={
        "content": legacy_news.content,  # Rich text goes here
    },
    order=0,  # First widget
    created_by=migration_user
)
```

### Step 4: Set Current Version

```python
# Point object to this version
object_instance.current_version = object_version
object_instance.save()
```

## Content Widget Types

### Standard Content Widget
For general rich text content:

```python
{
    "widget_type": "content",
    "configuration": {
        "content": "<p>HTML content here</p>"
    }
}
```

### Rich Text Widget
For more complex formatting:

```python
{
    "widget_type": "rich_text",
    "configuration": {
        "content": "Markdown or HTML",
        "format": "html"  # or "markdown"
    }
}
```

## Legacy Content Field Mapping

| Legacy Model | Legacy Field | New Location |
|--------------|--------------|--------------|
| eceeeNews | content | Content Widget |
| EceeeCalenderEvent | content | Content Widget |
| EceeeJobsItem | description | Content Widget |
| EceeeLibraryItem | content | Content Widget |
| ProceedingPage | abstract | Content Widget |
| PanelPage | additional_information | Content Widget |
| ConferencePage | description | Content Widget |

## Content Cleanup During Migration

When migrating content to widgets:

1. **Clean HTML**: Remove legacy markup, inline styles
2. **Fix Images**: Update image URLs to new media system
3. **Handle Embeds**: Convert old embed codes to widget configuration
4. **Preserve Formatting**: Keep headings, lists, emphasis
5. **Strip Scripts**: Remove any <script> tags for security

```python
def migrate_content_to_widget(legacy_content, object_version, user):
    """
    Migrate legacy content field to Content Widget
    
    Args:
        legacy_content: Original HTML/text content
        object_version: Target ObjectVersion
        user: Migration user
    """
    # Clean the content
    cleaned_content = clean_legacy_html(legacy_content)
    
    # Create widget
    ObjectWidget.objects.create(
        object_version=object_version,
        widget_type="content",
        configuration={
            "content": cleaned_content
        },
        order=0,
        created_by=user
    )
```

## Querying Objects with Content

### Get Published Object with Content

```python
from object_storage.models import ObjectInstance

# Get object
obj = ObjectInstance.objects.get(slug='my-news')

# Get published version
version = obj.get_current_published_version()

# Get content widget
content_widget = version.widgets.filter(widget_type='content').first()
if content_widget:
    content_html = content_widget.configuration.get('content', '')
```

### Rendering in Templates

```django
{% for widget in published_version.widgets.all %}
    {% if widget.widget_type == 'content' %}
        <div class="content">
            {{ widget.configuration.content|safe }}
        </div>
    {% endif %}
{% endfor %}
```

## Validation

After migration, verify:

1. **No content in schema**: `object_version.data` should have no `content` field
2. **Content in widgets**: All objects have at least one content widget
3. **Content preserved**: Original content is intact
4. **Proper ordering**: Widgets have correct order values
5. **No broken HTML**: Content renders without errors

```python
# Validation script
from object_storage.models import ObjectInstance

for obj in ObjectInstance.objects.filter(object_type__name='news'):
    version = obj.current_version
    if not version:
        print(f"⚠️  No current version: {obj.title}")
        continue
    
    # Check no content in data
    if 'content' in version.data:
        print(f"❌ Content in data: {obj.title}")
    
    # Check has content widget
    has_content = version.widgets.filter(widget_type='content').exists()
    if not has_content:
        print(f"❌ No content widget: {obj.title}")
    else:
        print(f"✅ {obj.title}")
```

## Next Steps

1. Update news migration script to use Content Widgets
2. Apply same pattern to events, library, proceedings
3. Create content cleaning utilities
4. Add validation checks
5. Document widget configuration schema

## References

- Object Storage models: `backend/object_storage/models.py`
- Widget models: `backend/webpages/models.py`
- Migration plan: `extracted_models/eceee-data-migration.plan.md`

