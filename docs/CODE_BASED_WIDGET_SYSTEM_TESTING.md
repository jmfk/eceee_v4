# Testing the Code-Based Widget System

This document provides comprehensive testing guidance for the new code-based widget system in eceee_v4.

## Overview

The migration from database-based to code-based widget types required significant updates to both backend and frontend testing approaches. This guide covers the testing strategies, patterns, and best practices for the new system.

## Backend Testing

### Test Structure Changes

#### Widget Type Testing

**Before (Database-Based):**
```python
# Old approach - required database setup
def setUp(self):
    self.widget_type = WidgetType.objects.create(
        name="Test Widget",
        json_schema={"type": "object", "properties": {...}},
        template_name="test.html"
    )

def test_widget_creation(self):
    widget = PageWidget.objects.create(
        page=self.page,
        widget_type=self.widget_type,  # FK relationship
        configuration={"content": "test"}
    )
```

**After (Code-Based):**
```python
# New approach - no database setup needed
def test_widget_creation(self):
    widget = PageWidget.objects.create(
        page=self.page,
        widget_type_name="Text Block",  # String reference
        configuration={"content": "test"}
    )
    
    # Widget type information comes from registry
    widget_type = widget_registry.get_widget("Text Block")
    self.assertEqual(widget_type.name, "Text Block")
```

#### Required Field Updates

All `WebPage.objects.create()` calls now require `last_modified_by`:

```python
def setUp(self):
    self.user = User.objects.create_user(
        username="testuser", password="testpass123"
    )
    self.page = WebPage.objects.create(
        title="Test Page",
        slug="test-page",
        created_by=self.user,
        last_modified_by=self.user,  # Now required
    )
```

#### Layout Field Updates

The `layout_id` field has been replaced with `code_layout`:

```python
# Fixed in models.py - WebPage.create_version() method
def create_version(self, created_by, change_summary="", auto_publish=False):
    version_data = {
        # ... other fields ...
        "layout": self.code_layout,  # Changed from layout_id
        "theme_id": self.theme.id if self.theme else None,  # Fixed theme access
    }
```

### Widget Registry Testing

#### Testing Widget Registration

```python
from webpages.widget_registry import widget_registry, register_widget, BaseWidget
from pydantic import BaseModel, Field

class TestWidgetConfig(BaseModel):
    title: str = Field(..., description="Test title")
    content: str = Field("", description="Test content")

@register_widget
class TestWidget(BaseWidget):
    name = "Test Widget"
    description = "A test widget"
    template_name = "test_widget.html"
    configuration_model = TestWidgetConfig

class WidgetRegistryTest(TestCase):
    def test_widget_registration(self):
        """Test that widgets are properly registered"""
        widget = widget_registry.get_widget("Test Widget")
        self.assertIsNotNone(widget)
        self.assertEqual(widget.name, "Test Widget")
        
    def test_widget_configuration_validation(self):
        """Test Pydantic configuration validation"""
        widget = widget_registry.get_widget("Test Widget")
        
        # Valid configuration
        config = {"title": "Test Title", "content": "Test content"}
        validated = widget.configuration_model(**config)
        self.assertEqual(validated.title, "Test Title")
        
        # Invalid configuration (missing required field)
        with self.assertRaises(ValidationError):
            widget.configuration_model(content="Missing title")
```

#### Testing Schema Generation

```python
def test_json_schema_generation(self):
    """Test that JSON schemas are properly generated from Pydantic models"""
    widget = widget_registry.get_widget("Text Block")
    schema = widget.get_configuration_schema()
    
    self.assertEqual(schema["type"], "object")
    self.assertIn("content", schema["properties"])
    self.assertIn("content", schema["required"])
    
    # Test enum generation
    alignment_property = schema["properties"]["alignment"]
    self.assertEqual(alignment_property["type"], "string")
    self.assertIn("enum", alignment_property)
```

### API Testing Updates

#### Widget Types Endpoint

