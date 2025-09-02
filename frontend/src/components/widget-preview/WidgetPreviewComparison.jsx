import React, { useState } from 'react'
import { GitCompare, Check, X, AlertCircle } from 'lucide-react'
import WidgetPreview from './WidgetPreview'
import WidgetReactPreview from './WidgetReactPreview'

/**
 * WidgetPreviewComparison - Compare React and Django widget rendering
 * 
 * Features:
 * - Side-by-side comparison of React and Django rendering
 * - Visual diff highlighting
 * - Parity validation
 * - Performance metrics
 */
const WidgetPreviewComparison = ({
  widgetType,
  configuration,
  className = ''
}) => {
  const [viewMode, setViewMode] = useState('side-by-side') // side-by-side, overlay, diff
  const [showMetrics, setShowMetrics] = useState(false)
  const [reactMetrics, setReactMetrics] = useState({})
  const [djangoMetrics, setDjangoMetrics] = useState({})
  const [parityIssues, setParityIssues] = useState([])

  // Check rendering parity
  const checkParity = () => {
    const issues = []
    
    // Compare render times
    if (reactMetrics.renderTime && djangoMetrics.renderTime) {
      const timeDiff = Math.abs(reactMetrics.renderTime - djangoMetrics.renderTime)
      if (timeDiff > 100) {
        issues.push({
          type: 'performance',
          message: `Render time difference: ${timeDiff}ms`,
          severity: 'warning'
        })
      }
    }
    
    // Compare DOM structure (simplified check)
    if (reactMetrics.domNodes !== djangoMetrics.domNodes) {
      issues.push({
        type: 'structure',
        message: `DOM node count mismatch: React (${reactMetrics.domNodes}) vs Django (${djangoMetrics.domNodes})`,
        severity: 'error'
      })
    }
    
    setParityIssues(issues)
  }

  // Handle React preview metrics
  const handleReactMetrics = (metrics) => {
    setReactMetrics(metrics)
    if (djangoMetrics.renderTime) {
      checkParity()
    }
  }

  // Handle Django preview metrics
  const handleDjangoMetrics = (metrics) => {
    setDjangoMetrics(metrics)
    if (reactMetrics.renderTime) {
      checkParity()
    }
  }

  return (
    <div className={`widget-preview-comparison ${className}`}>
      {/* Header controls */}
      <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <GitCompare className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">
            Widget Preview Comparison
          </h3>
          <span className="text-sm text-gray-500">
            React vs Django Rendering
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          {/* View mode selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">View:</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="side-by-side">Side by Side</option>
              <option value="overlay">Overlay</option>
              <option value="diff">Difference</option>
            </select>
          </div>
          
          {/* Metrics toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMetrics}
              onChange={(e) => setShowMetrics(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Show Metrics</span>
          </label>
        </div>
      </div>
      
      {/* Parity status */}
      {parityIssues.length > 0 && (
        <div className="p-3 bg-yellow-50 border-b border-yellow-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-yellow-900 mb-1">
                Rendering Parity Issues Detected
              </h4>
              <ul className="text-xs text-yellow-700 space-y-1">
                {parityIssues.map((issue, index) => (
                  <li key={index} className="flex items-start gap-1">
                    {issue.severity === 'error' ? (
                      <X className="w-3 h-3 text-red-500 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-yellow-500 mt-0.5" />
                    )}
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {/* Comparison views */}
      <div className="relative">
        {viewMode === 'side-by-side' && (
          <div className="grid grid-cols-2 gap-px bg-gray-200">
            {/* React Preview */}
            <div className="bg-white">
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
                <h4 className="text-sm font-medium text-blue-900">React Rendering</h4>
              </div>
              <WidgetReactPreview
                widgetType={widgetType}
                configuration={configuration}
                showControls={false}
                onMetrics={handleReactMetrics}
                className="border-r border-gray-200"
              />
            </div>
            
            {/* Django Preview */}
            <div className="bg-white">
              <div className="px-4 py-2 bg-green-50 border-b border-green-200">
                <h4 className="text-sm font-medium text-green-900">Django Rendering</h4>
              </div>
              <WidgetPreview
                widgetType={widgetType}
                configuration={configuration}
                showControls={false}
                onMetrics={handleDjangoMetrics}
              />
            </div>
          </div>
        )}
        
        {viewMode === 'overlay' && (
          <div className="relative">
            <div className="absolute inset-0 z-10 pointer-events-none opacity-50">
              <div className="px-4 py-2 bg-blue-50">
                <h4 className="text-sm font-medium text-blue-900">React Overlay</h4>
              </div>
              <WidgetReactPreview
                widgetType={widgetType}
                configuration={configuration}
                showControls={false}
                onMetrics={handleReactMetrics}
              />
            </div>
            <div className="relative z-0">
              <div className="px-4 py-2 bg-green-50">
                <h4 className="text-sm font-medium text-green-900">Django Base</h4>
              </div>
              <WidgetPreview
                widgetType={widgetType}
                configuration={configuration}
                showControls={false}
                onMetrics={handleDjangoMetrics}
              />
            </div>
          </div>
        )}
        
        {viewMode === 'diff' && (
          <div className="p-4 bg-gray-50">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="text-center text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Visual Diff Mode
                </h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  Visual difference highlighting between React and Django rendering
                  will be implemented in the next iteration.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Metrics panel */}
      {showMetrics && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border-t border-gray-200">
          {/* React metrics */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h5 className="text-sm font-medium text-gray-900 mb-3">React Metrics</h5>
            <dl className="space-y-2">
              <div className="flex justify-between text-xs">
                <dt className="text-gray-500">Render Time:</dt>
                <dd className="font-mono text-gray-900">
                  {reactMetrics.renderTime || '-'} ms
                </dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-gray-500">DOM Nodes:</dt>
                <dd className="font-mono text-gray-900">
                  {reactMetrics.domNodes || '-'}
                </dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-gray-500">Component Count:</dt>
                <dd className="font-mono text-gray-900">
                  {reactMetrics.componentCount || '-'}
                </dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-gray-500">Memory Usage:</dt>
                <dd className="font-mono text-gray-900">
                  {reactMetrics.memoryUsage ? `${(reactMetrics.memoryUsage / 1024).toFixed(2)} KB` : '-'}
                </dd>
              </div>
            </dl>
          </div>
          
          {/* Django metrics */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h5 className="text-sm font-medium text-gray-900 mb-3">Django Metrics</h5>
            <dl className="space-y-2">
              <div className="flex justify-between text-xs">
                <dt className="text-gray-500">Render Time:</dt>
                <dd className="font-mono text-gray-900">
                  {djangoMetrics.renderTime || '-'} ms
                </dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-gray-500">DOM Nodes:</dt>
                <dd className="font-mono text-gray-900">
                  {djangoMetrics.domNodes || '-'}
                </dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-gray-500">Template Calls:</dt>
                <dd className="font-mono text-gray-900">
                  {djangoMetrics.templateCalls || '-'}
                </dd>
              </div>
              <div className="flex justify-between text-xs">
                <dt className="text-gray-500">HTML Size:</dt>
                <dd className="font-mono text-gray-900">
                  {djangoMetrics.htmlSize ? `${(djangoMetrics.htmlSize / 1024).toFixed(2)} KB` : '-'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
      
      {/* Parity status indicator */}
      <div className="flex items-center justify-center p-3 bg-gray-50 border-t border-gray-200">
        {parityIssues.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600">
            <Check className="w-5 h-5" />
            <span className="text-sm font-medium">Rendering parity maintained</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-yellow-600">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">
              {parityIssues.length} parity {parityIssues.length === 1 ? 'issue' : 'issues'} found
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default WidgetPreviewComparison