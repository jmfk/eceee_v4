/**
 * Schema Editor Components
 * 
 * Modular, dynamic schema editor system with property type registry
 * and self-contained configuration components.
 */

// Main components
export { default as SchemaEditor } from './SchemaEditor'
export { default as PropertyList } from './PropertyList'
export { default as PropertyItem } from './PropertyItem'
export { default as PropertyTypeSelector } from './PropertyTypeSelector'

// Registry system
export {
  default as PropertyTypeRegistry,
  getPropertyType,
  getAllPropertyTypes,
  getPropertyTypeByComponent,
  initializePropertyRegistry,
  isPropertyRegistryInitialized
} from './PropertyTypeRegistry'

// Shared components
export { default as PropertyIcon } from './components/PropertyIcon'
export { default as PropertyActions } from './components/PropertyActions'
export { default as PropertyPreview } from './components/PropertyPreview'

// Property config components
export { default as GenericPropertyConfig } from './property-configs/GenericPropertyConfig'
export { default as TextPropertyConfig } from './property-configs/TextPropertyConfig'
export { default as RichTextPropertyConfig } from './property-configs/RichTextPropertyConfig'
export { default as NumberPropertyConfig } from './property-configs/NumberPropertyConfig'
export { default as BooleanPropertyConfig } from './property-configs/BooleanPropertyConfig'
export { default as ChoicePropertyConfig } from './property-configs/ChoicePropertyConfig'
export { default as MultiChoicePropertyConfig } from './property-configs/MultiChoicePropertyConfig'
export { default as ImagePropertyConfig } from './property-configs/ImagePropertyConfig'
export { default as FilePropertyConfig } from './property-configs/FilePropertyConfig'
export { default as DatePropertyConfig } from './property-configs/DatePropertyConfig'
export { default as DateTimePropertyConfig } from './property-configs/DateTimePropertyConfig'
export { default as EmailPropertyConfig } from './property-configs/EmailPropertyConfig'
export { default as URLPropertyConfig } from './property-configs/URLPropertyConfig'
export { default as ColorPropertyConfig } from './property-configs/ColorPropertyConfig'
export { default as SliderPropertyConfig } from './property-configs/SliderPropertyConfig'