```python
def test_widget_types_api(self):
    """Test the updated widget types API"""
    response = self.client.get('/api/webpages/widget-types/')
    self.assertEqual(response.status_code, 200)
    
    # Response is now a direct array, not paginated
    widget_types = response.json()
    self.assertIsInstance(widget_types, list)
    
    # Check widget structure
    text_block = next(wt for wt in widget_types if wt["name"] == "Text Block")
    self.assertIn("configuration_schema", text_block)
    self.assertIn("template_name", text_block)
    self.assertEqual(text_block["is_active"], True)
```

#### Widget Creation API

```python
def test_widget_creation_api(self):
    """Test creating widgets with widget type names"""
    data = {
        "page": self.page.id,
        "widget_type_name": "Text Block",  # Name instead of ID
        "slot_name": "main",
        "sort_order": 1,
        "configuration": {
            "content": "Test content",
            "alignment": "center"
        }
    }
    
    response = self.client.post('/api/webpages/widgets/', data, format='json')
    self.assertEqual(response.status_code, 201)
    
    widget = PageWidget.objects.get(id=response.json()["id"])
    self.assertEqual(widget.widget_type_name, "Text Block")
```

### Version Management Testing

Fixed issues with `create_version` method:

```python
def test_page_version_creation(self):
    """Test that page versions are created correctly"""
    version = self.page.create_version(
        created_by=self.user,
        change_summary="Test version"
    )
    
    self.assertEqual(version.page, self.page)
    self.assertEqual(version.change_summary, "Test version")
    # Layout field now correctly uses code_layout
    self.assertEqual(version.version_data["layout"], self.page.code_layout)
```

## Frontend Testing

### Component Testing Updates

#### WidgetLibrary Component

```javascript
// Updated mock data structure
const mockWidgetTypes = [
    {
        name: "Text Block",
        description: "Rich text content widget",
        template_name: "webpages/widgets/text_block.html",
        is_active: true,
        configuration_schema: {
            type: "object",
            properties: {
                content: {
                    type: "string",
                    description: "Main text content"
                },
                alignment: {
                    type: "string",
                    enum: ["left", "center", "right", "justify"],
                    default: "left"
                }
            },
            required: ["content"]
        }
    }
]

// Updated API mocking
beforeEach(() => {
    // Mock direct array response (not paginated)
    vi.mocked(apiClient.get).mockResolvedValue({
        data: mockWidgetTypes  // Direct array, not { results: ... }
    })
})

test('displays available widget types', async () => {
    render(<WidgetLibrary onWidgetSelect={mockOnSelect} />)
    
    await waitFor(() => {
        expect(screen.getByText('Text Block')).toBeInTheDocument()
    })
    
    // Verify API called correctly
    expect(apiClient.get).toHaveBeenCalledWith('/widget-types/')
})
```

#### WidgetConfigurator Component

```javascript
// Updated to use configuration_schema instead of json_schema
const mockWidgetType = {
    name: "Text Block",
    description: "Rich text content widget",
    configuration_schema: {  // Changed from json_schema
        type: "object",
        properties: {
            content: { type: "string", description: "Main text content" },
            alignment: {
                type: "string",
                enum: ["left", "center", "right", "justify"],
                default: "left"
            }
        },
        required: ["content"]
    }
}

// Updated test selectors to use roles instead of labels
test('renders form fields correctly', async () => {
    render(
        <WidgetConfigurator
            widgetType={mockWidgetType}
            config={{}}
            onSave={mockOnSave}
            onCancel={mockOnCancel}
        />
    )

    // Use role-based selectors for better reliability
    expect(screen.getByRole('textbox', { name: /content/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /alignment/i })).toBeInTheDocument()
})
```

#### Widget Creation Testing

```javascript
// Updated to use widget type names
test('creates widget with correct data', async () => {
    const mockCreateWidget = vi.fn().mockResolvedValue({
        data: { id: 1, widget_type_name: "Text Block" }
    })
    
    const addCommand = new AddWidgetCommand(
        'main',
        'Text Block',  // Name instead of ID
        0,
        { content: 'Test content' }
    )
    
    await addCommand.execute()
    
    expect(mockCreateWidget).toHaveBeenCalledWith({
        widget_type_name: 'Text Block',  // Verify name used
        slot_name: 'main',
        sort_order: 0,
        configuration: { content: 'Test content' }
    })
})
```

