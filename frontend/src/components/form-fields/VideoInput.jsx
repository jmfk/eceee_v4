import React from 'react'
import ExpandableFileField from './ExpandableFileField'

/**
 * VideoInput Component
 * 
 * A specialized file field component for video selection.
 * Pre-configured to only allow video file types (MP4, WebM, etc.).
 */
const VideoInput = ({
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
            // Video-specific settings
            allowedFileTypes={['video']}
            fileTypeLabel="Video"
            showValidation={true}
            {...props}
        />
    )
}

VideoInput.displayName = 'VideoInput'

export default VideoInput
