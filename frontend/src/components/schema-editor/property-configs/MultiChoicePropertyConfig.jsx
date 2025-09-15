import React from 'react'
import ChoicePropertyConfig from './ChoicePropertyConfig'

/**
 * Multi Choice Property Configuration Component
 * 
 * Handles configuration for multi-select input fields.
 * Extends ChoicePropertyConfig with multi-select specific options.
 */
export default function MultiChoicePropertyConfig(props) {
    // For now, use the ChoicePropertyConfig as base
    // TODO: Add multi-select specific configuration options like max selections
    return <ChoicePropertyConfig {...props} />
}
