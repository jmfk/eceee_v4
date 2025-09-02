import React from 'react'

/**
 * ImageRenderer - React renderer for Image widgets
 * Maintains parity with Django template rendering
 */
const ImageRenderer = ({ configuration }) => {
  const { 
    image_url, 
    alt_text = '', 
    caption = '', 
    width = '', 
    height = '', 
    alignment = 'center',
    css_class = '',
    link_url = '',
    link_target = '_self'
  } = configuration

  // Build alignment classes
  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center mx-auto',
    right: 'text-right ml-auto'
  }

  const containerClasses = [
    'image-widget',
    alignmentClasses[alignment] || 'text-center',
    css_class
  ].filter(Boolean).join(' ')

  // Build image style
  const imageStyle = {}
  if (width) imageStyle.width = isNaN(width) ? width : `${width}px`
  if (height) imageStyle.height = isNaN(height) ? height : `${height}px`

  const imageElement = (
    <img
      src={image_url || '/api/placeholder/400/300'}
      alt={alt_text}
      className="image-widget-img rounded-lg shadow-sm"
      style={imageStyle}
      onError={(e) => {
        e.target.src = '/api/placeholder/400/300'
        e.target.alt = 'Image not found'
      }}
    />
  )

  return (
    <div className={containerClasses}>
      <figure className="image-widget-figure inline-block">
        {link_url ? (
          <a 
            href={link_url} 
            target={link_target}
            rel={link_target === '_blank' ? 'noopener noreferrer' : undefined}
            className="image-widget-link block hover:opacity-90 transition-opacity"
          >
            {imageElement}
          </a>
        ) : (
          imageElement
        )}
        
        {caption && (
          <figcaption className="image-widget-caption mt-2 text-sm text-gray-600 italic">
            {caption}
          </figcaption>
        )}
      </figure>
    </div>
  )
}

export default ImageRenderer