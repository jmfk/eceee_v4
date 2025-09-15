import React from 'react'
import TextPropertyConfig from './TextPropertyConfig'

/**
 * Color Property Configuration Component
 * 
 * Handles configuration for color input fields.
 * Extends TextPropertyConfig with color-specific options.
 */
export default function ColorPropertyConfig(props) {
    // For now, use the TextPropertyConfig as base
    // TODO: Add color-specific configuration options like color presets, format (hex, rgb, hsl)
    return <TextPropertyConfig {...props} />
}