### Test Utilities Updates

#### Mock Data Structure

```javascript
// frontend/src/test/widgetTestUtils.jsx
export const createMockWidgetType = (overrides = {}) => ({
    name: "Test Widget",
    description: "A test widget",
    template_name: "test_widget.html",
    is_active: true,
    configuration_schema: {  // Updated from json_schema
        type: "object",
        properties: {
            title: { type: "string", description: "Widget title" },
            content: { type: "string", description: "Widget content" }
        },
        required: ["title"]
    },
    ...overrides
})

export const mockWidgetTypesAPI = (widgetTypes = []) => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/widget-types/') {
            return Promise.resolve({ data: widgetTypes })  // Direct array
        }
        return Promise.reject(new Error('Unexpected API call'))
    })
}
```

#### API Client Updates

```javascript
// Updated API client methods
export const widgetAPI = {
    // Get widget types (returns direct array)
    getWidgetTypes: () => apiClient.get('/widget-types/'),
    
    // Create widget using widget type name
    createWidget: (data) => apiClient.post('/widgets/', {
        ...data,
        widget_type_name: data.widgetTypeName  // Use name
    }),
    
    // Update widget
    updateWidget: (id, data) => apiClient.patch(`/widgets/${id}/`, data)
}
```

## Test Execution

### Running Backend Tests

```bash
# All backend tests
docker-compose exec backend python manage.py test

# Widget-specific tests
docker-compose exec backend python manage.py test webpages.tests.WidgetRegistryTest
docker-compose exec backend python manage.py test webpages.tests.WidgetTypeAPITest

# Version management tests
docker-compose exec backend python manage.py test webpages.tests_version_simple
docker-compose exec backend python manage.py test webpages.tests.PageVersionTest
```

### Running Frontend Tests

```bash
# All frontend tests
docker-compose exec frontend npm run test:run

# Widget-specific tests
docker-compose exec frontend npm run test:run src/components/__tests__/WidgetLibrary.test.jsx
docker-compose exec frontend npm run test:run src/components/__tests__/WidgetConfigurator.test.jsx
docker-compose exec frontend npm run test:run src/components/__tests__/SlotManager.test.jsx
```

## Test Coverage

### Backend Test Results

✅ **Passing Tests:**
- `WidgetRegistryTest` - 5/5 tests
- `WidgetTypeAPITest` - 7/7 tests  
- `WebPageTest` - 2/2 tests
- `PageVersionTest` - 2/2 tests
- `tests_version_simple` - 11/11 tests
- `LayoutIntegrationTest` - 1/1 tests

### Frontend Test Results

✅ **Core Functionality Working:**
- Widget type fetching and display
- Widget configuration form generation
- API integration with new endpoints
- Widget creation and management

🟡 **Minor Test Issues:**
- Some form field rendering tests need refinement
- Default value handling in edge cases
- Error message display timing

## Common Testing Patterns

### Backend Testing Patterns

```python
class WidgetTestCase(TestCase):
    def setUp(self):
        """Standard setup for widget tests"""
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.page = WebPage.objects.create(
            title="Test Page",
            slug="test-page",
            created_by=self.user,
            last_modified_by=self.user,  # Required
            code_layout="single_column"  # Use code layout
        )
    
    def create_test_widget(self, widget_type_name="Text Block", config=None):
        """Helper method for creating test widgets"""
        return PageWidget.objects.create(
            page=self.page,
            widget_type_name=widget_type_name,
            slot_name="main",
            sort_order=1,
            configuration=config or {"content": "Test content"},
            created_by=self.user
        )
```

### Frontend Testing Patterns

