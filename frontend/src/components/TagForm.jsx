import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'

const TagForm = ({ tag = null, onSave, onCancel, isLoading = false }) => {
    const [formData, setFormData] = useState({
        name: ''
    })

    const [errors, setErrors] = useState({})
    const [isDirty, setIsDirty] = useState(false)

    // Initialize form data when tag prop changes
    useEffect(() => {
        if (tag) {
            setFormData({
                name: tag.name || ''
            })
        } else {
            setFormData({
                name: ''
            })
        }
        setIsDirty(false)
        setErrors({})
    }, [tag])

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
        setIsDirty(true)

        // Clear field error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: null
            }))
        }
    }

    const validateForm = () => {
        const newErrors = {}

        if (!formData.name.trim()) {
            newErrors.name = 'Tag name is required'
        } else if (formData.name.length > 50) {
            newErrors.name = 'Tag name must be 50 characters or less'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!validateForm()) {
            return
        }

        try {
            await onSave(formData)
        } catch (error) {
            // Handle server-side validation errors
            if (error.response?.data) {
                const serverErrors = {}
                const errorData = error.response.data

                if (errorData.name) {
                    serverErrors.name = Array.isArray(errorData.name) ? errorData.name[0] : errorData.name
                }

                setErrors(serverErrors)
            }
        }
    }

    const handleCancel = () => {
        if (isDirty) {
            if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
                onCancel()
            }
        } else {
            onCancel()
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="text-xl font-semibold text-gray-900" role="heading" aria-level="2">
                        {tag ? 'Edit Tag' : 'Create New Tag'}
                    </div>
                    <button
                        onClick={handleCancel}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={isLoading}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Tag Name */}
                    <div>
                        <label htmlFor="tagName" className="block text-sm font-medium text-gray-700 mb-2">
                            Tag Name *
                        </label>
                        <input
                            id="tagName"
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.name ? 'border-red-300' : 'border-gray-300'
                                }`}
                            placeholder="Enter tag name"
                            disabled={isLoading}
                            maxLength={50}
                        />
                        {errors.name && (
                            <div className="mt-1 text-sm text-red-600 flex items-center">
                                <AlertCircle className="w-4 h-4 mr-1" />
                                {errors.name}
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Preview
                        </label>
                        <div className="flex items-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                {formData.name || 'Tag Name'}
                            </span>
                        </div>
                    </div>
                </form>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 px-6 py-4 border-t bg-gray-50">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !isDirty}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {isLoading ? 'Saving...' : (tag ? 'Update Tag' : 'Create Tag')}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default TagForm