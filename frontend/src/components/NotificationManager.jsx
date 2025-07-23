import { createContext, useContext } from 'react'
import Notification from './Notification'
import useNotifications from '../hooks/useNotifications'

// Create context for notification management
const NotificationContext = createContext()

export const useNotificationContext = () => {
    const context = useContext(NotificationContext)
    if (!context) {
        throw new Error('useNotificationContext must be used within a NotificationProvider')
    }
    return context
}

export const NotificationProvider = ({ children }) => {
    const notifications = useNotifications()

    return (
        <NotificationContext.Provider value={notifications}>
            {children}
            <NotificationManager />
        </NotificationContext.Provider>
    )
}

const NotificationManager = () => {
    const { errors, removeError } = useNotificationContext()

    if (errors.length === 0) return null

    return (
        <>
            {errors.map((errorObj) => (
                <Notification
                    key={errorObj.id}
                    message={errorObj.error}
                    type={errorObj.type}
                    onClose={() => removeError(errorObj.id)}
                />
            ))}
        </>
    )
}

export default NotificationManager 