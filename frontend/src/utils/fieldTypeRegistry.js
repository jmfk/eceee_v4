/**
 * Frontend Field Type Registry
 * 
 * Manages field types by consuming definitions from backend API.
 * Provides dynamic loading of field type definitions and component mappings.
 */

import { Type, Hash, Calendar, ToggleLeft, Image, FileText, Link, Mail, List, Users, Database, Palette, Sliders, Tag, CalendarRange, Command, Search, AtSign, TreePine, ArrowLeftRight, Filter, GripVertical, Star, ToggleRight, Calculator } from 'lucide-react'
import apiClient from '../api/client'

// Icon mapping for field categories and types
const FIELD_ICONS = {
    // Category icons
    input: Type,
    selection: List,
    media: Image,
    reference: Database,
    special: Command,

    // Specific field type icons
    text: Type,
    rich_text: FileText,
    number: Hash,
    date: Calendar,
    datetime: Calendar,
    boolean: ToggleLeft,
    image: Image,
    file: FileText,
    url: Link,
    email: Mail,
    choice: List,
    multi_choice: List,
    user_reference: Users,
    object_reference: Database,
    // Advanced field types
    color: Palette,
    slider: Sliders,
    tags: Tag,
    date_range: CalendarRange,
    // Special interactive field types
    command_palette: Command,
    combobox: Search,
    mentions: AtSign,
    cascader: TreePine,
    transfer: ArrowLeftRight,
    // Advanced UI pattern field types
    rule_builder: Filter,
    reorderable_list: GripVertical,
    rating: Star,
    segmented_control: ToggleRight,
    numeric_stepper: Calculator,
}

class FieldTypeRegistry {
    constructor() {
        this.fieldTypes = new Map()
        this.loading = false
        this.loaded = false
        this.loadPromise = null
    }

    /**
     * Load field types from backend API
     */
    async loadFromBackend() {
        if (this.loaded || this.loading) {
            return this.loadPromise
        }

        this.loading = true
        this.loadPromise = this._fetchFieldTypes()

        try {
            await this.loadPromise
            this.loaded = true
        } catch (error) {
            console.error('Failed to load field types from backend:', error)
            // Fall back to empty registry - components can handle missing types
        } finally {
            this.loading = false
        }

        return this.loadPromise
    }

    /**
     * Fetch field types from backend API
     */
    async _fetchFieldTypes() {
        try {
            const response = await apiClient.get('/api/v1/utils/field-types/')
            const data = response.data

            // Process and register field types from backend
            if (data.fieldTypes && Array.isArray(data.fieldTypes)) {
                data.fieldTypes.forEach(fieldType => {
                    this.registerFieldType({
                        key: fieldType.key,
                        label: fieldType.label,
                        component: fieldType.component,
                        configComponent: fieldType.configComponent,
                        category: fieldType.category,
                        jsonSchemaType: fieldType.jsonSchemaType,
                        description: fieldType.description,
                        validationRules: fieldType.validationRules,
                        uiProps: fieldType.uiProps,
                        // Add icon based on field type or category
                        icon: FIELD_ICONS[fieldType.key] || FIELD_ICONS[fieldType.category] || Type,
                        // Generate default props for schema creation
                        defaultProps: this._generateDefaultProps(fieldType)
                    })
                })
            }

            console.log(`Loaded ${data.fieldTypes?.length || 0} field types from backend`)
        } catch (error) {
            console.error('Error fetching field types:', error)
            throw error
        }
    }

    /**
     * Generate default props for schema creation based on field type
     */
    _generateDefaultProps(fieldType) {
        const baseProps = {
            type: fieldType.jsonSchemaType,
            title: '',
            description: '',
        }

        // Add default value based on JSON schema type
        switch (fieldType.jsonSchemaType) {
            case 'string':
                baseProps.default = ''
                break
            case 'number':
            case 'integer':
                baseProps.default = 0
                break
            case 'boolean':
                baseProps.default = false
                break
            case 'array':
                baseProps.default = []
                break
            case 'object':
                baseProps.default = {}
                break
            default:
                baseProps.default = null
        }

        // Add field type specific props
        if (fieldType.uiProps) {
            Object.assign(baseProps, fieldType.uiProps)
        }

        return baseProps
    }

