# ItemsListField Component

A reusable form field component for managing lists of complex items with multiple fields. Each item is displayed as an expandable card with a dynamic form based on its schema.

## Features

- ✅ **Add/Remove Items** - Easily add new items or remove existing ones
- ✅ **Expand/Collapse** - Items display as compact cards that expand to show full form
- ✅ **Dynamic Forms** - Automatically renders fields based on item schema
- ✅ **Schema-Driven** - Works with Pydantic `List[BaseModel]` schemas
- ✅ **Validation** - Per-item and list-level validation support
- ✅ **Customizable** - Configure labels, buttons, and empty states
- ✅ **Accessible** - ARIA labels, keyboard navigation, and focus management
- ✅ **Reorderable** - Optional drag-and-drop or arrow button reordering
- ✅ **Responsive** - Mobile-friendly interface

## Basic Usage

### Frontend Usage

```jsx
import ItemsListField from '@/components/form-fields/ItemsListField'

function MyForm() {
    const [menuItems, setMenuItems] = useState([
        { label: 'Home', url: '/', is_active: true }
    ])
    
    const itemSchema = {
        type: 'object',
        properties: {
            label: { type: 'string', title: 'Label' },
            url: { type: 'string', title: 'URL' },
            is_active: { type: 'boolean', title: 'Active' }
        }
    }
    
    return (
        <ItemsListField
            label="Menu Items"
            value={menuItems}
            onChange={setMenuItems}
            itemSchema={itemSchema}
            addButtonText="Add Menu Item"
            emptyText="No menu items yet"
            itemLabelTemplate={(item) => `${item.label} - ${item.url}`}
        />
    )
}
```

### Backend Integration (Pydantic)

```python
from pydantic import BaseModel, Field
from typing import List

class MenuItem(BaseModel):
    label: str = Field(..., description="Menu item label")
    url: str = Field(..., description="Menu item URL")
    is_active: bool = Field(False, description="Whether this item is active")

class NavigationConfig(BaseModel):
    menu_items: List[MenuItem] = Field(
        default_factory=list,
        description="Navigation menu items",
        json_schema_extra={
            "component": "ItemsListField",
            "addButtonText": "Add Menu Item",
            "emptyText": "No menu items added yet",
            "itemLabelTemplate": "label",  # Use 'label' field for display
        },
    )
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `Array` | `[]` | Array of items |
| `onChange` | `Function` | required | Called when items change |
| `label` | `String` | `null` | Field label |
| `description` | `String` | `null` | Field description |
| `required` | `Boolean` | `false` | Whether field is required |
| `disabled` | `Boolean` | `false` | Whether field is disabled |
| `validation` | `Object` | `null` | Validation result object |
| `isValidating` | `Boolean` | `false` | Whether validation is in progress |
| `itemSchema` | `Object` | required | JSON Schema for individual items |
| `itemLabelTemplate` | `Function\|String` | `null` | Function to generate item label, or property name |
| `defaultItem` | `Object\|Function` | `null` | Default values for new items |
| `maxItems` | `Number` | `null` | Maximum number of items allowed |
| `minItems` | `Number` | `null` | Minimum number of items required |
| `allowReorder` | `Boolean` | `false` | Enable reordering with arrow buttons |
| `allowAdd` | `Boolean` | `true` | Allow adding new items |
| `allowRemove` | `Boolean` | `true` | Allow removing items |
| `addButtonText` | `String` | `"Add Item"` | Text for add button |
| `emptyText` | `String` | `"No items added yet"` | Text shown when list is empty |
| `autoExpandNew` | `Boolean` | `true` | Auto-expand newly added items |
| `accordionMode` | `Boolean` | `false` | Only allow one item expanded at a time |

## Item Schema Format

The `itemSchema` prop accepts a JSON Schema object that defines the structure of each item:

```javascript
{
    type: 'object',
    properties: {
        fieldName: {
            type: 'string',         // or 'number', 'boolean', 'array'
            title: 'Field Label',
            description: 'Field description',
            format: 'email',        // Optional: 'email', 'url', 'date', 'textarea', etc.
            component: 'TextInput', // Optional: explicit component name
            default: '',            // Optional: default value
            // Validation
            minLength: 3,
            maxLength: 100,
            pattern: '^[a-z]+$',
            minimum: 0,
            maximum: 100
        }
    },
    required: ['fieldName']  // Array of required field names
}
```

## Examples

### Simple List with Custom Labels

```jsx
<ItemsListField
    label="Navigation Links"
    value={links}
    onChange={setLinks}
    itemSchema={{
        type: 'object',
        properties: {
            text: { type: 'string', title: 'Link Text' },
            href: { type: 'string', title: 'URL', format: 'url' }
        }
    }}
    itemLabelTemplate={(item) => item.text || 'New Link'}
