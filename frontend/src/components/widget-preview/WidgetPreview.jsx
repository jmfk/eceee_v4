import React, { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, RefreshCw, Maximize2, Minimize2, Smartphone, Tablet, Monitor } from 'lucide-react'
import { widgetsApi } from '../../api'
import DOMPurify from 'dompurify'

/**
 * WidgetPreview - Real-time widget preview component
 * 
 * Features:
 * - Live preview updates as configuration changes
 * - Responsive preview modes (desktop, tablet, mobile)
 * - Full-screen preview capability
 * - React/Django rendering parity
 * - CSS isolation for widget styles
 */
const WidgetPreview = ({ 
  widgetType, 
  configuration, 
  className = '',
  showControls = true,
  autoRefresh = true,
  refreshInterval = 500,
  onError = null
}) => {
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewCss, setPreviewCss] = useState('')
  const [cssVariables, setCssVariables] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isVisible, setIsVisible] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewportMode, setViewportMode] = useState('desktop') // desktop, tablet, mobile
  const [lastConfiguration, setLastConfiguration] = useState(null)
  
  const previewContainerRef = useRef(null)
  const refreshTimeoutRef = useRef(null)
  const iframeRef = useRef(null)

  // Viewport dimensions for responsive preview
  const viewportDimensions = {
    desktop: { width: '100%', height: '100%', label: 'Desktop' },
    tablet: { width: '768px', height: '1024px', label: 'Tablet (768×1024)' },
    mobile: { width: '375px', height: '667px', label: 'Mobile (375×667)' }
  }

  // Fetch preview from backend
  const fetchPreview = async () => {
    if (!widgetType || !configuration) {
      return
    }

    // Skip if configuration hasn't changed
    if (JSON.stringify(configuration) === JSON.stringify(lastConfiguration)) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await widgetsApi.renderPreview(widgetType, configuration)
      
      if (response.html) {
        // Sanitize HTML to prevent XSS
        const sanitizedHtml = DOMPurify.sanitize(response.html, {
          ADD_TAGS: ['style'],
          ADD_ATTR: ['class', 'style', 'id', 'data-*']
        })
        setPreviewHtml(sanitizedHtml)
      }
      
      if (response.css) {
        setPreviewCss(response.css)
      }
      
      if (response.css_variables) {
        setCssVariables(response.css_variables)
      }
      
      setLastConfiguration(configuration)
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load preview'
      setError(errorMessage)
      
      if (onError) {
        onError(err)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Debounced preview update
  useEffect(() => {
    if (!autoRefresh) {
      return
    }

    // Clear any pending refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }

    // Schedule new refresh
    refreshTimeoutRef.current = setTimeout(() => {
      fetchPreview()
    }, refreshInterval)

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [configuration, widgetType, autoRefresh, refreshInterval])

  // Initial load
  useEffect(() => {
    if (!autoRefresh) {
      fetchPreview()
    }
  }, [])

  // Generate CSS with scoped variables
  const generateScopedCss = () => {
    let css = previewCss || ''
    
    // Add CSS variables
    if (cssVariables && Object.keys(cssVariables).length > 0) {
      const variablesCSS = Object.entries(cssVariables)
        .map(([key, value]) => `--${key}: ${value};`)
        .join('\n  ')
      
      css = `.widget-preview-content {\n  ${variablesCSS}\n}\n\n${css}`
    }
    
    // Scope all CSS to preview container
    css = css.replace(/([^{]+){/g, (match, selector) => {
      // Don't scope keyframes
      if (selector.includes('@keyframes')) {
        return match
      }
      // Add scoping to each selector
      return `.widget-preview-content ${selector.trim()} {`
    })
    
    return css
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      previewContainerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Handle manual refresh
  const handleManualRefresh = () => {
    fetchPreview()
  }

  // Render iframe content for isolated preview
  const renderIframeContent = () => {
    const iframeDocument = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.5;
              color: #333;
              background: white;
              padding: 20px;
            }
            ${generateScopedCss()}
          </style>
        </head>
        <body>
          <div class="widget-preview-content">
            ${previewHtml}
          </div>
        </body>
      </html>
    `
    
    return iframeDocument
  }

  // Update iframe content
  useEffect(() => {
    if (iframeRef.current && previewHtml) {
      const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document
      iframeDoc.open()
      iframeDoc.write(renderIframeContent())
      iframeDoc.close()
    }
  }, [previewHtml, previewCss, cssVariables])

  if (!isVisible && showControls) {
    return (
      <div className={`widget-preview-collapsed ${className}`}>
        <button
          onClick={() => setIsVisible(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Eye className="w-4 h-4" />
          Show Preview
        </button>
      </div>
    )
  }

  return (
    <div 
      ref={previewContainerRef}
      className={`widget-preview ${isFullscreen ? 'widget-preview-fullscreen' : ''} ${className}`}
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
        background: isFullscreen ? 'white' : 'transparent'
      }}
    >
      {/* Controls */}
      {showControls && (
        <div className="widget-preview-controls flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Widget Preview</span>
            {isLoading && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                <span>Updating...</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Viewport mode selector */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
              <button
                onClick={() => setViewportMode('desktop')}
                className={`p-1.5 rounded transition-colors ${
                  viewportMode === 'desktop' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Desktop view"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewportMode('tablet')}
                className={`p-1.5 rounded transition-colors ${
                  viewportMode === 'tablet' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Tablet view"
              >
                <Tablet className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewportMode('mobile')}
                className={`p-1.5 rounded transition-colors ${
                  viewportMode === 'mobile' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Mobile view"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
            
            {/* Action buttons */}
            <button
              onClick={handleManualRefresh}
              className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
              title="Refresh preview"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            
            <button
              onClick={() => setIsVisible(false)}
              className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
              title="Hide preview"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* Viewport mode indicator */}
      {viewportMode !== 'desktop' && (
        <div className="px-3 py-1 bg-blue-50 border-b border-blue-200">
          <span className="text-xs text-blue-700">
            {viewportDimensions[viewportMode].label} Preview
          </span>
        </div>
      )}
      
      {/* Preview content */}
      <div className="widget-preview-viewport" style={{
        height: isFullscreen ? 'calc(100% - 60px)' : '500px',
        overflow: 'auto',
        background: '#f9fafb',
        display: 'flex',
        justifyContent: 'center',
        alignItems: viewportMode === 'desktop' ? 'stretch' : 'flex-start',
        padding: viewportMode === 'desktop' ? 0 : '20px'
      }}>
        {error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <div className="text-red-500 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Preview Error</h3>
              <p className="text-sm text-gray-600">{error}</p>
              <button
                onClick={handleManualRefresh}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        ) : previewHtml ? (
          <div 
            className="widget-preview-frame bg-white shadow-lg"
            style={{
              width: viewportDimensions[viewportMode].width,
              height: viewportMode === 'desktop' ? '100%' : viewportDimensions[viewportMode].height,
              maxWidth: '100%',
              borderRadius: viewportMode === 'desktop' ? 0 : '8px',
              overflow: 'hidden'
            }}
          >
            <iframe
              ref={iframeRef}
              title="Widget Preview"
              className="w-full h-full border-0"
              sandbox="allow-same-origin"
              style={{ display: 'block' }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Preview Available</h3>
              <p className="text-sm text-gray-600">
                {isLoading ? 'Loading preview...' : 'Configure the widget to see a preview'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default WidgetPreview