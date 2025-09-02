import React from 'react'
import DOMPurify from 'dompurify'

/**
 * HTMLBlockRenderer - React renderer for HTML Block widgets
 * Maintains parity with Django template rendering
 */
const HTMLBlockRenderer = ({ configuration }) => {
  const { html_content = '', css_class = '', enable_scripts = false } = configuration

  // Sanitize HTML content
  const sanitizeOptions = {
    ADD_TAGS: enable_scripts ? ['script', 'style'] : ['style'],
    ADD_ATTR: ['class', 'id', 'style', 'data-*'],
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true
  }

  const sanitizedHtml = DOMPurify.sanitize(html_content, sanitizeOptions)

  const containerClasses = [
    'html-block-widget',
    css_class
  ].filter(Boolean).join(' ')

  if (!html_content) {
    return (
      <div className={containerClasses}>
        <div className="text-gray-400 italic p-4 border-2 border-dashed border-gray-300 rounded">
          Empty HTML block
        </div>
      </div>
    )
  }

  return (
    <div 
      className={containerClasses}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  )
}

export default HTMLBlockRenderer