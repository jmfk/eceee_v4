/**
 * Property Type Registry for Schema Editor
 * 
 * Dynamically loads field types from the backend and maps them to
 * property configuration components for the schema editor.
 */

import { fieldTypeRegistry, ensureFieldTypesLoaded } from '../../utils/fieldTypeRegistry'

// Import property config components
import TextPropertyConfig from './property-configs/TextPropertyConfig'
import RichTextPropertyConfig from './property-configs/RichTextPropertyConfig'
import NumberPropertyConfig from './property-configs/NumberPropertyConfig'
import BooleanPropertyConfig from './property-configs/BooleanPropertyConfig'
import ChoicePropertyConfig from './property-configs/ChoicePropertyConfig'
import MultiChoicePropertyConfig from './property-configs/MultiChoicePropertyConfig'
import ImagePropertyConfig from './property-configs/ImagePropertyConfig'
import FilePropertyConfig from './property-configs/FilePropertyConfig'
import DatePropertyConfig from './property-configs/DatePropertyConfig'
import DateTimePropertyConfig from './property-configs/DateTimePropertyConfig'
import EmailPropertyConfig from './property-configs/EmailPropertyConfig'
import URLPropertyConfig from './property-configs/URLPropertyConfig'
import ColorPropertyConfig from './property-configs/ColorPropertyConfig'
import SliderPropertyConfig from './property-configs/SliderPropertyConfig'
import GenericPropertyConfig from './property-configs/GenericPropertyConfig'

class PropertyTypeRegistry {
  constructor() {
    this.propertyConfigComponents = new Map()
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) return

    try {
      // Load field types from backend via existing registry
      await ensureFieldTypesLoaded()

      // Register property config components for each field type
      const fieldTypes = fieldTypeRegistry.getAllFieldTypes()

      fieldTypes.forEach(fieldType => {
        // Map field type to property config component
        const configComponent = this.getConfigComponentForFieldType(fieldType)

        this.propertyConfigComponents.set(fieldType.key, {
          key: fieldType.key,
          label: fieldType.label,
          icon: fieldType.icon,
          description: fieldType.description,
          category: fieldType.category,
          component: configComponent,
          fieldComponent: fieldType.component, // The actual form field component
          defaultConfig: {
            type: fieldType.jsonSchemaType,
            title: fieldType.label,
            description: "",
            component: fieldType.component,
            ...fieldType.defaultProps,
            ...fieldType.uiProps
          }
        })
      })

      this.initialized = true
      console.log(`Initialized property registry with ${fieldTypes.length} types`)
    } catch (error) {
      console.error('Failed to initialize property registry:', error)
      throw error
    }
  }

  getConfigComponentForFieldType(fieldType) {
    // Map component names to property config components
    const componentMap = {
      'TextInput': TextPropertyConfig,
      'TextareaInput': TextPropertyConfig, // Use same config as text
      'RichTextInput': RichTextPropertyConfig,
      'NumberInput': NumberPropertyConfig,
      'BooleanInput': BooleanPropertyConfig,
      'SelectInput': ChoicePropertyConfig,
      'MultiSelectInput': MultiChoicePropertyConfig,
      'ImageInput': ImagePropertyConfig,
      'FileInput': FilePropertyConfig,
      'DateInput': DatePropertyConfig,
      'DateTimeInput': DateTimePropertyConfig,
      'TimeInput': DatePropertyConfig, // Use same config as date
      'EmailInput': EmailPropertyConfig,
      'URLInput': URLPropertyConfig,
      'PasswordInput': TextPropertyConfig, // Use same config as text
      'ColorInput': ColorPropertyConfig,
      'SliderInput': SliderPropertyConfig,
      // Add more mappings as property config components are created
    }

    return componentMap[fieldType.component] || GenericPropertyConfig
  }

  getPropertyType(key) {
    return this.propertyConfigComponents.get(key)
  }

  getAllPropertyTypes() {
    return Array.from(this.propertyConfigComponents.values())
  }

  getPropertyTypeByComponent(componentName) {
    for (const propertyType of this.propertyConfigComponents.values()) {
      if (propertyType.defaultConfig.component === componentName) {
        return propertyType
      }
    }
    return null
  }

  getPropertyTypeByKey(key) {
    return this.propertyConfigComponents.get(key)
  }

  isInitialized() {
    return this.initialized
  }
}

// Global instance
export const propertyTypeRegistry = new PropertyTypeRegistry()

// Convenience functions
export const getPropertyType = (key) => propertyTypeRegistry.getPropertyType(key)
export const getAllPropertyTypes = () => propertyTypeRegistry.getAllPropertyTypes()
export const getPropertyTypeByComponent = (component) => propertyTypeRegistry.getPropertyTypeByComponent(component)
export const initializePropertyRegistry = () => propertyTypeRegistry.initialize()
export const isPropertyRegistryInitialized = () => propertyTypeRegistry.isInitialized()

export default propertyTypeRegistry