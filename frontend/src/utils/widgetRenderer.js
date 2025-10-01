/**
 * Utility functions for rendering widgets to DOM elements
 * Used by ContentEditor's LayoutRenderer for DOM-based widget rendering
 */

import { getCoreWidgetComponent as getWidgetComponent } from '../widgets'

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
    case 'default_widgets.ContentWidget':
      const content = config.content || '<div class="text-gray-500 italic">Content will appear here...</div>'
      return `
        <div class="content-widget theme-content widget-content">
          ${content}
        </div>
      `

    case 'default_widgets.ImageWidget':
      // Note: This HTML fallback renderer only shows the first image in a simplified format
      // Full gallery/carousel functionality requires the React component
      const imgSrc = config.image_url || config.imageUrl || (config.mediaItems && config.mediaItems[0] ? config.mediaItems[0].url : '')
      const altText = config.alt_text || config.altText || (config.mediaItems && config.mediaItems[0] ? config.mediaItems[0].altText : 'Image')
      const caption = config.caption || (config.mediaItems && config.mediaItems[0] ? config.mediaItems[0].caption : '')
      return `
        <div class="image-widget text-center theme-content widget-content">
          ${imgSrc ?
          `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(altText)}" class="max-w-full h-auto rounded" />` :
          '<div class="bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">Image placeholder</div>'
        }
          ${caption ? `<p class="text-sm text-gray-600 mt-2">${escapeHtml(caption)}</p>` : ''}
        </div>
      `

    case 'default_widgets.TableWidget':
      return `
        <div class="table-widget theme-content widget-content">
          <div class="bg-gray-50 border border-gray-200 rounded p-4 text-center">
            <div class="text-gray-600">Table widget will appear here...</div>
          </div>
        </div>
      `

    case 'default_widgets.FooterWidget':
      return `
        <footer class="footer-widget bg-gray-800 text-white p-4 text-center rounded theme-content widget-content">
          <div class="text-sm">Footer content will appear here...</div>
        </footer>
      `

    case 'default_widgets.HeaderWidget':
      return `
        <header class="header-widget bg-white p-6 text-center border border-gray-200 rounded theme-content widget-content">
          <div class="text-lg font-semibold">Header content will appear here...</div>
        </header>
      `

    case 'default_widgets.NavigationWidget':
      return `
        <nav class="navigation-widget bg-white border border-gray-200 rounded p-4 theme-content widget-content">
          <div class="text-center text-gray-600">Navigation content will appear here...</div>
        </nav>
      `

    case 'default_widgets.SidebarWidget':
      return `
        <aside class="sidebar-widget bg-gray-50 border border-gray-200 rounded p-4 theme-content widget-content">
          <div class="text-gray-600">Sidebar content will appear here...</div>
        </aside>
      `

    case 'default_widgets.FormsWidget':
      return `
        <div class="forms-widget bg-white border border-gray-200 rounded p-6 theme-content widget-content">
          <h3 class="text-lg font-semibold mb-4 text-center">Contact Form</h3>
          <div class="text-center text-gray-600">Form will appear here...</div>
        </div>
      `

    default:
      // Generic widget renderer for unknown types
      const widgetTypeName = widget.name || widget.type || 'Unknown Widget'
      return `
        <div class="generic-widget text-center p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded theme-content widget-content">
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
