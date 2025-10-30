/**
 * Schema Field Type Fixer Utility
 * 
 * Detects and fixes schemas that use React component names instead of field type keys.
 * This issue can occur when schemas are created with component names like "ImageInput"
 * instead of field type keys like "image".
 */

/**
 * Map React component names to field type keys (reverse mapping)
 */
const COMPONENT_TO_KEY_MAP = {
    // Basic inputs
    'TextInput': 'text',
    'TextareaInput': 'textarea',
    'NumberInput': 'number',
    'BooleanInput': 'boolean',
    'PasswordInput': 'password',
    'EmailInput': 'email',
    'URLInput': 'url',

    // Date/Time
    'DateInput': 'date',
    'DateTimeInput': 'datetime',
    'TimeInput': 'time',
    'DateRangeInput': 'date_range',

    // Selection
    'SelectInput': 'choice',
    'MultiSelectInput': 'multi_choice',
    'RadioInput': 'radio',
    'CheckboxInput': 'checkbox',
    'TagInput': 'tag',

    // Advanced
    'ColorInput': 'color',
    'SliderInput': 'slider',
    'ComboboxInput': 'combobox',

    // Media
    'ImageInput': 'image',
    'FileInput': 'file',
    'DocumentInput': 'document',
    'VideoInput': 'video',
    'AudioInput': 'audio',

    // Rich Text
    'RichTextInput': 'rich_text',

    // References
    'UserSelectorInput': 'user_reference',
    'ObjectSelectorInput': 'object_reference',
    'ObjectTypeSelectorInput': 'object_type_selector',
    'ObjectReferenceInput': 'object_reference',
    'ReverseObjectReferenceDisplay': 'reverse_object_reference',

    // List/Complex
    'ItemsListField': 'items_list',
    'ConditionalGroupField': 'conditional_group',
}

/**
 * Detect if a schema has properties using component names instead of field type keys
 * 
 * @param {Object} schema - The schema to check
 * @returns {Object} { needsFix: boolean, affectedProperties: Array }
 */
export function detectSchemaIssue(schema) {
    if (!schema || !schema.properties) {
        return { needsFix: false, affectedProperties: [] }
    }

    const affectedProperties = []

    Object.entries(schema.properties).forEach(([key, property]) => {
        // Check if the component field contains a component name instead of a field type key
        const componentValue = property.component || property.componentType

        if (componentValue && COMPONENT_TO_KEY_MAP[componentValue]) {
            affectedProperties.push({
                key,
                currentValue: componentValue,
                shouldBe: COMPONENT_TO_KEY_MAP[componentValue]
            })
        }
    })

    return {
        needsFix: affectedProperties.length > 0,
        affectedProperties
    }
}

/**
 * Fix a schema by converting component names to field type keys
 * 
 * @param {Object} schema - The schema to fix
 * @returns {Object} The fixed schema
 */
export function fixSchema(schema) {
    if (!schema || !schema.properties) {
        return schema
    }

    // Deep clone the schema to avoid mutations
    const fixedSchema = JSON.parse(JSON.stringify(schema))

    let fixCount = 0

    Object.entries(fixedSchema.properties).forEach(([key, property]) => {
        const componentValue = property.component || property.componentType

        if (componentValue && COMPONENT_TO_KEY_MAP[componentValue]) {
            const correctKey = COMPONENT_TO_KEY_MAP[componentValue]

            // Remove the old 'component' field if it exists (to avoid backend validation errors)
            if (property.component) {
                delete property.component
            }

            // Set both componentType (for frontend) and field_type (for backend)
            property.componentType = correctKey
            property.field_type = correctKey

            fixCount++
        }
    })

    console.log(`[SchemaFixer] Fixed ${fixCount} properties in schema`)

    return fixedSchema
}

/**
 * Get a human-readable description of what will be fixed
 * 
 * @param {Array} affectedProperties - Array of affected properties from detectSchemaIssue
 * @returns {string} Description of fixes
 */
export function getFixDescription(affectedProperties) {
    if (!affectedProperties || affectedProperties.length === 0) {
        return 'No issues detected'
    }

    const examples = affectedProperties.slice(0, 3).map(prop =>
        `"${prop.key}": ${prop.currentValue} → ${prop.shouldBe}`
    ).join(', ')

    const remaining = affectedProperties.length > 3
        ? ` and ${affectedProperties.length - 3} more`
        : ''

    return `Will fix ${affectedProperties.length} propert${affectedProperties.length === 1 ? 'y' : 'ies'}: ${examples}${remaining}`
}

