import { ChevronLeft, ChevronRight, Trash2, Clock } from 'lucide-react'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import VersionSelector from './VersionSelector'

const StatusBar = ({
    showAutoSave = false,
    isDirty = false,
    customStatusContent = null,
    className = "",
    // Version management props
    currentVersion = null,
    availableVersions = [],
    onVersionChange = null,
    onRefreshVersions = null,
    // Save functionality props
    onSaveClick = null,
    onAutoSaveToggle = null,
    autoSaveEnabled = true
}) => {
    const {
        notifications,
        currentNotificationIndex,
        clearNotifications,
        navigateNotifications
    } = useGlobalNotifications()

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
                                <span>Ready</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Right side - Auto-save status and other info */}
                <div className="flex items-center space-x-2 text-gray-600 flex-shrink-0 ml-4">
                    {isDirty && (
                        <button
                            onClick={() => onSaveClick && onSaveClick()}
                            className="text-orange-600 font-medium hover:text-orange-700 hover:bg-orange-50 px-2 py-1 rounded transition-colors cursor-pointer"
                            title="Click to save changes"
                        >
                            💾 Unsaved changes - Click to save
                        </button>
                    )}
                    {showAutoSave && (
                        <>
                            <div className="w-px h-4 bg-gray-300 mx-2" />
                            <button
                                onClick={() => onAutoSaveToggle && onAutoSaveToggle(!autoSaveEnabled)}
                                className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${autoSaveEnabled
                                    ? 'text-green-600 hover:bg-green-50'
                                    : 'text-gray-500 hover:bg-gray-50'
                                    }`}
                                title={`Auto-save is ${autoSaveEnabled ? 'enabled' : 'disabled'} - Click to toggle`}
                            >
                                <Clock className="w-4 h-4" />
                                <span className="text-xs">
                                    Auto-save {autoSaveEnabled ? 'ON' : 'OFF'}
                                </span>
                            </button>
                        </>
                    )}

                    {/* Version selector */}
                    {availableVersions.length > 0 && (
                        <>
                            <div className="w-px h-4 bg-gray-300 mx-2" />
                            <VersionSelector
                                currentVersion={currentVersion}
                                availableVersions={availableVersions}
                                onVersionChange={onVersionChange}
                                className="min-w-0 w-32"
                            />

                            {onRefreshVersions && (
                                <button
                                    onClick={onRefreshVersions}
                                    className="text-xs text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100 ml-2"
                                    title="Refresh versions"
                                >
                                    ↻
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default StatusBar 