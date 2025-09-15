import React from 'react'
import DatePropertyConfig from './DatePropertyConfig'

/**
 * DateTime Property Configuration Component
 * 
 * Handles configuration for datetime input fields.
 * Extends DatePropertyConfig with datetime-specific options.
 */
export default function DateTimePropertyConfig(props) {
    // For now, use the DatePropertyConfig as base
    // TODO: Add datetime-specific configuration options
    return <DatePropertyConfig {...props} />
}