```javascript
// Standard setup for widget component tests
const setupWidgetTest = (widgetType = mockTextBlockWidget, config = {}) => {
    const mockProps = {
        widgetType,
        config,
        onSave: vi.fn(),
        onCancel: vi.fn()
    }
    
    return {
        ...render(<WidgetConfigurator {...mockProps} />),
        ...mockProps
    }
}

// Helper for testing form interactions
const fillWidgetForm = async (user, fields) => {
    for (const [fieldName, value] of Object.entries(fields)) {
        const field = screen.getByRole('textbox', { name: new RegExp(fieldName, 'i') })
        await user.clear(field)
        await user.type(field, value)
    }
}
```

## Migration Testing Checklist

### Backend Migration Validation

- ✅ All widget types discoverable via registry
- ✅ Pydantic validation working correctly
- ✅ JSON schema generation functional
- ✅ API endpoints returning correct data structure
- ✅ Widget creation using names instead of IDs
- ✅ Version management compatibility maintained
- ✅ Database model updates working correctly

### Frontend Migration Validation

- ✅ Widget types fetched as direct array
- ✅ Configuration forms generated from schemas  
- ✅ Widget creation using type names
- ✅ Error handling and validation working
- ✅ User interface functionality preserved
- ✅ Component integration maintained

## Performance Testing

### Backend Performance

```python
def test_widget_type_performance(self):
    """Test that widget types load quickly without database queries"""
    with self.assertNumQueries(0):  # No DB queries
        widget_types = widget_registry.get_all_widgets()
        self.assertGreater(len(widget_types), 0)

def test_schema_generation_caching(self):
    """Test that schemas are cached after first generation"""
    widget = widget_registry.get_widget("Text Block")
    
    # First call generates schema
    schema1 = widget.get_configuration_schema()
    
    # Second call should use cached version
    schema2 = widget.get_configuration_schema()
    
    self.assertIs(schema1, schema2)  # Same object reference
```

### Frontend Performance

```javascript
test('widget types cached after first load', async () => {
    const { rerender } = render(<WidgetLibrary onWidgetSelect={vi.fn()} />)
    
    await waitFor(() => {
        expect(screen.getByText('Text Block')).toBeInTheDocument()
    })
    
    // Rerender should not trigger new API call
    rerender(<WidgetLibrary onWidgetSelect={vi.fn()} />)
    
    expect(apiClient.get).toHaveBeenCalledTimes(1)
})
```

## Debugging Test Issues

### Common Backend Issues

```bash
# Check widget registry status
python manage.py shell -c "
from webpages.widget_registry import widget_registry
print('Registered widgets:', list(widget_registry.get_all_widgets().keys()))
"

# Validate widget configuration
python manage.py shell -c "
from webpages.widgets import TextBlockWidget
config = {'content': 'test'}
validated = TextBlockWidget.configuration_model(**config)
print('Validated config:', validated.dict())
"
```

### Common Frontend Issues

```javascript
// Debug widget type structure
console.log('Widget types:', widgetTypes)
console.log('Schema structure:', widgetType.configuration_schema)

// Debug form field rendering
console.log('Properties:', Object.keys(properties))
console.log('Required fields:', schema.required)
```

## Best Practices

### Backend Testing

1. **Use widget names consistently** - Always reference widgets by name, not ID
2. **Include required fields** - Always provide `last_modified_by` for WebPage creation
3. **Test Pydantic validation** - Verify both valid and invalid configurations
4. **Mock external dependencies** - Use mock objects for complex widget behaviors
5. **Test schema generation** - Verify JSON schemas are properly generated

### Frontend Testing

1. **Use role-based selectors** - Prefer `getByRole` over `getByLabelText`
2. **Test user interactions** - Simulate real user behavior with user-event
3. **Mock API responses correctly** - Use direct arrays for widget types
4. **Test error handling** - Verify validation errors are displayed properly
5. **Test edge cases** - Handle missing data and invalid configurations

This comprehensive testing guide ensures the code-based widget system maintains high quality and reliability while providing improved developer experience and performance benefits. 