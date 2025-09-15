import React from 'react'
import MediaField from './MediaField'

/**
 * FileInput Component
 * 
 * A specialized media field component for file selection.
 * Built on top of MediaField with file-specific defaults.
 */
const FileInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    multiple = false,
    maxItems = null,
    minItems = null,
    accept = '*/*',
    namespace,
    ...props
}) => {
    return (
        <MediaField
            value={value}
            onChange={onChange}
            validation={validation}
            isValidating={isValidating}
            label={label}
            description={description}
            required={required}
            disabled={disabled}
            multiple={multiple}
            maxItems={maxItems}
            minItems={minItems}
            namespace={namespace}
            // File-specific settings
            mediaTypes={['document', 'image', 'video', 'audio']}  // Allow all file types
            showValidation={true}
            {...props}
        />
    )
}

FileInput.displayName = 'FileInput'

export default FileInput
