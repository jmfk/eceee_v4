import React from 'react'
import NumberPropertyConfig from './NumberPropertyConfig'

/**
 * Slider Property Configuration Component
 * 
 * Handles configuration for slider input fields.
 * Extends NumberPropertyConfig with slider-specific options.
 */
export default function SliderPropertyConfig(props) {
    // For now, use the NumberPropertyConfig as base
    // TODO: Add slider-specific configuration options like marks, tooltip format
    return <NumberPropertyConfig {...props} />
}
