import React from 'react'
import TextPropertyConfig from './TextPropertyConfig'

/**
 * URL Property Configuration Component
 * 
 * Handles configuration for URL input fields.
 * Extends TextPropertyConfig with URL-specific options.
 */
export default function URLPropertyConfig(props) {
  // For now, use the TextPropertyConfig as base
  // TODO: Add URL-specific configuration options like protocol validation
  return <TextPropertyConfig {...props} />
}