/>
```

### With Max Items Limit

```jsx
<ItemsListField
    label="Featured Products (Max 3)"
    value={products}
    onChange={setProducts}
    itemSchema={productSchema}
    maxItems={3}
    itemLabelTemplate={(item) => `${item.name} - $${item.price}`}
/>
```

### With Reordering Enabled

```jsx
<ItemsListField
    label="Slides (Reorderable)"
    value={slides}
    onChange={setSlides}
    itemSchema={slideSchema}
    allowReorder={true}
    itemLabelTemplate={(item) => item.title}
/>
```

### With Custom Default Values

```jsx
<ItemsListField
    label="Team Members"
    value={members}
    onChange={setMembers}
    itemSchema={memberSchema}
    defaultItem={{
        name: '',
        role: 'Member',
        active: true
    }}
/>
```

### Accordion Mode (One at a Time)

```jsx
<ItemsListField
    label="FAQ Items"
    value={faqs}
    onChange={setFaqs}
    itemSchema={faqSchema}
    accordionMode={true}
    itemLabelTemplate={(item) => item.question}
/>
```

## Item Schema Definition

### Supported Field Types

The ItemsListField automatically maps schema types to the appropriate field components:

| Schema Type | Format | Component Used |
|-------------|--------|----------------|
| `string` | - | `TextInput` |
| `string` | `textarea` | `TextareaInput` |
| `string` | `email` | `EmailInput` |
| `string` | `url`, `uri` | `URLInput` |
| `string` | `password` | `PasswordInput` |
| `string` | `date` | `DateInput` |
| `string` | `datetime`, `date-time` | `DateTimeInput` |
| `string` | `time` | `TimeInput` |
| `string` | `color` | `ColorInput` |
| `number`, `integer` | - | `NumberInput` |
| `boolean` | - | `BooleanInput` |
| `string` with `enum` | - | `SelectInput` |
| `array` (strings) | - | `TagInput` |
| `array` with `enum` | - | `MultiSelectInput` |

### Using Explicit Components

You can override the automatic component selection:

```javascript
{
    type: 'object',
    properties: {
        content: {
            type: 'string',
            title: 'Content',
            component: 'RichTextInput',  // Explicit component
            props: {                      // Component-specific props
                toolbar: ['bold', 'italic', 'link']
            }
        }
    }
}
```

## Backend Configuration

### Pydantic Model with ItemsListField

```python
class SocialLink(BaseModel):
    platform: str = Field(..., description="Social media platform")
    url: str = Field(..., description="Profile URL")
    icon: str = Field("link", description="Icon name")

class FooterConfig(BaseModel):
    social_links: List[SocialLink] = Field(
        default_factory=list,
        description="Social media links",
        json_schema_extra={
            "component": "ItemsListField",
            "addButtonText": "Add Social Link",
            "itemLabelTemplate": "platform",
            "maxItems": 5,
        },
    )
```

### With Enums (Choice Fields)

```python
from enum import Enum

class Priority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class Task(BaseModel):
    title: str = Field(..., description="Task title")
    priority: Priority = Field(Priority.MEDIUM, description="Task priority")
    completed: bool = Field(False, description="Task status")

class TaskList(BaseModel):
    tasks: List[Task] = Field(
        default_factory=list,
        json_schema_extra={
            "component": "ItemsListField",
            "itemLabelTemplate": "title",
        },
    )
```

The enum automatically renders as a SelectInput in the form.

## Styling

The ItemsListField uses Tailwind CSS classes and follows the project's design system:

- Items are displayed in collapsible cards
- Expanded items have a subtle background color
- Action buttons use consistent hover states
- Validation errors are highlighted in red
- Empty state provides a clear call-to-action

## Accessibility

The component implements ARIA best practices:

- **ARIA Labels**: All interactive elements have descriptive labels
- **ARIA Expanded**: Expand/collapse state is announced
- **Keyboard Navigation**: Full keyboard support for all actions
- **Focus Management**: Logical focus order and visible focus indicators
- **Screen Reader Support**: Meaningful announcements for state changes

### Keyboard Shortcuts

- `Tab` / `Shift+Tab` - Navigate between interactive elements
- `Enter` / `Space` - Activate buttons and toggle expansion
- `Escape` - Close expanded item (optional, depends on implementation)

## Validation

### List-Level Validation

```jsx
const validation = {
    isValid: false,
    errors: ['At least 3 menu items are required']
}

<ItemsListField
    label="Menu Items"
    value={items}
    onChange={setItems}
    itemSchema={schema}
    validation={validation}
    minItems={3}
/>
```

### Per-Item Validation

Item validation is handled automatically based on the schema. The component:
1. Validates required fields
2. Checks type constraints (min/max, length, pattern)
3. Validates format (email, URL, etc.)
4. Displays errors in the item form

## Advanced Usage

### Custom Item Label Function

```jsx
const itemLabelTemplate = (item, index) => {
    if (!item.title) return `Item ${index + 1}`
    return item.is_published 
        ? `✓ ${item.title}` 
        : `✗ ${item.title} (draft)`
}

