import React from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { objectTypesApi } from '../api/objectStorage'
import ObjectTypeForm from '../components/ObjectTypeForm'

const ObjectTypeEditorPage = () => {
    const { id, tab = 'basic' } = useParams()
    const navigate = useNavigate()
    const location = useLocation()

    // Determine if we're creating or editing
    const isCreating = id === 'new'
    const objectTypeId = isCreating ? null : id

    // Fetch object type data if editing
    const { data: objectTypeResponse, isLoading } = useQuery({
        queryKey: ['objectType', objectTypeId],
        queryFn: () => objectTypesApi.get(objectTypeId),
        enabled: !!objectTypeId
    })

    const objectType = objectTypeResponse?.data

    const handleTabChange = (newTab) => {
        const basePath = isCreating ? '/settings/object-types/new' : `/settings/object-types/${id}`
        navigate(`${basePath}/${newTab}`)
    }

    const handleSave = (savedObjectType) => {
        // Navigate back to object types list
        navigate('/settings?tab=object-types')
    }

    const handleCancel = () => {
        // Navigate back to object types list
        navigate('/settings?tab=object-types')
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
                    />
                </div>
            </div>
        </div>
    )
}

export default ObjectTypeEditorPage
