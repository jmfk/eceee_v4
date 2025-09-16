import React, { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { namespacesApi } from '../../api'
import ObjectSchemaForm from '../ObjectSchemaForm'

/**
 * Reusable component for rendering object data form fields
 * Eliminates duplication between single-column and two-column layouts
 */
const ObjectDataForm = ({
    objectType,
    isNewInstance,
    availableTypes,
    formData,
    errors,
    handleInputChange,
    handleDataFieldChange,
    getSchemaFromObjectType
}) => {
    const [namespace, setNamespace] = useState(null)

    // Load namespace for media operations (object type's namespace or default)
    useEffect(() => {
        const loadNamespace = async () => {
            try {
                if (objectType?.namespace?.slug) {
                    // Use the object type's specific namespace
                    setNamespace(objectType.namespace.slug)
                } else {
                    // Fall back to default namespace
                    const defaultNamespace = await namespacesApi.getDefault()
                    setNamespace(defaultNamespace?.slug || null)
                }
            } catch (error) {
                console.error('Failed to load namespace:', error)
                setNamespace(null)
            }
        }

        loadNamespace()
    }, [objectType?.namespace])

    return (
        <>
            {/* Object Type Selection (only for new instances) */}
            {isNewInstance && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Object Type <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={formData.objectTypeId || ''}
                        onChange={(e) => handleInputChange('objectTypeId', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.objectTypeId ? 'border-red-300' : 'border-gray-300'
                            }`}
                    >
                        <option value="">Select object type...</option>
                        {availableTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                    {errors.objectTypeId && (
                        <p className="text-red-600 text-sm mt-1 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            {errors.objectTypeId}
                        </p>
                    )}
                </div>
            )}

            {/* Title - Model Field */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Object Title <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.title ? 'border-red-300' : 'border-gray-300'
                        }`}
                    placeholder="Enter object title..."
                />
                {errors.title && (
                    <p className="text-red-600 text-sm mt-1 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.title}
                    </p>
                )}
                <p className="text-gray-500 text-sm mt-1">
                    This is the object's display title (stored on the object, not in schema data)
                </p>
            </div>

            {/* Dynamic Schema Fields */}
            {objectType && (
                <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-4">
                        {objectType.label} Fields
                    </h4>
                    <ObjectSchemaForm
                        schema={getSchemaFromObjectType(objectType)}
                        data={formData.data || {}}
                        onChange={handleDataFieldChange}
                        namespace={namespace}
                    />
                </div>
            )}
        </>
    )
}

export default ObjectDataForm
