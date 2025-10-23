import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'

const GlobalNotificationContext = createContext()

export const useGlobalNotifications = () => {
    const context = useContext(GlobalNotificationContext)
    if (!context) {
        throw new Error('useGlobalNotifications must be used within a GlobalNotificationProvider')
    }
    return context
}

export const GlobalNotificationProvider = ({ children }) => {
    // Notification system state
    const [notifications, setNotifications] = useState([])
    const [currentNotificationIndex, setCurrentNotificationIndex] = useState(0)

    // Notification management functions (memoized to prevent render loops)
    const addNotification = useCallback((message, type = 'info', category = null) => {
        const notification = {
            id: Date.now(),
            message,
            type, // 'success', 'error', 'warning', 'info'
            category, // Used for replacing related notifications
            timestamp: new Date()
        }

        // Trigger react-hot-toast notification
        switch (type) {
            case 'success':
                toast.success(message)
                break
            case 'error':
                toast.error(message)
                break
            case 'warning':
                toast(message, { icon: '⚠️' })
                break
            case 'info':
            default:
                toast(message)
                break
        }

        setNotifications(prev => {
            let updated = [...prev]

            // If category is specified, replace existing notification with same category
            if (category) {
                const existingIndex = updated.findIndex(n => n.category === category)
                if (existingIndex !== -1) {
                    // Replace existing notification
                    updated[existingIndex] = notification
                    return updated
                }
            }

            // Add new notification at the beginning
            updated = [notification, ...updated].slice(0, 20) // Keep max 20 notifications
            return updated
        })

        // Reset to show newest notification when adding new ones
        setCurrentNotificationIndex(0)
    }, [])

    const clearNotifications = useCallback(() => {
        setNotifications([])
        setCurrentNotificationIndex(0)
    }, [])

    const navigateNotifications = useCallback((direction) => {
        setNotifications(current => {
            if (current.length === 0) return current

            if (direction === 'next') {
                setCurrentNotificationIndex(prev =>
                    prev < current.length - 1 ? prev + 1 : prev
                )
            } else if (direction === 'prev') {
                setCurrentNotificationIndex(prev =>
                    prev > 0 ? prev - 1 : prev
                )
            }
            return current // Return current notifications unchanged
        })
    }, [])

    const goToNotification = useCallback((index) => {
        setNotifications(current => {
            if (current.length === 0 || index < 0 || index >= current.length) return current
            setCurrentNotificationIndex(index)
            return current
        })
    }, [])

    const value = useMemo(() => ({
        notifications,
        currentNotificationIndex,
        addNotification,
        clearNotifications,
        navigateNotifications,
        goToNotification
    }), [notifications, currentNotificationIndex, addNotification, clearNotifications, navigateNotifications, goToNotification])

    return (
        <GlobalNotificationContext.Provider value={value}>
            {children}
        </GlobalNotificationContext.Provider>
    )
} 