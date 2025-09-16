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
            showValidation={true}
            {...props}
        />
    )
}

ImageInput.displayName = 'ImageInput'

export default ImageInput
