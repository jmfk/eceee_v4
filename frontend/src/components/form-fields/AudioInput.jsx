import React from 'react'
import ExpandableFileField from './ExpandableFileField'

/**
 * AudioInput Component
 * 
 * A specialized file field component for audio selection.
 * Pre-configured to only allow audio file types (MP3, WAV, etc.).
 */
const AudioInput = ({
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
            // Audio-specific settings
            allowedFileTypes={['audio']}
            fileTypeLabel="Audio"
            showValidation={true}
            {...props}
        />
    )
}

AudioInput.displayName = 'AudioInput'

export default AudioInput
