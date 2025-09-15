/**
 * Property Type Registry
 * 
 * Central registry system that manages all available property types for the schema editor.
 * Provides dynamic component loading, default configurations, and extensibility.
 */

import { 
  Type, 
  Hash, 
  ToggleLeft, 
  List, 
  Calendar, 
  Mail, 
  Link, 
  FileText, 
  Image, 
  Files,
  FolderOpen,
  Database,
  Users,
  Palette,
  Sliders,
  Tag,
  CalendarRange,
  Command,
  Search,
  AtSign,
  TreePine,
  ArrowLeftRight,
  Filter,
  GripVertical,
  Star,
  ToggleRight,
  Calculator
} from 'lucide-react'

// Import property configuration components (will be created in Phase 2)
// These will be lazy-loaded for better performance
const propertyConfigComponents = {
  TextPropertyConfig: () => import('./property-configs/TextPropertyConfig'),
  RichTextPropertyConfig: () => import('./property-configs/RichTextPropertyConfig'),
  NumberPropertyConfig: () => import('./property-configs/NumberPropertyConfig'),
  BooleanPropertyConfig: () => import('./property-configs/BooleanPropertyConfig'),
  ChoicePropertyConfig: () => import('./property-configs/ChoicePropertyConfig'),
  MediaPropertyConfig: () => import('./property-configs/MediaPropertyConfig'),
  DatePropertyConfig: () => import('./property-configs/DatePropertyConfig'),
  EmailPropertyConfig: () => import('./property-configs/EmailPropertyConfig'),
  URLPropertyConfig: () => import('./property-configs/URLPropertyConfig'),
  GenericPropertyConfig: () => import('./property-configs/GenericPropertyConfig'),
}

class PropertyTypeRegistry {
  constructor() {
    this.propertyTypes = new Map()
    this.componentCache = new Map()
    this.initialized = false
  }

  /**
   * Initialize the registry with default property types
   */
  initialize() {
    if (this.initialized) return

    // Register core property types
    this.registerPropertyType('TextInput', {
      label: 'Text Field',
      icon: Type,
      description: 'Single line text input',
      category: 'Basic',
      configComponent: 'TextPropertyConfig',
      defaultConfig: {
        type: "string",
        title: "Text Field",
        description: "",
        default: "",
        component: "TextInput",
        group: "Basic",
        order: 1,
        placeholder: "Enter text...",
        minLength: 0,
        maxLength: 255
      }
    })

    this.registerPropertyType('TextareaInput', {
      label: 'Rich Text',
      icon: FileText,
      description: 'Multi-line text editor',
      category: 'Basic',
      configComponent: 'RichTextPropertyConfig',
      defaultConfig: {
        type: "string",
        title: "Rich Text Field",
        description: "",
        default: "",
        component: "TextareaInput",
        group: "Basic",
        order: 2,
        rows: 6,
        placeholder: "Enter rich text..."
      }
    })

    this.registerPropertyType('NumberInput', {
      label: 'Number',
      icon: Hash,
      description: 'Numeric input field',
      category: 'Basic',
      configComponent: 'NumberPropertyConfig',
      defaultConfig: {
        type: "number",
        title: "Number Field",
        description: "",
        default: 0,
        component: "NumberInput",
        group: "Basic",
        order: 3,
        minimum: null,
        maximum: null,
        step: 1
      }
    })

    this.registerPropertyType('BooleanInput', {
      label: 'Boolean',
      icon: ToggleLeft,
      description: 'True/false toggle',
      category: 'Basic',
      configComponent: 'BooleanPropertyConfig',
      defaultConfig: {
        type: "boolean",
        title: "Boolean Field",
        description: "",
        default: false,
        component: "BooleanInput",
        group: "Basic",
        order: 4,
        variant: "toggle"
      }
    })

    this.registerPropertyType('SelectInput', {
      label: 'Choice Field',
      icon: List,
      description: 'Select from predefined options',
      category: 'Selection',
      configComponent: 'ChoicePropertyConfig',
      defaultConfig: {
        type: "string",
        title: "Choice Field",
        description: "",
        enum: ["Option 1", "Option 2"],
        default: null,
        component: "SelectInput",
        group: "Selection",
        order: 5,
        placeholder: "Select an option..."
      }
    })

    this.registerPropertyType('SegmentedControlInput', {
      label: 'Segmented Control',
      icon: ToggleRight,
      description: 'Segmented control with options',
      category: 'Selection',
      configComponent: 'ChoicePropertyConfig',
      defaultConfig: {
        type: "string",
        title: "Segmented Control",
        description: "",
        enum: ["Option 1", "Option 2"],
        default: "Option 1",
        component: "SegmentedControlInput",
        group: "Selection",
        order: 6,
        variant: "default",
        options: [
          {"value": "Option 1", "label": "Option 1"},
          {"value": "Option 2", "label": "Option 2"}
        ]
      }
    })

    this.registerPropertyType('DateInput', {
      label: 'Date',
      icon: Calendar,
      description: 'Date picker input',
      category: 'DateTime',
      configComponent: 'DatePropertyConfig',
      defaultConfig: {
        type: "string",
        title: "Date Field",
        description: "",
        default: null,
        component: "DateInput",
        group: "DateTime",
        order: 7,
        format: "date"
      }
    })

    this.registerPropertyType('EmailInput', {
      label: 'Email',
      icon: Mail,
      description: 'Email address input',
      category: 'Special',
      configComponent: 'EmailPropertyConfig',
      defaultConfig: {
        type: "string",
        title: "Email Field",
        description: "",
        default: "",
        component: "EmailInput",
        group: "Special",
        order: 8,
        format: "email",
        placeholder: "Enter email address..."
      }
    })

    this.registerPropertyType('URLInput', {
      label: 'URL',
      icon: Link,
      description: 'URL/link input',
      category: 'Special',
      configComponent: 'URLPropertyConfig',
      defaultConfig: {
        type: "string",
        title: "URL Field",
        description: "",
        default: "",
        component: "URLInput",
        group: "Special",
        order: 9,
        format: "uri",
        placeholder: "https://example.com"
      }
    })

    this.registerPropertyType('MediaInput', {
      label: 'Media File',
      icon: Image,
      description: 'Single media file from library',
      category: 'Media',
      configComponent: 'MediaPropertyConfig',
      defaultConfig: {
        type: "object",
        title: "Media Field",
        description: "",
        default: null,
        component: "MediaInput",
        group: "Media",
        order: 10,
        mediaTypes: ["image", "video", "audio", "document"],
        multiple: false
      }
    })

    // Advanced property types
    this.registerPropertyType('ColorInput', {
      label: 'Color',
      icon: Palette,
      description: 'Color picker input',
      category: 'Advanced',
      configComponent: 'GenericPropertyConfig',
      defaultConfig: {
        type: "string",
        title: "Color Field",
        description: "",
        default: "#000000",
        component: "ColorInput",
        group: "Advanced",
        order: 11,
        format: "color"
      }
    })

    this.registerPropertyType('SliderInput', {
      label: 'Slider',
      icon: Sliders,
      description: 'Numeric slider input',
      category: 'Advanced',
      configComponent: 'NumberPropertyConfig',
      defaultConfig: {
        type: "number",
        title: "Slider Field",
        description: "",
        default: 50,
        component: "SliderInput",
        group: "Advanced",
        order: 12,
        minimum: 0,
        maximum: 100,
        step: 1
      }
    })

    this.registerPropertyType('TagInput', {
      label: 'Tags',
      icon: Tag,
      description: 'Multiple tag input',
      category: 'Advanced',
      configComponent: 'GenericPropertyConfig',
      defaultConfig: {
        type: "array",
        title: "Tags Field",
        description: "",
        default: [],
        component: "TagInput",
        group: "Advanced",
        order: 13,
        items: { type: "string" }
      }
    })

    this.initialized = true
  }

