import React, { useState } from 'react'
import { ValueListsManager } from './settings'
import { DynamicFormRenderer } from './forms'
import { List, Settings, Eye } from 'lucide-react'

/**
 * ValueListsDemo Component
 * 
 * Demonstrates the value lists feature with management interface and field integration.
 */
const ValueListsDemo = () => {
    const [activeView, setActiveView] = useState('management')
    const [formData, setFormData] = useState({})

    // Sample form that uses value lists
    const sampleSchema = {
        type: 'object',
        properties: {
            country: {
                fieldType: 'choice',
                title: 'Country',
                description: 'Select your country',
                valueListName: 'countries' // References the value list by slug
            },
            priority: {
                fieldType: 'choice',
                title: 'Priority Level',
                description: 'Select priority level',
                valueListName: 'priority-levels' // References the value list by slug
            },
            status: {
                fieldType: 'segmented_control',
                title: 'Status',
                description: 'Current status',
                enum: ['Draft', 'Review', 'Published'] // Static options for comparison
            }
        },
        required: ['country'],
        propertyOrder: ['country', 'priority', 'status']
    }

    const handleFormChange = (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }))
    }

    const handleSubmit = (data) => {
        alert('Form submitted! Check console for data.')
    }

    const views = [
        {
            id: 'management',
            title: 'Value Lists Management',
            icon: Settings,
            description: 'Create and manage value lists'
        },
        {
            id: 'integration',
            title: 'Field Integration',
            icon: Eye,
            description: 'See value lists in action'
        }
    ]

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center justify-center space-x-2">
                    <List className="w-6 h-6 text-green-500" />
                    <span>Value Lists Feature</span>
                </h2>
                <p className="text-gray-600 max-w-3xl mx-auto">
                    Centralized management of dropdown options. Create named value lists that can be
                    reused across multiple form fields, ensuring consistency and easy maintenance.
                </p>
            </div>

            {/* View Selector */}
            <div className="flex justify-center">
                <div className="flex space-x-4 p-1 bg-gray-100 rounded-lg">
                    {views.map((view) => {
                        const Icon = view.icon
                        return (
                            <button
                                key={view.id}
                                onClick={() => setActiveView(view.id)}
                                className={`
                                    flex items-center space-x-2 px-4 py-2 rounded-md transition-colors
                                    ${activeView === view.id
                                        ? 'bg-white text-green-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                    }
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="font-medium">{view.title}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Content */}
            {activeView === 'management' ? (
                <ValueListsManager />
            ) : (
                <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-green-50 px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Field Integration Example</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                This form demonstrates how selection fields can use value lists for their options.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                            {/* Form */}
                            <div>
                                <h4 className="text-md font-medium text-gray-900 mb-4">Sample Form</h4>
                                <DynamicFormRenderer
                                    schema={sampleSchema}
                                    data={formData}
                                    onChange={handleFormChange}
                                    onSubmit={handleSubmit}
                                    submitLabel="Test Submit"
                                />
                            </div>

                            {/* Data Preview */}
                            <div>
                                <h4 className="text-md font-medium text-gray-900 mb-4">Form Data</h4>
                                <div className="bg-gray-50 border border-gray-200 rounded p-4">
                                    <pre className="text-sm text-gray-700 overflow-auto">
                                        {JSON.stringify(formData, null, 2)}
                                    </pre>
                                </div>

                                {/* Value List Info */}
                                <div className="mt-4 space-y-2">
                                    <h5 className="text-sm font-medium text-gray-900">Value List Integration:</h5>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex items-center space-x-2">
                                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                                                country field
                                            </span>
                                            <span className="text-gray-600">→ uses "countries" value list</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                                                priority field
                                            </span>
                                            <span className="text-gray-600">→ uses "priorities" value list</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                status field
                                            </span>
                                            <span className="text-gray-600">→ uses static options</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Benefits */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Value Lists Benefits</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <h4 className="font-medium text-gray-900 mb-2">Centralized Management</h4>
                                <ul className="space-y-1 text-gray-600">
                                    <li>• Single source of truth for dropdown options</li>
                                    <li>• Easy updates across all forms using the list</li>
                                    <li>• Consistent labeling and values</li>
                                    <li>• Version control and audit trail</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900 mb-2">Developer Experience</h4>
                                <ul className="space-y-1 text-gray-600">
                                    <li>• No hardcoded options in form schemas</li>
                                    <li>• Reusable across multiple forms</li>
                                    <li>• Type-safe value handling</li>
                                    <li>• Admin interface for non-technical users</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

ValueListsDemo.displayName = 'ValueListsDemo'

export default ValueListsDemo
