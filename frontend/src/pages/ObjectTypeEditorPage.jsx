import React from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { objectTypesApi } from '../api/objectStorage'
import ObjectTypeForm from '../components/ObjectTypeForm'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const ObjectTypeEditorPage = () => {
    const { id, tab = 'basic' } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Determine if we're creating or editing
    // id will be undefined when route is /settings/object-types/new/:tab
    // id will be 'new' if someone navigates directly with id param
    const isCreating = !id || id === 'new'
    const objectTypeId = isCreating ? null : id

    // Fetch object type data if editing
    const { data: objectTypeResponse, isLoading } = useQuery({
        queryKey: ['objectType', objectTypeId],
        queryFn: () => objectTypesApi.get(objectTypeId),
        enabled: !!objectTypeId
    })

    const objectType = objectTypeResponse?.data

    // Set document title
    useDocumentTitle(isCreating ? 'New Object Type' : (objectType?.label || 'Object Type'))

    // Create object type mutation
    const createMutation = useMutation({
        mutationFn: async (formData) => {
            const response = await objectTypesApi.create(formData)
            return response
        },
        onSuccess: (response) => {
            const newObjectType = response?.data
            addNotification('Object type created successfully', 'success')
            queryClient.invalidateQueries(['objectTypes'])

            // Navigate to the newly created object type's edit page
            if (newObjectType?.id) {
                navigate(`/settings/object-types/${newObjectType.id}/basic`)
            } else {
                // Fallback: navigate back to list if ID is missing
                navigate('/settings/object-types')
            }
        },
        onError: (error) => {
            console.error('Failed to create object type:', error)

            let errorMessage = 'Failed to create object type'
            const errorData = error.response?.data

            // Handle Django REST Framework validation errors
            if (errorData) {
                // Collect all field-level errors
                const fieldErrors = []

                // Check for field-specific errors (name, label, pluralLabel, etc.)
                Object.keys(errorData).forEach(fieldName => {
                    if (fieldName === 'error' || fieldName === 'detail') {
                        // Skip generic error fields, handle them separately
                        return
                    }

                    const fieldError = errorData[fieldName]
                    let errorText = ''

                    // Handle different error formats
                    if (Array.isArray(fieldError)) {
                        errorText = fieldError.map(err => {
                            // Handle DRF ErrorDetail objects
                            if (typeof err === 'object' && err.toString) {
                                return err.toString()
                            }
                            return err
                        }).join(', ')
                    } else if (typeof fieldError === 'string') {
                        errorText = fieldError
                    } else if (typeof fieldError === 'object' && fieldError.toString) {
                        errorText = fieldError.toString()
                    }

                    if (errorText) {
                        // Capitalize field name for display
                        const displayFieldName = fieldName
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase())
                        fieldErrors.push(`${displayFieldName}: ${errorText}`)
                    }
                })

                // Use field errors if available
                if (fieldErrors.length > 0) {
                    errorMessage = fieldErrors.join('; ')
                } else if (errorData.error) {
                    // Generic error message
                    errorMessage = errorData.error
                } else if (errorData.detail) {
                    // Django REST Framework detail error
                    errorMessage = errorData.detail
                }
            } else if (error.message) {
                errorMessage = `Failed to create object type: ${error.message}`
            }

            addNotification(errorMessage, 'error')
        }
    })

    const handleTabChange = (newTab) => {
        const basePath = isCreating ? '/settings/object-types/new' : `/settings/object-types/${id}`
        navigate(`${basePath}/${newTab}`)
    }

    const handleSave = (formData) => {
        if (isCreating) {
            // Create new object type
            createMutation.mutate(formData)
        } else {
            // For editing existing object types, navigate back
            // (individual tabs have their own save buttons)
            navigate('/settings/object-types')
        }
    }

    const handleCancel = () => {
        // Navigate back to object types list
        navigate('/settings/object-types')
    }

    if (isLoading && !isCreating) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center">
                        <button
                            onClick={handleCancel}
                            className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {isCreating ? 'Create Object Type' : `Edit ${objectType?.label || 'Object Type'}`}
                            </h1>
                            <p className="text-gray-600 mt-1">
                                {isCreating
                                    ? 'Define a new object type with schema and configuration'
                                    : 'Modify object type settings and schema'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <ObjectTypeForm
                        objectType={objectType}
                        onSubmit={handleSave}
                        onCancel={handleCancel}
                        activeTab={tab}
                        onTabChange={handleTabChange}
                        isSubmitting={createMutation.isPending}
                    />
                </div>
            </div>
        </div>
    )
}

export default ObjectTypeEditorPage
