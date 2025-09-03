/**
 * Frontend Field Type Registry
 * 
 * Manages field types and their UI component mappings.
 * Provides extensible system for adding new field types.
 */

import { Type, Hash, Calendar, ToggleLeft, Image, FileText, Link, Mail, List, Users, Database } from 'lucide-react'

class FieldTypeRegistry {
    constructor() {
        this.fieldTypes = new Map()
        this.registerCoreTypes()
    }

    registerCoreTypes() {
        const coreTypes = [
            {
                key: 'text',
                label: 'Text',
                icon: Type,
                jsonSchemaType: 'string',
                uiComponent: 'TextInput',
                description: 'Single line text input',
                defaultProps: {
                    type: 'string',
                    title: '',
                    description: '',
                    default: ''
                }
            },
            {
                key: 'rich_text',
                label: 'Rich Text',
                icon: FileText,
                jsonSchemaType: 'string',
                uiComponent: 'RichTextEditor',
                description: 'Rich text editor with formatting',
                defaultProps: {
                    type: 'string',
                    title: '',
                    description: '',
                    default: '',
                    format: 'textarea'
                }
            },
            {
                key: 'number',
                label: 'Number',
                icon: Hash,
                jsonSchemaType: 'number',
                uiComponent: 'NumberInput',
                description: 'Numeric input',
                defaultProps: {
                    type: 'number',
                    title: '',
                    description: '',
                    default: 0
                }
            },
            {
                key: 'date',
                label: 'Date',
                icon: Calendar,
                jsonSchemaType: 'string',
                uiComponent: 'DatePicker',
                description: 'Date picker',
                defaultProps: {
                    type: 'string',
                    title: '',
                    description: '',
                    format: 'date',
                    default: ''
                }
            },
            {
                key: 'datetime',
                label: 'Date & Time',
                icon: Calendar,
                jsonSchemaType: 'string',
                uiComponent: 'DateTimePicker',
                description: 'Date and time picker',
                defaultProps: {
                    type: 'string',
                    title: '',
                    description: '',
                    format: 'date-time',
                    default: ''
                }
            },
            {
                key: 'boolean',
                label: 'Boolean',
                icon: ToggleLeft,
                jsonSchemaType: 'boolean',
                uiComponent: 'ToggleInput',
                description: 'True/false toggle',
                defaultProps: {
                    type: 'boolean',
                    title: '',
                    description: '',
                    default: false
                }
            },
            {
                key: 'image',
                label: 'Image',
                icon: Image,
                jsonSchemaType: 'string',
                uiComponent: 'ImageUpload',
                description: 'Image upload and selection',
                defaultProps: {
                    type: 'string',
                    title: '',
                    description: '',
                    format: 'uri',
                    default: ''
                }
            },
            {
                key: 'file',
                label: 'File',
                icon: FileText,
                jsonSchemaType: 'string',
                uiComponent: 'FileUpload',
                description: 'File upload',
                defaultProps: {
                    type: 'string',
                    title: '',
                    description: '',
                    format: 'uri',
                    default: ''
                }
            },
            {
                key: 'url',
                label: 'URL',
                icon: Link,
                jsonSchemaType: 'string',
                uiComponent: 'URLInput',
                description: 'URL input with validation',
                defaultProps: {
                    type: 'string',
                    title: '',
                    description: '',
                    format: 'uri',
                    default: ''
                }
            },
            {
                key: 'email',
                label: 'Email',
                icon: Mail,
                jsonSchemaType: 'string',
                uiComponent: 'EmailInput',
                description: 'Email input with validation',
                defaultProps: {
                    type: 'string',
                    title: '',
                    description: '',
                    format: 'email',
                    default: ''
                }
            },
            {
                key: 'choice',
                label: 'Choice',
                icon: List,
                jsonSchemaType: 'string',
                uiComponent: 'SelectInput',
                description: 'Single choice from predefined options',
                defaultProps: {
                    type: 'string',
                    title: '',
                    description: '',
                    enum: [],
                    default: ''
                }
            },
            {
                key: 'multi_choice',
                label: 'Multiple Choice',
                icon: List,
                jsonSchemaType: 'array',
                uiComponent: 'MultiSelectInput',
                description: 'Multiple choices from predefined options',
                defaultProps: {
                    type: 'array',
                    title: '',
                    description: '',
                    items: { enum: [] },
                    default: []
                }
            },
            {
                key: 'user_reference',
                label: 'User Reference',
                icon: Users,
                jsonSchemaType: 'integer',
                uiComponent: 'UserSelector',
                description: 'Reference to a user',
                defaultProps: {
                    type: 'integer',
                    title: '',
                    description: '',
                    default: null
                }
            },
            {
                key: 'object_reference',
                label: 'Object Reference',
                icon: Database,
                jsonSchemaType: 'integer',
                uiComponent: 'ObjectSelector',
                description: 'Reference to another object',
                defaultProps: {
                    type: 'integer',
                    title: '',
                    description: '',
                    default: null
                }
            }
        ]

        coreTypes.forEach(type => this.registerFieldType(type))
    }

    registerFieldType({ key, label, icon, jsonSchemaType, uiComponent, description, defaultProps, ...extra }) {
        // Register a new field type
        this.fieldTypes.set(key, {
            key,
            label,
            icon,
            jsonSchemaType,
            uiComponent,
            description,
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

    getUIComponent(fieldType) {
        // Get UI component name for field type
        const field = this.getFieldType(fieldType)
        return field ? field.uiComponent : 'TextInput'
    }

    getDefaultProps(fieldType) {
        // Get default properties for creating new field of this type
        const field = this.getFieldType(fieldType)
        return field ? { ...field.defaultProps } : { type: 'string', fieldType: 'text' }
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
     *   uiComponent: 'ColorPicker',
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
export const getUIComponent = (fieldType) => fieldTypeRegistry.getUIComponent(fieldType)
export const getDefaultProps = (fieldType) => fieldTypeRegistry.getDefaultProps(fieldType)
export const registerCustomFieldType = (config) => fieldTypeRegistry.registerCustomFieldType(config)

// For backward compatibility with existing FIELD_TYPES usage
export const FIELD_TYPES = fieldTypeRegistry.getAllFieldTypes()

export default fieldTypeRegistry
