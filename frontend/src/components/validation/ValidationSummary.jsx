import React from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react'

/**
 * ValidationSummary Component
 * 
 * Shows an overall validation summary with counts and expandable details
 */
export default function ValidationSummary({
    summary,
    validationResults = {},
    onPropertyClick,
    showDetails = true,
    className = ''
}) {
    if (!summary) return null

    const { isValid, hasWarnings, errorCount, warningCount, properties } = summary

    const getOverallStatus = () => {
        if (!isValid) return 'error'
        if (hasWarnings) return 'warning'
        return 'valid'
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-500" />
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-yellow-500" />
            case 'valid':
                return null // Don't show icon for valid status
            default:
                return null // Don't show icon for neutral status
        }
    }

    const getStatusMessage = () => {
        if (!isValid) {
            return `${errorCount} error${errorCount !== 1 ? 's' : ''} found`
        }
        if (hasWarnings) {
            return `${warningCount} warning${warningCount !== 1 ? 's' : ''} found`
        }
        return 'All properties are valid'
    }

    const getStatusClasses = (status) => {
        switch (status) {
            case 'error':
                return 'bg-red-50 border-red-200 text-red-800'
            case 'warning':
                return 'bg-yellow-50 border-yellow-200 text-yellow-800'
            case 'valid':
                return 'bg-gray-50 border-gray-200 text-gray-800' // Use neutral colors for valid
            default:
                return 'bg-gray-50 border-gray-200 text-gray-800'
        }
    }

    const overallStatus = getOverallStatus()
    const statusClasses = getStatusClasses(overallStatus)

    return (
        <div className={`rounded-lg border p-4 ${statusClasses} ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {getStatusIcon(overallStatus)}
                    <div>
                        <h3 className="font-medium">
                            {getStatusMessage()}
                        </h3>
                        {(errorCount > 0 || warningCount > 0) && (
                            <p className="text-sm opacity-75 mt-1">
                                {errorCount > 0 && `${errorCount} error${errorCount !== 1 ? 's' : ''}`}
                                {errorCount > 0 && warningCount > 0 && ', '}
                                {warningCount > 0 && `${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
                            </p>
                        )}
                    </div>
                </div>

                {showDetails && (errorCount > 0 || warningCount > 0) && (
                    <div className="text-sm opacity-75">
                        Click properties to view details
                    </div>
                )}
            </div>

            {showDetails && (errorCount > 0 || warningCount > 0) && (
                <div className="mt-4 space-y-2">
                    {properties.errors.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Properties with Errors
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {properties.errors.map(prop => (
                                    <button
                                        key={prop}
                                        onClick={() => onPropertyClick?.(prop)}
                                        className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200 transition-colors"
                                    >
                                        {prop}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {properties.warnings.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Properties with Warnings
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {properties.warnings.map(prop => (
                                    <button
                                        key={prop}
                                        onClick={() => onPropertyClick?.(prop)}
                                        className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm hover:bg-yellow-200 transition-colors"
                                    >
                                        {prop}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {properties.valid.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Valid Properties ({properties.valid.length})
                            </h4>
                            <div className="text-sm opacity-75">
                                {properties.valid.join(', ')}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
