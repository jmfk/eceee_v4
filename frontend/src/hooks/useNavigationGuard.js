import { useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useNotificationContext } from '../components/NotificationManager'

/**
 * Custom hook to guard navigation when there are unsaved changes
 * 
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 * @param {Function} onSave - Function to call when user chooses to save before navigation
 * @param {Object} options - Configuration options
 * @param {boolean} options.enableBrowserBackGuard - Enable browser back/forward button guard
 * @param {string} options.savePromptTitle - Title for the save confirmation dialog
 * @param {string} options.savePromptMessage - Message for the save confirmation dialog
 * @returns {Object} Navigation guard utilities
 */
export const useNavigationGuard = (
    hasUnsavedChanges,
    onSave,
    options = {}
) => {
    const {
        enableBrowserBackGuard = true,
        savePromptTitle = 'Unsaved Changes',
        savePromptMessage = 'You have unsaved changes. Would you like to save before continuing?',
        saveButtonText = 'Save Changes',
        discardButtonText = 'Discard Changes',
        cancelButtonText = 'Cancel'
    } = options

        const { showConfirm } = useNotificationContext()
    const navigate = useNavigate()
    const location = useLocation()
    const isNavigatingRef = useRef(false)
    const originalNavigateRef = useRef(navigate)

    // Handle browser back/forward navigation and page unload
    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (hasUnsavedChanges && !isNavigatingRef.current) {
                event.preventDefault()
                event.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
                return 'You have unsaved changes. Are you sure you want to leave?'
            }
        }

        const handlePopState = async (event) => {
            if (hasUnsavedChanges && !isNavigatingRef.current) {
                // Prevent the navigation temporarily
                window.history.pushState(null, '', window.location.href)
                
                try {
                    await handleNavigationAttempt(
                        () => {
                            isNavigatingRef.current = true
                            window.history.back()
                        },
                        () => {
                            // User cancelled, stay on current page
                        }
                    )
                } catch (error) {
                    console.error('Error handling popstate:', error)
                }
            }
        }

        if (enableBrowserBackGuard) {
            window.addEventListener('beforeunload', handleBeforeUnload)
            window.addEventListener('popstate', handlePopState)
            
            // Add a history entry to catch back navigation
            if (hasUnsavedChanges) {
                window.history.pushState(null, '', window.location.href)
            }
        }

        return () => {
            if (enableBrowserBackGuard) {
                window.removeEventListener('beforeunload', handleBeforeUnload)
                window.removeEventListener('popstate', handlePopState)
            }
        }
    }, [hasUnsavedChanges, enableBrowserBackGuard, handleNavigationAttempt])

    // Handle navigation attempt with save prompt
    const handleNavigationAttempt = useCallback(async (proceedCallback, cancelCallback) => {
        try {
            // First ask if they want to save
            const shouldSave = await showConfirm({
                title: savePromptTitle,
                message: savePromptMessage,
                confirmText: saveButtonText,
                cancelText: 'Continue without saving',
                confirmButtonStyle: 'primary'
            })

            if (shouldSave) {
                // User chose to save
                if (onSave) {
                    try {
                        await onSave()
                        isNavigatingRef.current = true
                        proceedCallback()
                    } catch (error) {
                        console.error('Save failed during navigation:', error)
                        cancelCallback()
                    }
                } else {
                    isNavigatingRef.current = true
                    proceedCallback()
                }
            } else {
                // User chose to continue without saving
                isNavigatingRef.current = true
                proceedCallback()
            }
        } catch (error) {
            console.error('Navigation guard error:', error)
            cancelCallback()
        }
    }, [showConfirm, onSave, savePromptTitle, savePromptMessage, saveButtonText])

    // Safe navigation function that respects the guard
    const safeNavigate = useCallback(async (to, options = {}) => {
        if (!hasUnsavedChanges || isNavigatingRef.current) {
            navigate(to, options)
            return
        }

        try {
            await handleNavigationAttempt(
                () => {
                    isNavigatingRef.current = true
                    navigate(to, options)
                },
                () => {
                    // User cancelled navigation
                }
            )
        } catch (error) {
            console.error('Error in safeNavigate:', error)
        }
    }, [hasUnsavedChanges, navigate, handleNavigationAttempt])

    // Reset navigation flag when component unmounts or changes are saved
    useEffect(() => {
        if (!hasUnsavedChanges) {
            isNavigatingRef.current = false
        }
    }, [hasUnsavedChanges])

    return {
        safeNavigate,
        hasActiveGuard: hasUnsavedChanges,
        isNavigating: isNavigatingRef.current
    }
}

export default useNavigationGuard
