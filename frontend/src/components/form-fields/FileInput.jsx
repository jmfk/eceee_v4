import React from 'react'
import ExpandableFileField from './ExpandableFileField'

/**
 * FileInput Component
 * 
 * A specialized file field component for file selection with expandable interface.
 * Built on top of ExpandableFileField with configurable file type support.
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
    // File type configuration
    allowedFileTypes = ['document', 'image', 'video', 'audio'], // Categories
    allowedMimeTypes = [], // Specific MIME types (optional)
    allowedExtensions = '', // Comma-separated file extensions
    fileTypeLabel = 'File', // Label for UI text
    // File size constraints
    maxFileSize = null, // Max file size in MB
    minFileSize = null, // Min file size in KB
    autoTags = '', // Comma-separated string of auto-tags for uploads
    defaultCollection = null, // Default collection object for uploads
    maxFiles = null, // Maximum number of files allowed in field
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
            // File type configuration
            allowedFileTypes={allowedFileTypes}
            allowedMimeTypes={allowedMimeTypes}
            allowedExtensions={allowedExtensions}
            fileTypeLabel={fileTypeLabel}
            // File size constraints
            maxFileSize={maxFileSize}
            minFileSize={minFileSize}
            autoTags={autoTags}
            defaultCollection={defaultCollection}
            maxFiles={maxFiles}
            showValidation={true}
            {...props}
        />
    )
}

FileInput.displayName = 'FileInput'

export default FileInput
