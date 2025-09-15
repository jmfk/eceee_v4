import React from 'react'
import TextPropertyConfig from './TextPropertyConfig'

/**
 * Rich Text Property Configuration Component
 * 
 * Handles configuration for rich text editor fields.
 * Extends TextPropertyConfig with rich text specific options.
 */
export default function RichTextPropertyConfig(props) {
  // For now, use the TextPropertyConfig as base
  // TODO: Add rich text specific configuration options like toolbar settings
  return <TextPropertyConfig {...props} />
}