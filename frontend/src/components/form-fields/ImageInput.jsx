import React from 'react'
import MediaField from './MediaField'

/**
 * ImageInput Component
 * 
 * A specialized media field component specifically for image selection.
 * Built on top of MediaField with image-specific defaults.
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
            // Image-specific settings
            mediaTypes={['image']}  // Only allow images
            showValidation={true}
            {...props}
        />
    )
}

ImageInput.displayName = 'ImageInput'

export default ImageInput
