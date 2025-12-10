import React from 'react'
import { AlertTriangle, X, RefreshCw } from 'lucide-react'

/**
 * DeletedWidgetWarning - Warning component for widgets with deleted types
 * 
 * Shows when a widget's type is no longer available on the server
 */
const DeletedWidgetWarning = ({
    widget,
    onRemove,
    onRefresh,
    className = '',
    compact = false
}) => {
    if (compact) {
        return (
            <div className={`bg-red-50 border border-red-200 rounded-md p-2 ${className}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-800 font-medium">
                            Widget type unavailable
                        </span>
                    </div>
                    <div className="flex items-center space-x-1">
                        {onRefresh && (
                            <button
                                onClick={onRefresh}
                                className="p-1 text-red-600 hover:text-red-800 transition-colors"
                                title="Refresh widget types"
                            >
                                <RefreshCw className="h-3 w-3" />
                            </button>
                        )}
                        {onRemove && (
                            <button
                                onClick={onRemove}
                                className="p-1 text-red-600 hover:text-red-800 transition-colors"
                                title="Remove widget"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
            <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="ml-3 flex-1">
                    <div className="text-sm font-medium text-red-800" role="heading" aria-level="3">
                        Widget Type Not Available
                    </div>
                    <div className="mt-2 text-sm text-red-700">
                        <div>
                            The widget type "{widget?.type || 'unknown'}" is no longer available on the server.
                            This widget cannot be edited until the widget type is restored.
                        </div>
                        {widget?.name && (
                            <div className="mt-1">
                                Widget name: <span className="font-medium">{widget.name}</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 flex space-x-3">
                        {onRefresh && (
                            <button
                                onClick={onRefresh}
                                className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                            >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Refresh Types
                            </button>
                        )}
                        {onRemove && (
                            <button
                                onClick={onRemove}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                            >
                                <X className="h-3 w-3 mr-1" />
                                Remove Widget
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DeletedWidgetWarning
