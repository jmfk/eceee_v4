import { useRef, useCallback, useState } from 'react'

/**
 * useLocalFormState Hook
 * 
 * A custom hook for managing form state without causing re-renders.
 * Uses refs to store the actual form data and only triggers re-renders
 * when absolutely necessary (e.g., for validation errors or form submission).
 * 
 * Key Features:
 * - Ref-based state storage to prevent re-renders
 * - Debounced change notifications
 * - Validation state management
 * - Form serialization for submission
 * - Dirty state tracking
 * - Reset functionality
 */
const useLocalFormState = (initialData = {}, options = {}) => {
    const {
        debounceMs = 300,
        validateOnChange = true,
        validateOnSubmit = true,
        onValidate,
        onChange,
        onSubmit
    } = options

    // Refs to store form state without causing re-renders
    const formDataRef = useRef({ ...initialData })
    const originalDataRef = useRef({ ...initialData })
    const fieldValidationsRef = useRef({})
    const debounceTimeoutRef = useRef(null)
    const validationTimeoutRef = useRef(null)

    // State that can trigger re-renders when needed
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState(null)
    const [globalValidation, setGlobalValidation] = useState({})

    // Get current form data (for serialization)
    const getFormData = useCallback(() => {
        return { ...formDataRef.current }
    }, [])

    // Check if form has unsaved changes
    const isDirty = useCallback(() => {
        return JSON.stringify(formDataRef.current) !== JSON.stringify(originalDataRef.current)
    }, [])

    // Get validation state for all fields
    const getValidationState = useCallback(() => {
        return { ...fieldValidationsRef.current }
    }, [])

    // Check if form is valid
    const isFormValid = useCallback(() => {
        const validations = fieldValidationsRef.current
        return Object.values(validations).every(validation =>
            !validation || validation.isValid !== false
        )
    }, [])

    // Handle field changes
    const handleFieldChange = useCallback((fieldName, value) => {
        // Update form data in ref (no re-render)
        formDataRef.current = {
            ...formDataRef.current,
            [fieldName]: value
        }

        // Debounced notification to parent
        if (onChange) {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current)
            }

            debounceTimeoutRef.current = setTimeout(() => {
                onChange(getFormData(), fieldName, value)
            }, debounceMs)
        }
    }, [onChange, debounceMs, getFormData])

    // Handle field validation
    const handleFieldValidation = useCallback(async (fieldName, value) => {
        if (!validateOnChange) return null

        try {
            let validation = null

            if (onValidate) {
                // Use custom validation function
                validation = await onValidate(fieldName, value, getFormData())
            } else {
                // Basic validation (can be extended)
                validation = {
                    isValid: true,
                    errors: [],
                    warnings: []
                }
            }

            // Store validation result
            fieldValidationsRef.current[fieldName] = validation

            return validation
        } catch (error) {
            console.error(`Validation error for field ${fieldName}:`, error)
            const errorValidation = {
                isValid: false,
                errors: ['Validation failed'],
                warnings: []
            }
            fieldValidationsRef.current[fieldName] = errorValidation
            return errorValidation
        }
    }, [validateOnChange, onValidate, getFormData])

    // Validate all fields
    const validateAllFields = useCallback(async () => {
        if (!onValidate) return true

        const formData = getFormData()
        const validationPromises = Object.keys(formData).map(async (fieldName) => {
            const value = formData[fieldName]
            return {
                fieldName,
                validation: await handleFieldValidation(fieldName, value)
            }
        })

        try {
            const validationResults = await Promise.all(validationPromises)

            // Update all field validations
            validationResults.forEach(({ fieldName, validation }) => {
                fieldValidationsRef.current[fieldName] = validation
            })

            // Check if all fields are valid
            const allValid = validationResults.every(({ validation }) =>
                validation && validation.isValid !== false
            )

            return allValid
        } catch (error) {
            console.error('Error validating all fields:', error)
            return false
        }
    }, [onValidate, getFormData, handleFieldValidation])

    // Handle form submission
    const handleSubmit = useCallback(async (e) => {
        if (e && e.preventDefault) {
            e.preventDefault()
        }

        setIsSubmitting(true)
        setSubmitError(null)

        try {
            // Validate all fields if enabled
            if (validateOnSubmit) {
                const isValid = await validateAllFields()
                if (!isValid) {
                    throw new Error('Form validation failed')
                }
            }

            // Get final form data
            const formData = getFormData()

            // Call submit handler
            if (onSubmit) {
                await onSubmit(formData)
            }

            // Update original data to mark form as clean
            originalDataRef.current = { ...formData }

        } catch (error) {
            console.error('Form submission error:', error)
            setSubmitError(error.message || 'Submission failed')
            throw error
        } finally {
            setIsSubmitting(false)
        }
    }, [validateOnSubmit, validateAllFields, getFormData, onSubmit])

    // Reset form to initial state
    const resetForm = useCallback((newData = null) => {
        const resetData = newData || originalDataRef.current
        formDataRef.current = { ...resetData }
        originalDataRef.current = { ...resetData }
        fieldValidationsRef.current = {}
        setSubmitError(null)
        setGlobalValidation({})

        // Clear any pending timeouts
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current)
        }
        if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current)
        }
    }, [])

    // Update form data programmatically
    const updateFormData = useCallback((newData, merge = true) => {
        if (merge) {
            formDataRef.current = { ...formDataRef.current, ...newData }
        } else {
            formDataRef.current = { ...newData }
            originalDataRef.current = { ...newData }
        }
    }, [])

    // Get field value
    const getFieldValue = useCallback((fieldName) => {
        return formDataRef.current[fieldName]
    }, [])

    // Set field value programmatically
    const setFieldValue = useCallback((fieldName, value) => {
        handleFieldChange(fieldName, value)
    }, [handleFieldChange])

    // Cleanup timeouts on unmount
    const cleanup = useCallback(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current)
        }
        if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current)
        }
    }, [])

    return {
        // Form data methods
        getFormData,
        updateFormData,
        resetForm,

        // Field methods
        getFieldValue,
        setFieldValue,
        handleFieldChange,
        handleFieldValidation,

        // Form state
        get isDirty() { return isDirty() },
        get isFormValid() { return isFormValid() },
        isSubmitting,
        submitError,
        globalValidation,

        // Form actions
        handleSubmit,
        validateAllFields,

        // Validation state
        getValidationState,

        // Cleanup
        cleanup
    }
}

export default useLocalFormState
