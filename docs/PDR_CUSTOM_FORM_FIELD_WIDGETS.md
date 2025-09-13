# PDR: Custom React-Based Form Field Widgets System

**Product Requirements Document**  
**Version**: 1.0  
**Date**: December 2024  
**Status**: Planning Phase  

## Executive Summary

This PDR outlines the implementation of a custom React-based form field widget system for the ECEEE v4 CMS. The system will provide reusable, type-safe form field components that work across widget forms, admin forms, and object type forms, with a unified backend-frontend field type registry.

## Problem Statement

### Current Limitations
- **Limited Field Types**: Current form system supports only basic HTML input types
- **Inconsistent Implementation**: Different form systems use different field rendering approaches
- **No Custom UI Components**: Cannot implement advanced field types (date ranges, rich media selectors, etc.)
- **Poor Reusability**: Form fields are not easily reusable across different form contexts
- **Manual Synchronization**: Frontend and backend field definitions can get out of sync

### Business Impact
- **Developer Productivity**: Slow development of forms with custom requirements
- **User Experience**: Limited to basic HTML form controls
- **Maintenance Overhead**: Multiple form systems with different patterns
- **Feature Limitations**: Cannot implement advanced form interactions

## Goals and Objectives

### Primary Goals
1. **Unified Form Field System**: Single system for all form field types across the application
2. **Advanced Field Types**: Support for complex UI components (date ranges, media selectors, etc.)
3. **Type Safety**: Full type safety from backend schema to frontend rendering
4. **Reusability**: Components work in widget forms, admin forms, and object forms
5. **Developer Experience**: Simple, consistent patterns for adding new field types

### Success Metrics
- **Development Speed**: 50% faster form development for complex field types
- **Code Reuse**: 90% of form fields reusable across different contexts
- **Type Safety**: Zero runtime type errors in form field rendering
- **Maintainability**: Single source of truth for field type definitions

## Technical Requirements

### Functional Requirements

#### Backend Requirements
- **Field Type Registry**: Centralized registry for all field type definitions
- **API Endpoints**: RESTful API to serve field type definitions to frontend
- **Validation System**: Server-side validation for all field types
- **Schema Integration**: Integration with existing JSON Schema system
- **Django Admin Integration**: Custom widgets for Django admin forms

#### Frontend Requirements
- **Dynamic Component Loading**: Load field components based on backend definitions
- **Validation Integration**: Real-time validation with backend schema
- **Theme Integration**: Respect current Tailwind CSS theme system
- **Accessibility**: ARIA compliance and keyboard navigation
- **Performance**: Efficient rendering and bundle size optimization

### Non-Functional Requirements
- **Performance**: Field components render in <100ms
- **Accessibility**: WCAG 2.1 AA compliance
- **Browser Support**: Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)
- **Mobile Responsive**: All field types work on mobile devices
- **Bundle Size**: Individual field components <50KB gzipped

## Solution Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Backend       │    │   API Layer     │    │   Frontend      │
│                 │    │                 │    │                 │
│ Field Registry  │◄──►│ Field Types API │◄──►│ Component       │
│ Schema System   │    │ Validation API  │    │ Registry        │
│ Django Admin    │    │                 │    │ Form Renderer   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Component Architecture

#### Backend Components
1. **Field Type Registry** (`utils/schema_system.py`)
   - Central registry for field type definitions
   - Validation rules and JSON schema mappings
   - UI component specifications

2. **API Views** (`api/field_types.py`)
   - RESTful endpoints for field type definitions
   - Validation endpoints for form data

3. **Django Integration** (`admin.py`)
   - Custom widgets for Django admin
   - Form field generators

#### Frontend Components
1. **Field Type Registry** (`utils/fieldTypeRegistry.js`)
   - Consumer of backend field type definitions
   - Component loading and caching

2. **Form Field Components** (`components/form-fields/`)
   - Individual React components for each field type
   - Consistent props interface
   - Built-in validation display

