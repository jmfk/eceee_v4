import React from 'react'

/**
 * SpacerRenderer - React renderer for Spacer widgets
 * Maintains parity with Django template rendering
 */
const SpacerRenderer = ({ configuration }) => {
  const { height = 20, css_class = '' } = configuration

  const spacerStyle = {
    height: isNaN(height) ? height : `${height}px`,
    display: 'block'
  }

  const spacerClasses = [
    'spacer-widget',
    css_class
  ].filter(Boolean).join(' ')

  return (
    <div 
      className={spacerClasses}
      style={spacerStyle}
      aria-hidden="true"
    />
  )
}

export default SpacerRenderer