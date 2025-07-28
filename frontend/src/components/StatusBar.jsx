import { ChevronLeft, ChevronRight, Trash2, Clock } from 'lucide-react'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'

const StatusBar = ({
    showAutoSave = false,
    isDirty = false,
    customStatusContent = null,
    className = "",
    // Version management props
    showVersionSelector = false,
    currentVersion = null,
    availableVersions = [],
    onVersionChange = null,
    onRefreshVersions = null
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
                                    {typeof notifications[currentNotificationIndex]?.error === 'string'
                                        ? notifications[currentNotificationIndex]?.error
                                        : typeof notifications[currentNotificationIndex]?.error === 'object'
                                            ? notifications[currentNotificationIndex]?.error?.message || 'Notification'
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
                        <span className="text-orange-600 font-medium">Unsaved changes</span>
                    )}
                    {showAutoSave && (
                        <>
                            <Clock className="w-4 h-4" />
                            <span>Auto-save enabled</span>
                        </>
                    )}

                    {/* Version selector */}
                    {showVersionSelector && availableVersions.length > 0 && (
                        <>
                            <div className="w-px h-4 bg-gray-300 mx-2" />
                            <span className="text-xs text-gray-500">Version:</span>
                            <select
                                value={currentVersion?.id || ''}
                                onChange={(e) => onVersionChange && onVersionChange(parseInt(e.target.value))}
                                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
                            >
                                {availableVersions.length === 0 && (
                                    <option value="" disabled>Loading...</option>
                                )}

                                {/* Latest saved option */}
                                {availableVersions[0] && (
                                    <option value={availableVersions[0].id}>
                                        🚧 Latest
                                    </option>
                                )}

                                {/* Published version option */}
                                {availableVersions.find(v => v.status === 'published' && v.is_current) && (
                                    <option value={availableVersions.find(v => v.status === 'published' && v.is_current).id}>
                                        ✓ Published
                                    </option>
                                )}

                                {/* Other versions */}
                                {availableVersions.slice(1).map(version => {
                                    const publishedVersion = availableVersions.find(v => v.status === 'published' && v.is_current);
                                    if (publishedVersion && version.id === publishedVersion.id) {
                                        return null; // Skip already added published version
                                    }

                                    const statusIcon = version.status === 'published' ? '✓' : version.status === 'draft' ? '📝' : '📋';
                                    return (
                                        <option key={version.id} value={version.id}>
                                            {statusIcon} v{version.version_number}
                                        </option>
                                    );
                                })}
                            </select>

                            {currentVersion && (
                                <span className={`text-xs px-1.5 py-0.5 rounded text-xs ${currentVersion.status === 'published'
                                    ? 'bg-green-100 text-green-600'
                                    : 'bg-orange-100 text-orange-600'
                                    }`}>
                                    {currentVersion.status === 'published' ? '✓' : '⚠'} {currentVersion.status}
                                </span>
                            )}

                            {onRefreshVersions && (
                                <button
                                    onClick={onRefreshVersions}
                                    className="text-xs text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
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