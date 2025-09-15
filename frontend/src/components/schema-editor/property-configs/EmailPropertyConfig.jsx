import React from 'react'
import TextPropertyConfig from './TextPropertyConfig'

/**
 * Email Property Configuration Component
 * 
 * Handles configuration for email input fields.
 * Extends TextPropertyConfig with email-specific options.
 */
export default function EmailPropertyConfig(props) {
  // For now, use the TextPropertyConfig as base
  // TODO: Add email-specific configuration options like domain validation
  return <TextPropertyConfig {...props} />
}