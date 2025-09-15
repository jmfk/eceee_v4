/**
 * Schema Editor Components Export Index
 * 
 * Centralized exports for all schema editor components.
 * This provides a clean API for importing schema editor functionality.
 */

// Main components
export { default as SchemaEditor } from './SchemaEditor'
export { default as PropertyList } from './PropertyList'
export { default as PropertyItem } from './PropertyItem'
export { default as PropertyTypeSelector } from './PropertyTypeSelector'

// Registry system
export { 
  propertyTypeRegistry,
  getPropertyType,
  getAllPropertyTypes,
  getPropertyTypesByCategory,
  getPropertyConfigComponent,
  getDefaultConfig,
  registerCustomPropertyType
} from './PropertyTypeRegistry'

// Property configuration components (for direct import if needed)
export { default as GenericPropertyConfig } from './property-configs/GenericPropertyConfig'
export { default as TextPropertyConfig } from './property-configs/TextPropertyConfig'
export { default as NumberPropertyConfig } from './property-configs/NumberPropertyConfig'
export { default as BooleanPropertyConfig } from './property-configs/BooleanPropertyConfig'
export { default as ChoicePropertyConfig } from './property-configs/ChoicePropertyConfig'

// Re-export the main SchemaEditor as default for convenience
export { default } from './SchemaEditor'