    registerFieldType({ key, label, icon, jsonSchemaType, component, configComponent, category, description, validationRules, uiProps, defaultProps, ...extra }) {
        // Register a new field type
        this.fieldTypes.set(key, {
            key,
            label,
            icon,
            jsonSchemaType,
            component,  // Updated from uiComponent
            configComponent,
            category,
            description,
            validationRules,
            uiProps,
            defaultProps,
            ...extra
        })
    }

    getFieldType(key) {
        // Get field type definition
        return this.fieldTypes.get(key)
    }

    getAllFieldTypes() {
        // Get all registered field types as array
        return Array.from(this.fieldTypes.values())
    }

    getFieldTypesObject() {
        // Get all field types as object with key mapping
        const result = {}
        this.fieldTypes.forEach((value, key) => {
            result[key] = value
        })
        return result
    }

    isValidFieldType(key) {
        // Check if field type is registered
        return this.fieldTypes.has(key)
    }

    getComponent(fieldType) {
        // Get component name for field type
        const field = this.getFieldType(fieldType)
        return field ? field.component : 'TextInput'
    }

    getConfigComponent(fieldType) {
        // Get config component name for field type
        const field = this.getFieldType(fieldType)
        return field ? field.configComponent : null
    }

    getDefaultProps(fieldType) {
        // Get default properties for creating new field of this type
        const field = this.getFieldType(fieldType)
        return field ? { ...field.defaultProps } : { type: 'string', fieldType: 'text' }
    }

    /**
     * Ensure field types are loaded before use
     */
    async ensureLoaded() {
        if (!this.loaded && !this.loading) {
            await this.loadFromBackend()
        } else if (this.loading) {
            await this.loadPromise
        }
    }

    /**
     * Register a custom field type at runtime
     * 
     * @param {Object} fieldTypeConfig - Field type configuration
     * @example
     * fieldTypeRegistry.registerCustomFieldType({
     *   key: 'color',
     *   label: 'Color Picker',
     *   icon: Palette,
     *   jsonSchemaType: 'string',
     *   component: 'ColorPicker',
     *   description: 'Color selection with picker',
     *   defaultProps: {
     *     type: 'string',
     *     format: 'color',
     *     default: '#000000'
     *   }
     * })
     */
    registerCustomFieldType(fieldTypeConfig) {
        this.registerFieldType(fieldTypeConfig)
        // Custom field type registered successfully
    }
}

// Global field type registry instance
export const fieldTypeRegistry = new FieldTypeRegistry()

// Convenience functions
export const getFieldType = (key) => fieldTypeRegistry.getFieldType(key)
export const getAllFieldTypes = () => fieldTypeRegistry.getAllFieldTypes()
export const getComponent = (fieldType) => fieldTypeRegistry.getComponent(fieldType)
export const getConfigComponent = (fieldType) => fieldTypeRegistry.getConfigComponent(fieldType)
export const getDefaultProps = (fieldType) => fieldTypeRegistry.getDefaultProps(fieldType)
export const registerCustomFieldType = (config) => fieldTypeRegistry.registerCustomFieldType(config)
export const ensureFieldTypesLoaded = () => fieldTypeRegistry.ensureLoaded()

// For backward compatibility with existing usage
export const getUIComponent = (fieldType) => fieldTypeRegistry.getComponent(fieldType)

// Dynamic FIELD_TYPES that loads from backend
export const getFieldTypes = async () => {
    await fieldTypeRegistry.ensureLoaded()
    return fieldTypeRegistry.getAllFieldTypes()
}

export default fieldTypeRegistry
