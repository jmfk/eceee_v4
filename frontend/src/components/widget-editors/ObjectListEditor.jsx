import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Database, Hash, Calendar, Eye } from 'lucide-react'
import { objectTypesApi } from '../../api/objectStorage'
import BaseWidgetEditor from './BaseWidgetEditor'

const ObjectListEditor = ({ config, onChange, onConfigChange }) => {
    const [localConfig, setLocalConfig] = useState({
        objectType: '',
        limit: 5,
        orderBy: '-created_at',
        statusFilter: 'published',
        showHierarchy: false,
        displayTemplate: 'card',
        showExcerpt: true,
        excerptField: '',
        excerptLength: 150,
        ...config
    })

    // Fetch available object types
    const { data: typesResponse, isLoading } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.getActive()
    })

    const objectTypes = typesResponse?.data || []

    useEffect(() => {
        onConfigChange?.(localConfig)
    }, [localConfig, onConfigChange])

    const handleConfigChange = (field, value) => {
        setLocalConfig(prev => ({ ...prev, [field]: value }))
    }

    const orderByOptions = [
        { value: '-created_at', label: 'Newest First' },
        { value: 'created_at', label: 'Oldest First' },
        { value: 'title', label: 'Title A-Z' },
        { value: '-title', label: 'Title Z-A' },
        { value: '-publish_date', label: 'Recently Published' },
        { value: 'publish_date', label: 'Earliest Published' }
    ]

    const templateOptions = [
        { value: 'card', label: 'Card Layout' },
        { value: 'list', label: 'List Layout' },
        { value: 'minimal', label: 'Minimal Layout' }
    ]

    return (
        <BaseWidgetEditor
            title="Object List Configuration"
            description="Display a filtered list of objects from the object storage system"
            icon={Database}
        >
            <div className="space-y-4">
                {/* Object Type Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Object Type <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={localConfig.objectType}
                        onChange={(e) => handleConfigChange('objectType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isLoading}
                    >
                        <option value="">Select object type...</option>
                        {objectTypes.map((type) => (
                            <option key={type.name} value={type.name}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Display Options */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Limit
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="50"
                            value={localConfig.limit}
                            onChange={(e) => handleConfigChange('limit', parseInt(e.target.value) || 5)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Order By
                        </label>
                        <select
                            value={localConfig.orderBy}
                            onChange={(e) => handleConfigChange('orderBy', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {orderByOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Status and Template */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status Filter
                        </label>
                        <select
                            value={localConfig.statusFilter}
                            onChange={(e) => handleConfigChange('statusFilter', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">All Statuses</option>
                            <option value="published">Published Only</option>
                            <option value="draft">Drafts Only</option>
                            <option value="archived">Archived Only</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Display Template
                        </label>
                        <select
                            value={localConfig.displayTemplate}
                            onChange={(e) => handleConfigChange('displayTemplate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {templateOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Display Options */}
                <div className="space-y-3">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="showHierarchy"
                            checked={localConfig.showHierarchy}
                            onChange={(e) => handleConfigChange('showHierarchy', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="showHierarchy" className="ml-2 text-sm text-gray-700">
                            Show hierarchical structure
                        </label>
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="showExcerpt"
                            checked={localConfig.showExcerpt}
                            onChange={(e) => handleConfigChange('showExcerpt', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="showExcerpt" className="ml-2 text-sm text-gray-700">
                            Show excerpt
                        </label>
                    </div>
                </div>

                {/* Excerpt Options */}
                {localConfig.showExcerpt && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Excerpt Field
                            </label>
                            <input
                                type="text"
                                value={localConfig.excerptField}
                                onChange={(e) => handleConfigChange('excerptField', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Auto-detect (content, description, etc.)"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Leave blank to auto-detect content field
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Excerpt Length
                            </label>
                            <input
                                type="number"
                                min="50"
                                max="500"
                                value={localConfig.excerptLength}
                                onChange={(e) => handleConfigChange('excerptLength', parseInt(e.target.value) || 150)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                )}

                {/* Preview */}
                {localConfig.objectType && (
                    <div className="border-t pt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <Eye className="h-4 w-4 mr-2" />
                            Preview Configuration
                        </h4>
                        <div className="bg-gray-50 rounded-md p-3 text-sm">
                            <p><strong>Type:</strong> {objectTypes.find(t => t.name === localConfig.objectType)?.label}</p>
                            <p><strong>Limit:</strong> {localConfig.limit} items</p>
                            <p><strong>Order:</strong> {orderByOptions.find(o => o.value === localConfig.orderBy)?.label}</p>
                            <p><strong>Status:</strong> {localConfig.statusFilter}</p>
                            <p><strong>Template:</strong> {templateOptions.find(t => t.value === localConfig.displayTemplate)?.label}</p>
                        </div>
                    </div>
                )}
            </div>
        </BaseWidgetEditor>
    )
}

export default ObjectListEditor