3. **Form Renderers** (`components/forms/`)
   - Dynamic form rendering based on schema
   - Integration with existing form systems

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

#### Backend Changes
1. **Update Field Type Registry**
   ```python
   # backend/utils/schema_system.py
   register_field_type(
       key='text_single',
       label='Text Input',
       component='TextInput',  # Renamed from ui_component
       json_schema_type='string',
       validation_rules={
           'minLength': {'type': 'integer'},
           'maxLength': {'type': 'integer'}
       }
   )
   ```

2. **Create API Endpoints**
   ```python
   # backend/api/field_types.py
   @api_view(['GET'])
   def get_field_types(request):
       """Return all field type definitions"""
       return Response(field_registry.get_all_field_types())
   ```

#### Frontend Changes
1. **Update Field Type Registry**
   ```javascript
   // frontend/src/utils/fieldTypeRegistry.js
   class FieldTypeRegistry {
       async loadFromBackend() {
           const response = await fetch('/api/field-types/')
           const data = await response.json()
           // Populate registry from backend
       }
   }
   ```

2. **Create Base Field Components**
   ```javascript
   // frontend/src/components/form-fields/TextInput.jsx
   const TextInput = ({ value, onChange, validation, ...props }) => {
       return (
           <ValidatedInput
               type="text"
               value={value}
               onChange={onChange}
               validation={validation}
               {...props}
           />
       )
   }
   ```

### Phase 2: Core Field Types (Week 3-4)

#### Essential Field Types
1. **Text Fields**
   - `TextInput` - Basic text input
   - `TextareaInput` - Multi-line text
   - `RichTextInput` - Rich text editor
   - `PasswordInput` - Password with strength indicator

2. **Selection Fields**
   - `SelectInput` - Dropdown selection
   - `MultiSelectInput` - Multiple selection
   - `RadioInput` - Radio button group
   - `CheckboxInput` - Checkbox group

3. **Date/Time Fields**
   - `DateInput` - Single date picker
   - `DateRangeInput` - Date range picker
   - `TimeInput` - Time picker
   - `DateTimeInput` - Date and time picker

4. **Media Fields**
   - `ImageInput` - Image upload/selection
   - `FileInput` - File upload
   - `MediaInput` - Multi-media selection

### Phase 3: Integration (Week 5-6)

#### Form System Integration
1. **Widget Editor Integration**
   - Update `WidgetEditorPanel.jsx` to use new field system
   - Replace existing field rendering logic

2. **Object Type Form Integration**
   - Update `ObjectTypeForm.jsx` to use new field system
   - Schema-driven form generation

3. **Admin Form Integration**
   - Django admin widgets using new field types
   - Consistent UI across admin and frontend

### Phase 4: Advanced Features (Week 7-8)

#### Advanced Field Types
1. **Complex Fields**
   - `AddressInput` - Address with geocoding
   - `ColorInput` - Color picker
   - `SliderInput` - Range slider
   - `TagInput` - Tag selection with autocomplete

2. **Reference Fields**
   - `UserSelectorInput` - User selection with search
   - `ObjectSelectorInput` - Object reference with filtering
   - `RelationshipInput` - Multiple object relationships

#### Configuration Components
1. **Field Configuration UI**
   - Visual builders for field validation rules
   - Preview modes for field types
   - Drag-and-drop field ordering

## Technical Specifications

### Field Type Definition Schema

#### Backend Definition
```python
{
    'key': str,                    # Unique identifier
    'label': str,                  # Display name
    'component': str,              # React component name
    'config_component': str,       # Optional config UI component
    'json_schema_type': str,       # JSON Schema type
    'category': str,               # Field category (input, selection, etc.)
    'validation_rules': dict,      # Validation schema
    'ui_props': dict,              # Default UI properties
    'description': str,            # Help text
}
```

#### Frontend Component Interface
```javascript
interface FieldComponentProps {
    value: any
    onChange: (value: any) => void
    validation?: ValidationResult
    isValidating?: boolean
    label?: string
    description?: string
    required?: boolean
    disabled?: boolean
    [key: string]: any  // Additional props
}
```

