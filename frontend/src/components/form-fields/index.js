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

// Special Interactive Components
export { default as CommandPaletteInput } from './CommandPaletteInput'
export { default as ComboboxInput } from './ComboboxInput'
export { default as MentionsInput } from './MentionsInput'
export { default as CascaderInput } from './CascaderInput'
export { default as TransferInput } from './TransferInput'

// Advanced UI Pattern Components
export { default as RuleBuilderInput } from './RuleBuilderInput'
export { default as ReorderableInput } from './ReorderableInput'
export { default as RatingInput } from './RatingInput'
export { default as SegmentedControlInput } from './SegmentedControlInput'
export { default as NumericStepperInput } from './NumericStepperInput'

// Media Components
export { default as ImageInput } from './ImageInput'
export { default as FileInput } from './FileInput'
export { default as DocumentInput } from './DocumentInput'
export { default as VideoInput } from './VideoInput'
export { default as AudioInput } from './AudioInput'

// Rich Text Components
export { default as RichTextInput } from './RichTextInput'

// Reference Components
export { default as UserSelectorInput } from './UserSelectorInput'
export { default as ObjectSelectorInput } from './ObjectSelectorInput'
export { default as ObjectTypeSelectorInput } from './ObjectTypeSelectorInput'

// List Components
export { default as ItemsListField } from './ItemsListField'

// Conditional Form Components
export { default as ConditionalGroupField } from './ConditionalGroupField'

// Display Components (read-only)
export { default as PageChildrenDisplayField } from './PageChildrenDisplayField'
export { default as PageSectionsDisplayField } from './PageSectionsDisplayField'

// TODO: Add more components as they are implemented
// export { default as AddressInput } from './AddressInput'

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
    CommandPaletteInput: () => import('./CommandPaletteInput'),
    ComboboxInput: () => import('./ComboboxInput'),
    MentionsInput: () => import('./MentionsInput'),
    CascaderInput: () => import('./CascaderInput'),
    TransferInput: () => import('./TransferInput'),
    RuleBuilderInput: () => import('./RuleBuilderInput'),
    ReorderableInput: () => import('./ReorderableInput'),
    RatingInput: () => import('./RatingInput'),
    SegmentedControlInput: () => import('./SegmentedControlInput'),
    NumericStepperInput: () => import('./NumericStepperInput'),
    // Media Components
    ImageInput: () => import('./ImageInput'),
    FileInput: () => import('./FileInput'),
    DocumentInput: () => import('./DocumentInput'),
    VideoInput: () => import('./VideoInput'),
    AudioInput: () => import('./AudioInput'),
    // Rich Text Components
    RichTextInput: () => import('./RichTextInput'),
    // Reference Components
    UserSelectorInput: () => import('./UserSelectorInput'),
    ObjectSelectorInput: () => import('./ObjectSelectorInput'),
    ObjectTypeSelectorInput: () => import('./ObjectTypeSelectorInput'),
    // HTML Source Editor
    HtmlSource: () => import('../fields/HtmlSourceField'),
    // List Components
    ItemsListField: () => import('./ItemsListField'),
    // Conditional Form Components
    ConditionalGroupField: () => import('./ConditionalGroupField'),
    // Display Components
    PageChildrenDisplayField: () => import('./PageChildrenDisplayField'),
    PageSectionsDisplayField: () => import('./PageSectionsDisplayField'),
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
