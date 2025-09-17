import React from 'react'
import ExpandableFileField from './ExpandableFileField'

/**
 * DocumentInput Component
 * 
 * A specialized file field component for document selection.
 * Pre-configured to only allow document file types (PDF, Word, Excel, etc.).
 */
const DocumentInput = ({
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
    namespace,
    ...props
}) => {
    return (
        <ExpandableFileField
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
            // Document-specific settings
            allowedFileTypes={['document']}
            fileTypeLabel="Document"
            showValidation={true}
            {...props}
        />
    )
}

DocumentInput.displayName = 'DocumentInput'

export default DocumentInput