### API Specifications

#### Field Types Endpoint
```
GET /api/field-types/
Response: {
    fieldTypes: FieldTypeDefinition[]
}
```

#### Validation Endpoint
```
POST /api/validate-field/
Request: {
    fieldType: string
    value: any
    rules?: object
}
Response: {
    isValid: boolean
    errors: string[]
    warnings: string[]
}
```

## File Structure

```
backend/
├── utils/
│   └── schema_system.py          # Enhanced field registry
├── api/
│   └── field_types.py           # API endpoints
└── admin/
    └── field_widgets.py         # Django admin widgets

frontend/
├── src/
│   ├── utils/
│   │   └── fieldTypeRegistry.js # Frontend registry
│   ├── components/
│   │   ├── form-fields/         # Individual field components
│   │   │   ├── TextInput.jsx
│   │   │   ├── DateInput.jsx
│   │   │   └── ...
│   │   ├── forms/
│   │   │   └── DynamicFormRenderer.jsx
│   │   └── validation/
│   │       └── ValidatedInput.jsx
│   └── api/
       └── fieldTypes.js         # API client
```

## Testing Strategy

### Unit Testing
- **Backend**: Test field type registration and validation
- **Frontend**: Test individual field components with Jest/React Testing Library
- **API**: Test field type endpoints with Django test client

### Integration Testing
- **Form Rendering**: Test complete form rendering with various field types
- **Validation**: Test end-to-end validation flow
- **Admin Integration**: Test Django admin form generation

### User Acceptance Testing
- **Usability**: Test form creation and editing workflows
- **Performance**: Test rendering performance with complex forms
- **Accessibility**: Test keyboard navigation and screen reader compatibility

## Risk Assessment

### Technical Risks
- **Performance Impact**: Dynamic component loading may affect performance
  - *Mitigation*: Implement component caching and lazy loading
- **Bundle Size**: Many field components may increase bundle size
  - *Mitigation*: Use code splitting and tree shaking
- **Browser Compatibility**: Advanced field types may not work in older browsers
  - *Mitigation*: Provide fallback components for unsupported features

### Implementation Risks
- **Migration Complexity**: Existing forms need to be migrated
  - *Mitigation*: Implement backward compatibility layer
- **Learning Curve**: Developers need to learn new patterns
  - *Mitigation*: Comprehensive documentation and examples

## Success Criteria

### Technical Success
- [ ] All existing form fields work with new system
- [ ] New field types can be added without frontend changes
- [ ] Form rendering performance is maintained or improved
- [ ] Zero runtime type errors in production

### User Experience Success
- [ ] Form creation time reduced by 50%
- [ ] Advanced field types work consistently across all browsers
- [ ] Accessibility compliance maintained
- [ ] Mobile form experience improved

## Future Considerations

### Potential Enhancements
1. **Visual Form Builder**: Drag-and-drop form creation interface
2. **Field Templates**: Pre-built field configurations for common use cases
3. **Conditional Logic**: Show/hide fields based on other field values
4. **Multi-step Forms**: Wizard-style form creation
5. **Form Analytics**: Track field completion and abandonment rates

### Scalability Considerations
1. **Plugin System**: Allow third-party field type plugins
2. **Theming System**: Comprehensive theming for different UI frameworks
3. **Internationalization**: Multi-language support for field labels and validation
4. **Performance Optimization**: Virtual scrolling for large forms

## Conclusion

This PDR outlines a comprehensive solution for implementing custom React-based form field widgets in the ECEEE v4 CMS. The proposed architecture provides a solid foundation for extensible, maintainable form field components while maintaining backward compatibility and performance.

The phased implementation approach ensures minimal disruption to existing functionality while providing immediate value through improved form creation capabilities. The focus on specific, simple components initially allows for rapid development and testing, with opportunities for optimization and DRY principles in future iterations.
