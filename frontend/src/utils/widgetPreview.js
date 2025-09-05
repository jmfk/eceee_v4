/**
 * Utility functions for widget preview using backend rendering
 */

import { api } from '../api/client'

/**
 * Render a single widget preview using backend rendering
 * @param {Object} widget - Widget configuration
 * @param {number} pageId - Page ID for context (optional, defaults to 1)
 * @returns {Promise<Object>} - Rendered HTML and CSS
 */
export const renderWidgetPreview = async (widget, pageId = 1) => {
    try {
        // Create a minimal widget data structure for the preview API
        const widgetData = [
            {
                widget_type: widget.type,
                slot_name: 'preview_slot',
                configuration: widget.config || {},
                id: widget.id || 'preview-widget'
            }
        ]

        const response = await api.post('/webpages/pages/preview/', {
            page_id: pageId,
            widgets: widgetData,
            include_css: true,
            include_debug: false
        })

        return {
            html: response.data.html,
            css: response.data.css,
            success: true
        }
    } catch (error) {
        console.error('Error rendering widget preview:', error)
        return {
            html: `<div class="widget-preview-error">
        <div class="text-red-600 p-4 border border-red-200 rounded bg-red-50">
          <strong>Preview Error:</strong> Could not render widget preview
          <br><small>${error.message || 'Unknown error'}</small>
        </div>
      </div>`,
            css: '',
            success: false,
            error: error.message
        }
    }
}

/**
 * Create a widget preview component that uses backend rendering
 * @param {Object} widget - Widget configuration
 * @param {Object} options - Preview options
 * @returns {Promise<HTMLElement>} - DOM element with rendered content
 */
export const createWidgetPreviewElement = async (widget, options = {}) => {
    const { pageId = 1, className = '' } = options

    // Create container element
    const container = document.createElement('div')
    container.className = `widget-preview ${className}`

    // Show loading state
    container.innerHTML = `
    <div class="widget-preview-loading p-4 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-sm text-gray-600">Rendering preview...</p>
    </div>
  `

    try {
        // Render the widget
        const result = await renderWidgetPreview(widget, pageId)

        // Update container with rendered content
        container.innerHTML = result.html

        // Add CSS if provided
        if (result.css) {
            const style = document.createElement('style')
            style.textContent = result.css
            container.appendChild(style)
        }

        // Add error class if rendering failed
        if (!result.success) {
            container.classList.add('widget-preview-error')
        }

    } catch (error) {
        container.innerHTML = `
      <div class="widget-preview-error">
        <div class="text-red-600 p-4 border border-red-200 rounded bg-red-50">
          <strong>Preview Error:</strong> Could not render widget preview
          <br><small>${error.message || 'Unknown error'}</small>
        </div>
      </div>
    `
        container.classList.add('widget-preview-error')
    }

    return container
}