  /**
   * Register a new property type
   */
  registerPropertyType(key, config) {
    this.propertyTypes.set(key, {
      key,
      ...config
    })
  }

  /**
   * Get property type configuration
   */
  getPropertyType(key) {
    if (!this.initialized) this.initialize()
    return this.propertyTypes.get(key)
  }

  /**
   * Get all registered property types
   */
  getAllPropertyTypes() {
    if (!this.initialized) this.initialize()
    return Array.from(this.propertyTypes.values())
  }

  /**
   * Get property types grouped by category
   */
  getPropertyTypesByCategory() {
    if (!this.initialized) this.initialize()
    const grouped = {}
    
    this.propertyTypes.forEach((type) => {
      const category = type.category || 'Other'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(type)
    })

    // Sort categories and types within each category
    const sortedGrouped = {}
    const categoryOrder = ['Basic', 'Selection', 'DateTime', 'Media', 'Special', 'Advanced', 'Other']
    
    categoryOrder.forEach(category => {
      if (grouped[category]) {
        sortedGrouped[category] = grouped[category].sort((a, b) => 
          (a.order || 999) - (b.order || 999)
        )
      }
    })

    return sortedGrouped
  }

  /**
   * Get property configuration component (lazy-loaded)
   */
  async getPropertyConfigComponent(componentName) {
    if (this.componentCache.has(componentName)) {
      return this.componentCache.get(componentName)
    }

    try {
      if (propertyConfigComponents[componentName]) {
        const module = await propertyConfigComponents[componentName]()
        const Component = module.default
        this.componentCache.set(componentName, Component)
        return Component
      }
    } catch (error) {
      console.warn(`Failed to load property config component '${componentName}':`, error)
    }

    // Fallback to generic config component
    if (!this.componentCache.has('GenericPropertyConfig')) {
      try {
        const module = await propertyConfigComponents.GenericPropertyConfig()
        const GenericComponent = module.default
        this.componentCache.set('GenericPropertyConfig', GenericComponent)
        this.componentCache.set(componentName, GenericComponent) // Cache as fallback
        return GenericComponent
      } catch (error) {
        console.error('Failed to load GenericPropertyConfig:', error)
        return null
      }
    }

    return this.componentCache.get('GenericPropertyConfig')
  }

  /**
   * Check if a property type exists
   */
  hasPropertyType(key) {
    if (!this.initialized) this.initialize()
    return this.propertyTypes.has(key)
  }

  /**
   * Get default configuration for a property type
   */
  getDefaultConfig(key) {
    const propertyType = this.getPropertyType(key)
    return propertyType ? { ...propertyType.defaultConfig } : null
  }

  /**
   * Register custom property type at runtime
   */
  registerCustomPropertyType(key, config) {
    this.registerPropertyType(key, {
      ...config,
      category: config.category || 'Custom'
    })
  }
}

// Global registry instance
export const propertyTypeRegistry = new PropertyTypeRegistry()

// Convenience functions
export const getPropertyType = (key) => propertyTypeRegistry.getPropertyType(key)
export const getAllPropertyTypes = () => propertyTypeRegistry.getAllPropertyTypes()
export const getPropertyTypesByCategory = () => propertyTypeRegistry.getPropertyTypesByCategory()
export const getPropertyConfigComponent = (componentName) => propertyTypeRegistry.getPropertyConfigComponent(componentName)
export const getDefaultConfig = (key) => propertyTypeRegistry.getDefaultConfig(key)
export const registerCustomPropertyType = (key, config) => propertyTypeRegistry.registerCustomPropertyType(key, config)

export default propertyTypeRegistry
