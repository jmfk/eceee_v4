/**
 * Utility functions for rendering widgets to DOM elements
 * Used by ContentEditor's LayoutRenderer for DOM-based widget rendering
 */

import { getWidgetComponent } from '../components/widgets/widgetRegistry'

/**
 * Create a DOM element for a widget using the shared widget logic
 * @param {Object} widget - Widget configuration object
 * @returns {HTMLElement} DOM element containing the widget
 */
export const createWidgetElement = (widget) => {
  try {
    // Validate widget object
    if (!widget || typeof widget !== 'object' || !widget.type) {
      throw new Error('Invalid widget object')
    }

    const element = document.createElement('div')
    element.className = 'widget-item bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm'

    // Add widget data attributes (sanitized)
    const widgetType = String(widget.type).replace(/[^a-zA-Z0-9-_]/g, '')
    element.setAttribute('data-widget-type', widgetType)

    if (widget.id) {
      const widgetId = String(widget.id).replace(/[^a-zA-Z0-9-_]/g, '')
      element.setAttribute('data-widget-id', widgetId)
    }

    // Get widget content HTML
    const widgetHTML = renderWidgetToHTML(widget)
    element.innerHTML = widgetHTML

    return element
  } catch (error) {
    console.error('widgetRenderer: Error creating widget element', error)

    // Return a safe fallback element
    const fallback = document.createElement('div')
    fallback.className = 'widget-item bg-red-50 border border-red-200 rounded-lg p-4 mb-3'
    fallback.innerHTML = `
      <div class="text-red-600 text-sm">
        <strong>Widget Error:</strong> Unable to render widget
      </div>
    `
    return fallback
  }
}

/**
 * Render a widget to HTML string using the same logic as React components
 * @param {Object} widget - Widget configuration object
 * @returns {string} HTML string for the widget
 */
export const renderWidgetToHTML = (widget) => {
  const config = widget.config || {}

  // XSS protection utility
  const escapeHtml = (text) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  switch (widget.type) {
    case 'core_widgets.TextBlockWidget':
    case 'text':
    case 'text-block':
      return `
        <div class="text-widget">
          ${config.title ? `<h3 class="font-semibold text-gray-900 mb-2">${escapeHtml(config.title)}</h3>` : ''}
          <div class="text-gray-700">${config.content || 'Text content will appear here...'}</div>
        </div>
      `

    case 'core_widgets.ImageWidget':
    case 'image':
      const imgSrc = config.image_url || config.imageUrl || ''
      const altText = config.alt_text || config.altText || 'Image'
      const caption = config.caption || ''
      return `
        <div class="image-widget text-center">
          ${imgSrc ?
          `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(altText)}" class="max-w-full h-auto rounded" />` :
          '<div class="bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">Image placeholder</div>'
        }
          ${caption ? `<p class="text-sm text-gray-600 mt-2">${escapeHtml(caption)}</p>` : ''}
        </div>
      `

    case 'core_widgets.ButtonWidget':
    case 'button':
      const buttonText = config.text || 'Button'
      const buttonUrl = config.url || '#'
      const buttonStyle = config.style || 'primary'
      const buttonClasses = buttonStyle === 'secondary'
        ? 'inline-block bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 transition-colors'
        : buttonStyle === 'outline'
          ? 'inline-block border-2 border-blue-600 text-blue-600 px-6 py-2 rounded hover:bg-blue-600 hover:text-white transition-colors'
          : 'inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors'

      return `
        <div class="button-widget text-center">
          <a href="${escapeHtml(buttonUrl)}" class="${buttonClasses}">
            ${escapeHtml(buttonText)}
          </a>
        </div>
      `

    case 'core_widgets.SpacerWidget':
    case 'spacer':
      const height = config.height === 'custom' ? config.custom_height :
        config.height === 'small' ? '16px' :
          config.height === 'large' ? '64px' : '32px'
      return `
        <div class="spacer-widget" style="height: ${height};">
          <div class="h-full border-l-2 border-r-2 border-dashed border-gray-300 bg-gray-100 opacity-50 flex items-center justify-center">
            <span class="text-xs text-gray-500">Spacer (${height})</span>
          </div>
        </div>
      `

    case 'core_widgets.HtmlBlockWidget':
    case 'html-block':
      const htmlContent = config.html_content || '<div class="text-gray-500 italic">HTML content will appear here...</div>'
      return `
        <div class="html-widget">
          ${htmlContent}
        </div>
      `

    case 'core_widgets.GalleryWidget':
    case 'gallery':
      const images = config.images || []
      const columns = config.columns || 3
      const gridClasses = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-2 md:grid-cols-3',
        4: 'grid-cols-2 md:grid-cols-4',
        5: 'grid-cols-2 md:grid-cols-5',
        6: 'grid-cols-2 md:grid-cols-6'
      }

      return `
        <div class="gallery-widget">
          ${config.title ? `<h3 class="font-semibold text-gray-900 mb-3">${escapeHtml(config.title)}</h3>` : ''}
          <div class="grid ${gridClasses[columns] || gridClasses[3]} gap-2">
            ${images.length > 0 ?
          images.map((image, index) => `
                <img
                  src="${escapeHtml(image.url || image.src || '')}"
                  alt="${escapeHtml(image.alt || `Gallery image ${index + 1}`)}"
                  class="w-full h-24 object-cover rounded"
                />
              `).join('') :
          '<div class="col-span-full bg-gray-200 h-24 rounded flex items-center justify-center text-gray-500">Gallery placeholder</div>'
        }
          </div>
        </div>
      `

    default:
      // Generic widget renderer for unknown types
      const widgetTypeName = widget.name || widget.type || 'Unknown Widget'
      return `
        <div class="generic-widget text-center p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded">
          <div class="text-sm font-medium text-gray-700">${escapeHtml(widgetTypeName)}</div>
          <div class="text-xs text-gray-500 mt-1">
            ${config.title || config.content || 'Widget content will appear here 2'}
          </div>
        </div>
      `
  }
}

export default {
  createWidgetElement,
  renderWidgetToHTML
}
