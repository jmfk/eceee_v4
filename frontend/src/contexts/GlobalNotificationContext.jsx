import { createContext, useContext, useState } from 'react'

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

    // Notification management functions
    const addNotification = (message, type = 'info', category = null) => {
        const notification = {
            id: Date.now(),
            message,
            type, // 'success', 'error', 'warning', 'info'
            category, // Used for replacing related notifications
            timestamp: new Date()
        }

        setNotifications(prev => {
            let updated = [...prev]

            // If category is specified, replace existing notification with same category
            if (category) {
                const existingIndex = updated.findIndex(n => n.category === category)
                if (existingIndex !== -1) {
                    // Replace existing notification
                    updated[existingIndex] = notification
                    // Keep current index if we're viewing the replaced notification
                    if (currentNotificationIndex === existingIndex) {
                        // Stay on the same notification (now updated)
                    } else if (currentNotificationIndex > existingIndex) {
                        // Adjust index if we replaced a notification before current one
                        setCurrentNotificationIndex(prev => prev)
                    }
                    return updated
                }
            }

            // Add new notification at the beginning
            updated = [notification, ...updated].slice(0, 20) // Keep max 20 notifications
            setCurrentNotificationIndex(0) // Show newest notification
            return updated
        })
    }

    const clearNotifications = () => {
        setNotifications([])
        setCurrentNotificationIndex(0)
    }

    const navigateNotifications = (direction) => {
        if (notifications.length === 0) return

        if (direction === 'next') {
            setCurrentNotificationIndex(prev =>
                prev < notifications.length - 1 ? prev + 1 : prev
            )
        } else if (direction === 'prev') {
            setCurrentNotificationIndex(prev =>
                prev > 0 ? prev - 1 : prev
            )
        }
    }

    const value = {
        notifications,
        currentNotificationIndex,
        addNotification,
        clearNotifications,
        navigateNotifications
    }

    return (
        <GlobalNotificationContext.Provider value={value}>
            {children}
        </GlobalNotificationContext.Provider>
    )
} 