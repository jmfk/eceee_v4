import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Trash2, Save, AlertCircle, X, Clipboard, Scissors, Copy } from 'lucide-react'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { useUnifiedData } from '../contexts/unified-data'
import { useClipboard } from '../contexts/ClipboardContext'
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
    validationState = { isValid: true, hasErrors: false },
    // Dirty state prop (from PageEditor)
    isDirty = false,
    // Auto-save props
    autoSaveCountdown = null,
    autoSaveStatus = 'idle',
    onClearClipboard = null
}) => {
    // Get global clipboard state
    const { clipboardData, pasteModePaused, togglePasteMode } = useClipboard();
    const {
        notifications,
        currentNotificationIndex,
        clearNotifications,
        navigateNotifications,
        goToNotification
    } = useGlobalNotifications()

    // Get global app status from UnifiedDataContext (for errors/warnings only)
    const { useExternalChanges } = useUnifiedData()
    const componentId = 'status-bar'
    const [errors, setErrors] = useState([]);
    const [warnings, setWarnings] = useState([]);

    // History dropdown state
    const [showHistory, setShowHistory] = useState(false);
    const historyRef = useRef(null);

    // Subscribe to errors and warnings from UDC (isDirty comes from PageEditor prop)
    useExternalChanges(componentId, state => {
        queueMicrotask(() => {
            setErrors(state.metadata.errors);
            setWarnings(state.metadata.warnings);
        });
    });

    // Handle click outside to close history dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (historyRef.current && !historyRef.current.contains(event.target)) {
                setShowHistory(false);
            }
        };

        if (showHistory) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showHistory]);

    // Helper function to get notification type color
    const getNotificationColor = (type) => {
        switch (type) {
            case 'success': return 'bg-green-500';
            case 'error': return 'bg-red-500';
            case 'warning': return 'bg-yellow-500';
            default: return 'bg-blue-500';
        }
    };

    // Helper function to extract message text
    const getMessageText = (notification) => {
        if (typeof notification?.message === 'string') {
            return notification.message;
        } else if (typeof notification?.message === 'object') {
            return notification?.message?.message || 'Notification';
        }
        return 'Notification';
    };

    return (
        <div className={`bg-white border-t border-gray-200 px-4 py-2 ${className} relative`}>
            {/* Notification History Dropdown */}
            {showHistory && notifications.length > 0 && (
                <div
                    ref={historyRef}
                    className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-300 rounded-lg shadow-2xl z-50 max-h-96 overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <h3 className="font-semibold text-gray-900">Notification History</h3>
                        <button
                            onClick={() => setShowHistory(false)}
                            className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                            title="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable notification list */}
                    <div className="overflow-y-auto flex-1">
                        {notifications.map((notification, index) => (
                            <div
                                key={notification.id}
                                className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${index === currentNotificationIndex ? 'bg-blue-50' : ''
                                    }`}
                                onClick={() => {
                                    goToNotification(index);
                                    setShowHistory(false);
                                }}
                                role="button"
                                tabIndex={0}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="flex items-start space-x-3">
                                    {/* Type indicator */}
                                    <span className={`inline-block w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getNotificationColor(notification.type)}`} />

                                    {/* Message content */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900 break-words">
                                            {getMessageText(notification)}
                                        </p>

                                        {/* Metadata row */}
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs text-gray-500">
                                                {notification.timestamp.toLocaleTimeString()}
                                            </span>
                                            <span className={`text-xs font-medium ${notification.type === 'success' ? 'text-green-600' :
                                                notification.type === 'error' ? 'text-red-600' :
                                                    notification.type === 'warning' ? 'text-yellow-600' :
                                                        'text-gray-600'
                                                }`}>
                                                {notification.type}
                                            </span>
                                            {notification.category && (
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                    {notification.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer with count */}
                    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
                        {notifications.length} notification{notifications.length !== 1 ? 's' : ''} in history
                    </div>
                </div>
            )}

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

                            {/* Current notification - clickable to show history */}
                            <div
                                className="flex items-center space-x-2 flex-1 min-w-0 cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
                                onClick={() => setShowHistory(!showHistory)}
                                title="Click to view notification history"
                            >
                                <span className={`inline-block w-2 h-2 rounded-full ${getNotificationColor(notifications[currentNotificationIndex]?.type)}`} />
                                <span className="text-gray-700 truncate">
                                    {getMessageText(notifications[currentNotificationIndex])}
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
                                    {/* Auto-save status display */}
                                    {autoSaveStatus === 'countdown' && autoSaveCountdown !== null && (
                                        <span className="flex items-center text-blue-600 font-medium">
                                            <Save className="w-4 h-4 mr-1" />
                                            Saving in {autoSaveCountdown}...
                                        </span>
                                    )}
                                    {autoSaveStatus === 'saving' && (
                                        <span className="flex items-center text-blue-600 font-medium">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-1"></div>
                                            Saving...
                                        </span>
                                    )}
                                    {autoSaveStatus === 'saved' && (
                                        <span className="flex items-center text-green-600 font-medium">
                                            <Save className="w-4 h-4 mr-1" />
                                            All changes saved ✓
                                        </span>
                                    )}
                                    {autoSaveStatus === 'error' && (
                                        <span className="flex items-center text-red-600 font-medium">
                                            <AlertCircle className="w-4 h-4 mr-1" />
                                            Auto-save failed
                                        </span>
                                    )}
                                    {autoSaveStatus === 'idle' && (
                                        <>
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
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Clipboard Indicator - Always Visible Three States */}
                <div className={`flex items-center space-x-2 px-3 py-1 border rounded text-xs flex-shrink-0 ml-4 transition-all ${
                    !clipboardData || !clipboardData.data || clipboardData.data.length === 0
                        ? 'bg-gray-50 border-gray-200 text-gray-400'
                        : pasteModePaused 
                            ? 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200 cursor-pointer' 
                            : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 cursor-pointer'
                }`}>
                    <Clipboard className="w-3 h-3" />
                    {clipboardData && clipboardData.data && clipboardData.data.length > 0 ? (
                        <>
                            <button
                                onClick={togglePasteMode}
                                disabled={!togglePasteMode}
                                className="flex items-center space-x-2"
                                title={pasteModePaused ? 'Click to activate paste mode' : 'Click to pause paste mode (or press ESC / Right-click)'}
                            >
                                {clipboardData.operation === 'cut' ? (
                                    <Scissors className="w-3 h-3" />
                                ) : (
                                    <Copy className="w-3 h-3" />
                                )}
                                <span className="font-medium">
                                    {clipboardData.data.length} widget{clipboardData.data.length !== 1 ? 's' : ''} {clipboardData.operation === 'cut' ? 'cut' : 'copied'}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    pasteModePaused ? 'bg-gray-200 text-gray-600' : 'bg-purple-200 text-purple-800'
                                }`}>
                                    {pasteModePaused ? 'PAUSED' : 'ACTIVE'}
                                </span>
                            </button>
                        </>
                    ) : (
                        <span className="font-medium">Empty</span>
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