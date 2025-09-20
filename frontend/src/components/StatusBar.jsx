import React, { useEffect } from 'react'
import { ChevronLeft, ChevronRight, Trash2, Save, AlertCircle } from 'lucide-react'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { useAppStatus } from '../contexts/AppStatusContext'
import { useUnifiedData } from '../contexts/unified-data'
import VersionSelector from './VersionSelector'

const StatusBar = ({
    customStatusContent = null,
    className = "",
    // Version management props
    currentVersion = null,
    availableVersions = [],
    onVersionChange = null,
    onRefreshVersions = null,
    // Save functionality props
    onSaveClick = null,
    onSaveNewClick = null,
    isSaving = false,
    isNewPage = false,
    // Validation state props
    validationState = { isValid: true, hasErrors: false }
}) => {
    const {
        notifications,
        currentNotificationIndex,
        clearNotifications,
        navigateNotifications
    } = useGlobalNotifications()

    // Get global app status
    const {
        errors,
        warnings
    } = useAppStatus()

    // Get dirty state from UnifiedDataContext
    const { isDirty, hasUnsavedChanges } = useUnifiedData()

    return (
        <div className={`bg-white border-t border-gray-200 px-4 py-2 ${className}`}>
            <div className="flex items-center justify-between text-sm">
                {/* Notification area */}
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {notifications.length > 0 ? (
                        <>
                            {/* Notification navigation */}
                            <button
                                onClick={() => navigateNotifications('prev')}
                                disabled={currentNotificationIndex === 0}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Previous notification"
                            >
                                <ChevronLeft className="w-4 h-4 text-gray-600" />
                            </button>

                            {/* Current notification */}
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <span className={`inline-block w-2 h-2 rounded-full ${notifications[currentNotificationIndex]?.type === 'success' ? 'bg-green-500' :
                                    notifications[currentNotificationIndex]?.type === 'error' ? 'bg-red-500' :
                                        notifications[currentNotificationIndex]?.type === 'warning' ? 'bg-yellow-500' :
                                            'bg-blue-500'
                                    }`} />
                                <span className="text-gray-700 truncate">
                                    {typeof notifications[currentNotificationIndex]?.message === 'string'
                                        ? notifications[currentNotificationIndex]?.message
                                        : typeof notifications[currentNotificationIndex]?.message === 'object'
                                            ? notifications[currentNotificationIndex]?.message?.message || 'Notification'
                                            : 'Notification'}
                                </span>
                                <span className="text-xs text-gray-500 flex-shrink-0">
                                    {notifications[currentNotificationIndex]?.timestamp.toLocaleTimeString()}
                                </span>
                            </div>

                            {/* Notification counter and navigation */}
                            <span className="text-xs text-gray-500 flex-shrink-0">
                                {currentNotificationIndex + 1} of {notifications.length}
                            </span>

                            <button
                                onClick={() => navigateNotifications('next')}
                                disabled={currentNotificationIndex === notifications.length - 1}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Next notification"
                            >
                                <ChevronRight className="w-4 h-4 text-gray-600" />
                            </button>

                            {/* Clear button */}
                            <button
                                onClick={clearNotifications}
                                className="p-1 rounded hover:bg-gray-100 text-gray-600"
                                title="Clear all notifications"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        /* Default status when no notifications */
                        <div className="flex items-center space-x-4 text-gray-600">
                            {customStatusContent || (
                                <div className="flex items-center space-x-4">
                                    <span>{errors.length > 0 || warnings.length > 0 ? 'Issues Found' : 'Ready'}</span>
                                    {errors.length > 0 && (
                                        <span className="flex items-center text-red-600">
                                            <AlertCircle className="w-4 h-4 mr-1" />
                                            {errors.length} Error{errors.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {warnings.length > 0 && (
                                        <span className="flex items-center text-yellow-600">
                                            <AlertCircle className="w-4 h-4 mr-1" />
                                            {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right side - Save buttons and version selector */}
                <div className="flex items-center space-x-3 text-gray-600 flex-shrink-0 ml-4">
                    {/* Version selector - always show if versions available */}
                    {availableVersions.length > 0 && (
                        <VersionSelector
                            currentVersion={currentVersion}
                            availableVersions={availableVersions}
                            onVersionChange={onVersionChange}
                            className="min-w-0 w-32"
                        />
                    )}

                    {/* Save buttons */}
                    {isDirty && (
                        <div className="flex items-center space-x-2">
                            {!isNewPage && (
                                <>
                                    <button
                                        onClick={() => onSaveClick && onSaveClick()}
                                        disabled={isSaving}
                                        className="font-medium px-3 py-1 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 rounded transition-colors flex items-center space-x-1"
                                        title={validationState.hasErrors ? "Save changes (validation errors will be handled)" : "Update current version"}
                                    >
                                        {isSaving ? (
                                            <>
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                <span className="text-xs">Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-3 h-3" />
                                                <span className="text-xs">Save</span>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => onSaveNewClick && onSaveNewClick()}
                                        disabled={isSaving}
                                        className="font-medium px-3 py-1 text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 rounded transition-colors flex items-center space-x-1"
                                        title="Create new version"
                                    >
                                        {isSaving ? (
                                            <>
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                                <span className="text-xs">Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-3 h-3" />
                                                <span className="text-xs">Save New</span>
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                            {isNewPage && (
                                <button
                                    onClick={() => onSaveClick && onSaveClick()}
                                    disabled={isSaving}
                                    className="font-medium px-3 py-1 text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 rounded transition-colors flex items-center space-x-1"
                                    title="Create new page"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                            <span className="text-xs">Creating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-3 h-3" />
                                            <span className="text-xs">Save</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default StatusBar 