import React, { useState, useEffect, useRef, Suspense, lazy } from 'react'
import { AlertCircle } from 'lucide-react'
import { getWidgetEditor } from '../widget-editors'

// Lazy load widget renderers
const widgetRenderers = {
  'text-block': lazy(() => import('./renderers/TextBlockRenderer')),
  'image': lazy(() => import('./renderers/ImageRenderer')),
  'button': lazy(() => import('./renderers/ButtonRenderer')),
  'spacer': lazy(() => import('./renderers/SpacerRenderer')),
  'html-block': lazy(() => import('./renderers/HTMLBlockRenderer')),
  'gallery': lazy(() => import('./renderers/GalleryRenderer')),
  'news': lazy(() => import('./renderers/NewsRenderer')),
  'events': lazy(() => import('./renderers/EventsRenderer')),
  'calendar': lazy(() => import('./renderers/CalendarRenderer')),
  'forms': lazy(() => import('./renderers/FormsRenderer')),
}

/**
 * WidgetReactPreview - Pure React widget preview
 * 
 * Features:
 * - Client-side React rendering
 * - No server round-trip
 * - Instant updates
 * - Performance metrics
 */
const WidgetReactPreview = ({
  widgetType,
  configuration,
  className = '',
  showControls = true,
  onMetrics = null
}) => {
  const [renderTime, setRenderTime] = useState(0)
  const [error, setError] = useState(null)
  const [domNodes, setDomNodes] = useState(0)
  
  const containerRef = useRef(null)
  const renderStartRef = useRef(null)

  // Get the appropriate renderer for the widget type
  const getRenderer = () => {
    const typeSlug = widgetType?.toLowerCase().replace(/\s+/g, '-')
    return widgetRenderers[typeSlug]
  }

  // Measure render performance
  useEffect(() => {
    renderStartRef.current = performance.now()
  }, [configuration])

  // Calculate metrics after render
  useEffect(() => {
    if (containerRef.current && renderStartRef.current) {
      const renderEnd = performance.now()
      const time = renderEnd - renderStartRef.current
      setRenderTime(time)
      
      // Count DOM nodes
      const nodes = containerRef.current.getElementsByTagName('*').length
      setDomNodes(nodes)
      
      // Report metrics
      if (onMetrics) {
        onMetrics({
          renderTime: time,
          domNodes: nodes,
          componentCount: 1,
          memoryUsage: performance.memory?.usedJSHeapSize || 0
        })
      }
    }
  })

  // Error boundary component
  const ErrorFallback = ({ error }) => (
    <div className="p-6 bg-red-50 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-900 mb-1">
            React Rendering Error
          </h3>
          <p className="text-xs text-red-700">{error.message || 'Unknown error'}</p>
          {error.stack && (
            <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto">
              {error.stack}
            </pre>
          )}
        </div>
      </div>
    </div>
  )

  // Loading fallback
  const LoadingFallback = () => (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-sm text-gray-600">Loading widget renderer...</p>
      </div>
    </div>
  )

  // Render the widget
  const renderWidget = () => {
    if (!widgetType || !configuration) {
      return (
        <div className="text-center p-8 text-gray-500">
          <p className="text-sm">No widget configuration provided</p>
        </div>
      )
    }

    const Renderer = getRenderer()
    
    if (!Renderer) {
      // Fallback to generic renderer
      return <GenericWidgetRenderer type={widgetType} config={configuration} />
    }

    return (
      <Suspense fallback={<LoadingFallback />}>
        <Renderer configuration={configuration} />
      </Suspense>
    )
  }

  return (
    <div className={`widget-react-preview ${className}`} ref={containerRef}>
      {showControls && (
        <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
          <span className="text-xs font-medium text-blue-900">React Preview</span>
          <span className="text-xs text-blue-700">
            {renderTime.toFixed(2)}ms
          </span>
        </div>
      )}
      
      <div className="widget-react-preview-content p-4">
        {error ? (
          <ErrorFallback error={error} />
        ) : (
          <ErrorBoundary onError={setError}>
            {renderWidget()}
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}

// Error boundary wrapper
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    if (this.props.onError) {
      this.props.onError(error)
    }
  }

  render() {
    return this.props.children
  }
}

// Generic widget renderer for unknown types
const GenericWidgetRenderer = ({ type, config }) => {
  return (
    <div className="generic-widget-renderer p-4 bg-gray-50 rounded-lg">
      <h3 className="text-sm font-medium text-gray-900 mb-2">
        {type} Widget
      </h3>
      <div className="text-xs text-gray-600">
        <p className="mb-2">Configuration:</p>
        <pre className="bg-white p-2 rounded border border-gray-200 overflow-auto">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>
    </div>
  )
}

export default WidgetReactPreview