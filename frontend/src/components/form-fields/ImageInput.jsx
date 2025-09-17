import React from 'react'
import ExpandableImageField from './ExpandableImageField'

/**
 * ImageInput Component
 * 
 * A specialized image field component with expandable inline media picker.
 * Features expandable interface with search and 9x9 thumbnail grid.
 */
const ImageInput = ({
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
    constraints = {},
    autoTags = '', // Comma-separated string of auto-tags for uploads
    defaultCollection = null, // Default collection object for uploads
    maxFiles = null, // Maximum number of images allowed in field
    ...props
}) => {
    return (
        <ExpandableImageField
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
            constraints={constraints}
            autoTags={autoTags}
            defaultCollection={defaultCollection}
            maxFiles={maxFiles}
            showValidation={true}
            {...props}
        />
    )
}

ImageInput.displayName = 'ImageInput'

export default ImageInput
