import React, { createContext, useContext, useState, useCallback } from 'react'

const AppStatusContext = createContext()

export const AppStatusProvider = ({ children }) => {
    // Global dirty state
    const [isDirty, setIsDirty] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    // Global error tracking
    const [errors, setErrors] = useState([])
    const [warnings, setWarnings] = useState([])

    // Add an error with optional category
    const addError = useCallback((error, category = 'general') => {
        setErrors(prev => [...prev, { message: error, category, timestamp: Date.now() }])
    }, [])

    // Add a warning with optional category
    const addWarning = useCallback((warning, category = 'general') => {
        setWarnings(prev => [...prev, { message: warning, category, timestamp: Date.now() }])
    }, [])

    // Clear errors by category
    const clearErrors = useCallback((category) => {
        if (category) {
            setErrors(prev => prev.filter(error => error.category !== category))
        } else {
            setErrors([])
        }
    }, [])

    // Clear warnings by category
    const clearWarnings = useCallback((category) => {
        if (category) {
            setWarnings(prev => prev.filter(warning => warning.category !== category))
        } else {
            setWarnings([])
        }
    }, [])

    const contextValue = {
        // Dirty state
        isDirty,
        setIsDirty,
        hasUnsavedChanges,
        setHasUnsavedChanges,

        // Error handling
        errors,
        warnings,
        addError,
        addWarning,
        clearErrors,
        clearWarnings
    }

    return (
        <AppStatusContext.Provider value={contextValue}>
            {children}
        </AppStatusContext.Provider>
    )
}

// Hook to use app status
export const useAppStatus = () => {
    const context = useContext(AppStatusContext)
    if (!context) {
        throw new Error('useAppStatus must be used within AppStatusProvider')
    }
    return context
}

export default AppStatusContext
