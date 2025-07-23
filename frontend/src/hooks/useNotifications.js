import { useState, useCallback } from 'react'
import { extractErrorMessage } from '../utils/errorHandling'

const useNotifications = () => {
    const [notifications, setNotifications] = useState([])
    const [confirmDialog, setConfirmDialog] = useState(null)
    const [promptDialog, setPromptDialog] = useState(null)

    const showNotification = useCallback((message, type = 'error') => {
        const id = Date.now() + Math.random()
        const notificationObj = {
            id,
            error: message, // Keep as 'error' for backward compatibility
            type,
            timestamp: new Date()
        }

        setNotifications(prev => [...prev, notificationObj])

        // Return the notification ID for potential removal
        return id
    }, [])

    const removeNotification = useCallback((notificationId) => {
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId))
    }, [])

    const clearAllNotifications = useCallback(() => {
        setNotifications([])
    }, [])

    // Backward compatibility aliases
    const showError = useCallback((error, type = 'error') => {
        const message = extractErrorMessage(error, 'An error occurred')
        return showNotification(message, type)
    }, [showNotification])

    const removeError = useCallback((errorId) => {
        return removeNotification(errorId)
    }, [removeNotification])

    const clearAllErrors = useCallback(() => {
        return clearAllNotifications()
    }, [clearAllNotifications])

    // Dialog methods
    const showConfirm = useCallback((options) => {
        return new Promise((resolve) => {
            setConfirmDialog({
                ...options,
                onConfirm: () => {
                    setConfirmDialog(null)
                    resolve(true)
                },
                onCancel: () => {
                    setConfirmDialog(null)
                    resolve(false)
                }
            })
        })
    }, [])

    const showPrompt = useCallback((options) => {
        return new Promise((resolve) => {
            setPromptDialog({
                ...options,
                onSubmit: (value) => {
                    setPromptDialog(null)
                    resolve(value)
                },
                onCancel: () => {
                    setPromptDialog(null)
                    resolve(null)
                }
            })
        })
    }, [])

    const hideConfirm = useCallback(() => {
        setConfirmDialog(null)
    }, [])

    const hidePrompt = useCallback(() => {
        setPromptDialog(null)
    }, [])

    return {
        errors: notifications, // Keep as 'errors' for backward compatibility
        notifications,
        showNotification,
        showError,
        removeNotification,
        removeError,
        clearAllNotifications,
        clearAllErrors,
        // Dialog methods
        showConfirm,
        showPrompt,
        hideConfirm,
        hidePrompt,
        confirmDialog,
        promptDialog
    }
}

export default useNotifications 