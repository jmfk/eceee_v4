import { createContext, useContext } from 'react'
import Notification from './Notification'
import ConfirmDialog from './ConfirmDialog'
import PromptDialog from './PromptDialog'
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
    const { errors, removeError, confirmDialog, promptDialog } = useNotificationContext()

    return (
        <>
            {/* Notifications */}
            {errors.map((errorObj) => (
                <Notification
                    key={errorObj.id}
                    message={errorObj.error}
                    type={errorObj.type}
                    onClose={() => removeError(errorObj.id)}
                />
            ))}

            {/* Confirm Dialog */}
            {confirmDialog && (
                <ConfirmDialog
                    isOpen={true}
                    {...confirmDialog}
                />
            )}

            {/* Prompt Dialog */}
            {promptDialog && (
                <PromptDialog
                    isOpen={true}
                    {...promptDialog}
                />
            )}
        </>
    )
}

export default NotificationManager 