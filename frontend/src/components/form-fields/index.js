/**
 * Form Field Components Export Index
 * 
 * Centralized exports for all form field components.
 * These components are used by the dynamic form renderer based on field type definitions.
 */

// Basic Input Components
export { default as TextInput } from './TextInput'
export { default as TextareaInput } from './TextareaInput'
export { default as NumberInput } from './NumberInput'
export { default as BooleanInput } from './BooleanInput'
export { default as PasswordInput } from './PasswordInput'
export { default as EmailInput } from './EmailInput'
export { default as URLInput } from './URLInput'

// Date/Time Components
export { default as DateInput } from './DateInput'
export { default as DateTimeInput } from './DateTimeInput'
export { default as TimeInput } from './TimeInput'

// Selection Components
export { default as SelectInput } from './SelectInput'
export { default as MultiSelectInput } from './MultiSelectInput'
export { default as RadioInput } from './RadioInput'
export { default as CheckboxInput } from './CheckboxInput'
export { default as TagInput } from './TagInput'

// Advanced Components
export { default as ColorInput } from './ColorInput'
export { default as SliderInput } from './SliderInput'
export { default as DateRangeInput } from './DateRangeInput'

// TODO: Add more components as they are implemented
// export { default as RichTextInput } from './RichTextInput'
// export { default as AddressInput } from './AddressInput'
// export { default as ImageInput } from './ImageInput'
// export { default as FileInput } from './FileInput'

// Component registry for dynamic loading
export const FIELD_COMPONENTS = {
    TextInput: () => import('./TextInput'),
    TextareaInput: () => import('./TextareaInput'),
    NumberInput: () => import('./NumberInput'),
    BooleanInput: () => import('./BooleanInput'),
    PasswordInput: () => import('./PasswordInput'),
    EmailInput: () => import('./EmailInput'),
    URLInput: () => import('./URLInput'),
    DateInput: () => import('./DateInput'),
    DateTimeInput: () => import('./DateTimeInput'),
    TimeInput: () => import('./TimeInput'),
    SelectInput: () => import('./SelectInput'),
    MultiSelectInput: () => import('./MultiSelectInput'),
    RadioInput: () => import('./RadioInput'),
    CheckboxInput: () => import('./CheckboxInput'),
    TagInput: () => import('./TagInput'),
    ColorInput: () => import('./ColorInput'),
    SliderInput: () => import('./SliderInput'),
    DateRangeInput: () => import('./DateRangeInput'),
    // TODO: Add more components
}

/**
 * Get a field component by name
 * @param {string} componentName - Name of the component
 * @returns {Promise<React.Component>} The component
 */
export const getFieldComponent = async (componentName) => {
    if (FIELD_COMPONENTS[componentName]) {
        const module = await FIELD_COMPONENTS[componentName]()
        return module.default
    }

    // Fallback to TextInput if component not found
    console.warn(`Field component '${componentName}' not found, falling back to TextInput`)
    const module = await FIELD_COMPONENTS.TextInput()
    return module.default
}
