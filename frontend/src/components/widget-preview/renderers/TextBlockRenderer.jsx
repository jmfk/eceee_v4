import React from 'react'
import DOMPurify from 'dompurify'

/**
 * TextBlockRenderer - React renderer for Text Block widgets
 * Maintains parity with Django template rendering
 */
const TextBlockRenderer = ({ configuration }) => {
  const { title, content, alignment = 'left', style = 'normal', css_class = '' } = configuration

  // Sanitize HTML content
  const sanitizedContent = DOMPurify.sanitize(content || '', {
    ADD_TAGS: ['p', 'br', 'strong', 'em', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a'],
    ADD_ATTR: ['href', 'target', 'rel', 'class']
  })

  // Build alignment classes
  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify'
  }

  // Build style classes
  const styleClasses = {
    normal: '',
    bold: 'font-bold',
    italic: 'italic'
  }

  const widgetClasses = [
    'text-block-widget',
    alignmentClasses[alignment] || 'text-left',
    styleClasses[style] || '',
    css_class
  ].filter(Boolean).join(' ')

  return (
    <div className={widgetClasses}>
      {title && (
        <h3 className="text-block-title text-lg font-semibold mb-3">
          {title}
        </h3>
      )}
      
      {content && (
        <div 
          className="text-block-content prose max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      )}
      
      {!title && !content && (
        <div className="text-gray-400 italic">
          Empty text block
        </div>
      )}
    </div>
  )
}

export default TextBlockRenderer