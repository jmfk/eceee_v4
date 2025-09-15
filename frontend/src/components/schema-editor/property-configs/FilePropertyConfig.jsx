import React from 'react'
import ImagePropertyConfig from './ImagePropertyConfig'

/**
 * File Property Configuration Component
 * 
 * Handles configuration for file input fields.
 * Extends ImagePropertyConfig with file-specific options.
 */
export default function FilePropertyConfig(props) {
    // For now, use the ImagePropertyConfig as base since they're similar
    // TODO: Add file-specific configuration options
    return <ImagePropertyConfig {...props} />
}
