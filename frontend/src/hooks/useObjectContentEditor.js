import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { objectInstancesApi, objectTypesApi } from '../api/objectStorage'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'

/**
 * Custom hook to manage object content editing state and operations
 * Consolidates form data, widget management, and save operations
 */
export const useObjectContentEditor = (instance, objectType, isNewInstance, parentId) => {
    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Form data state - simplified from form buffer
    const [formData, setFormData] = useState({
        objectTypeId: instance?.objectType?.id || objectType?.id || '',
        title: instance?.title || '',
        data: instance?.data || {},
        status: instance?.status || 'draft',
        widgets: instance?.widgets || {},
        metadata: instance?.metadata || {}
    })

    // Track changes
    const [hasChanges, setHasChanges] = useState(false)
    const [errors, setErrors] = useState({})

    // Update form data when instance changes
    useEffect(() => {
        if (instance) {
            const newFormData = {
                objectTypeId: instance.objectType?.id || objectType?.id || '',
                title: instance.title || '',
                data: instance.data || {},
                status: instance.status || 'draft',
                widgets: instance.widgets || {},
                metadata: instance.metadata || {}
            }
            setFormData(newFormData)
            setHasChanges(false)
        }
    }, [instance, objectType])

    // Update field helper
    const updateField = useCallback((fieldPath, value) => {
        setFormData(prev => {
            const newData = { ...prev }

            if (fieldPath.startsWith('data.')) {
                const dataField = fieldPath.replace('data.', '')
                newData.data = { ...prev.data, [dataField]: value }
            } else {
                newData[fieldPath] = value
            }

            return newData
        })

        setHasChanges(true)

        // Clear error when user starts typing
        if (errors[fieldPath]) {
            setErrors(prev => ({ ...prev, [fieldPath]: null }))
        }
    }, [errors])

    // Update widgets
    const updateWidgets = useCallback((newWidgets) => {
        setFormData(prev => ({ ...prev, widgets: newWidgets }))
        setHasChanges(true)
    }, [])

    // Validation
    const validateForm = useCallback(() => {
        const newErrors = {}

        if (!formData.objectTypeId) {
            newErrors.objectTypeId = 'Object type is required'
        }

        if (!formData.title?.trim()) {
            newErrors.title = 'Title is required'
        }

        // Validate required schema fields
        if (objectType?.schema?.properties) {
            const required = objectType.schema.required || []
            required.forEach(fieldName => {
                if (!formData.data[fieldName] || formData.data[fieldName] === '') {
                    newErrors[`data.${fieldName}`] = `${fieldName} is required`
                }
            })
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }, [formData, objectType])

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async ({ saveMode = 'update_current' }) => {
            if (!validateForm()) {
                throw new Error('Validation failed')
            }

            const saveData = {
                ...formData,
                ...(isNewInstance && parentId && { parent: parentId })
            }

            if (isNewInstance) {
                return objectInstancesApi.create(saveData)
            } else if (saveMode === 'update_current') {
                return objectInstancesApi.updateCurrentVersion(instance.id, saveData)
            } else {
                return objectInstancesApi.update(instance.id, saveData)
            }
        },
        onSuccess: (response, { saveMode }) => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance', instance?.id])

            let successMessage
            if (isNewInstance) {
                successMessage = 'Object created successfully'
            } else if (saveMode === 'update_current') {
                successMessage = `Current version (v${instance?.version || 1}) updated successfully`
            } else {
                successMessage = `New version (v${(instance?.version || 1) + 1}) created successfully`
            }

            addNotification(successMessage, 'success')
            setHasChanges(false)
            return response
        },
        onError: (error) => {
            console.error('Save failed:', error)
            if (error.message === 'Validation failed') {
                addNotification('Please fix the validation errors', 'error')
            } else {
                const errorMessage = error.response?.data?.error || 'Failed to save object'
                addNotification(errorMessage, 'error')

                // Handle validation errors from server
                if (error.response?.data?.errors) {
                    setErrors(error.response.data.errors)
                }
            }
        }
    })

    // Save handler
    const handleSave = useCallback((saveMode = 'update_current') => {
        return saveMutation.mutateAsync({ saveMode })
    }, [saveMutation])

    return {
        formData,
        hasChanges,
        errors,
        updateField,
        updateWidgets,
        handleSave,
        isLoading: saveMutation.isPending,
        validateForm
    }
}