<ItemsListField
    itemLabelTemplate={itemLabelTemplate}
    // ...other props
/>
```

### Dynamic Default Values

```jsx
const generateDefaultItem = () => ({
    id: generateId(),
    created_at: new Date().toISOString(),
    title: '',
    content: ''
})

<ItemsListField
    defaultItem={generateDefaultItem}
    // ...other props
/>
```

## Testing

The component is fully tested with comprehensive unit tests covering:

- ✅ Rendering with label and description
- ✅ Empty state display
- ✅ Adding and removing items
- ✅ Expanding and collapsing items
- ✅ Custom label templates
- ✅ Validation error display
- ✅ Max/min items constraints
- ✅ Disabled state
- ✅ Reordering functionality

Run tests:
```bash
npm run test:run -- src/components/form-fields/__tests__/ItemsListField.test.jsx
```

## Integration with Widget System

ItemsListField integrates seamlessly with the widget configuration system:

1. **Backend**: Define your Pydantic model with `List[BaseModel]` field
2. **Schema Metadata**: Add `json_schema_extra` with `component: "ItemsListField"`
3. **Frontend**: The widget editor automatically renders ItemsListField
4. **Schema Resolution**: The system automatically resolves `$ref` schemas

No additional frontend code needed - it just works!

## Performance Considerations

- **Full UDC Integration**: ItemsListField, ItemCard, and ItemForm ALL implement UDC with independent componentIds
- **Zero Prop Drilling**: No item data flows through props after initial mount
- **No Parent Re-renders**: ItemForm publishes to UDC - parent forms never re-render on typing
- **No Debouncing Needed**: UDC handles update batching - immediate publishes
- **Local State**: All components use local state for instant UI feedback
- **React.memo Optimization**: All components memoized with smart prop comparison
- **Lazy-loaded Fields**: Field components lazy-loaded using React.Suspense
- **Independent Subscriptions**: Each component subscribes only to its own data slice

## UDC Architecture

### Component Hierarchy with UDC

```
ItemsListField (componentId: items-list-field-{widgetId}-{fieldName})
  ├─ UDC Integration: YES
  ├─ Manages: Array structure (add/remove/reorder)
  ├─ Subscribes: Array-level changes
  ├─ Publishes: Array mutations
  │
  └─ ItemCard (Pure UI - NO UDC)
      ├─ Purpose: Layout, expand/collapse, action buttons
      ├─ Props: initialItem, index, UI controls
      ├─ ~70 lines of simple UI code
      │
      └─ ItemForm (componentId: item-form-{widgetId}-{fieldName}-{index})
          ├─ UDC Integration: YES
          ├─ Manages: Single item data
          ├─ Subscribes: items[index] from UDC
          ├─ Publishes: Field changes (updates full array in UDC)
          ├─ Props: initialItem (once), context, schema
          └─ NO onChange callbacks!
```

### Why This Architecture?

1. **Only 2 UDC Components**: ItemsListField (array) + ItemForm (items) - simpler!
2. **ItemCard is Pure UI**: Just layout and buttons - no state management
3. **Clear Separation**: Array ops vs item data vs UI presentation
4. **Zero Prop Drilling**: Item data managed by ItemForm's UDC subscription
5. **No Callbacks**: ItemForm publishes directly to UDC

### Update Flow (Super Simple!)

```
User types in field →
  ItemForm local state updates (instant UI) →
  ItemForm publishes to UDC →
  UDC notifies subscribers →
  Other ItemForms update if needed →
  ItemsListField updates if needed →
  Perfect sync!
```

**Key insight**: Only 2 UDC componentIds needed! ItemCard is just UI chrome.

## Future Enhancements

Planned features:

- [ ] Virtual scrolling for large lists (100+ items)
- [ ] Bulk operations (select all, delete selected)
- [ ] Import/export items (JSON, CSV)
- [ ] Item templates/presets
- [ ] Conditional fields based on item values
- [ ] Nested ItemsListField support

## Troubleshooting

### Items not rendering

Ensure `itemSchema` is properly formatted and includes a `type: 'object'` and `properties` definition.

### Fields not showing in expanded item

Check that the schema `properties` object contains field definitions. Verify field types are supported.

### Custom component not loading

Ensure the component is registered in `FIELD_COMPONENTS` in `/frontend/src/components/form-fields/index.js`.

### $ref schemas not resolving

Make sure the full schema (with `$defs`) is passed to SchemaFieldRenderer via the `schema` prop.

## Related Components

- `ReorderableInput` - Simple list reordering without complex forms
- `TagInput` - Simple string list input
- `MultiSelectInput` - Multiple selection from predefined options

## Support

For issues or questions, see:
- [Component Source](../src/components/form-fields/ItemsListField.jsx)
- [Tests](../src/components/form-fields/__tests__/ItemsListField.test.jsx)
- [Form System Documentation](./FORM_SYSTEM.md)

