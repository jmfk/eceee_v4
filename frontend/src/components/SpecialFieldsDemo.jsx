import React, { useState } from 'react'
import { DynamicFormRenderer } from './forms'
import { Command, Search, AtSign, TreePine, ArrowLeftRight, Zap } from 'lucide-react'

/**
 * SpecialFieldsDemo Component
 * 
 * Demonstrates the special interactive field types with real-world examples.
 * Shows advanced UI patterns and complex interactions.
 */
const SpecialFieldsDemo = () => {
    const [formData, setFormData] = useState({})
    const [activeExample, setActiveExample] = useState('workflow')

    const examples = {
        workflow: {
            title: 'Workflow Configuration',
            icon: Command,
            description: 'Command palette and workflow automation setup',
            schema: {
                type: 'object',
                properties: {
                    quickAction: {
                        fieldType: 'command_palette',
                        title: 'Quick Action',
                        description: 'Select a quick action to configure'
                    },
                    assignedUser: {
                        fieldType: 'combobox',
                        title: 'Assigned User',
                        description: 'Search and select user (supports creation)'
                    },
                    workflowNotes: {
                        fieldType: 'mentions',
                        title: 'Workflow Notes',
                        description: 'Add notes with @mentions and #topics'
                    }
                },
                required: ['quickAction'],
                propertyOrder: ['quickAction', 'assignedUser', 'workflowNotes']
            }
        },
        organization: {
            title: 'Content Organization',
            icon: TreePine,
            description: 'Hierarchical content organization and categorization',
            schema: {
                type: 'object',
                properties: {
                    category: {
                        fieldType: 'cascader',
                        title: 'Content Category',
                        description: 'Select from hierarchical categories'
                    },
                    permissions: {
                        fieldType: 'transfer',
                        title: 'User Permissions',
                        description: 'Transfer users between available and granted permissions'
                    },
                    relatedTopics: {
                        fieldType: 'combobox',
                        title: 'Related Topics',
                        description: 'Search and link related topics'
                    }
                },
                required: ['category'],
                propertyOrder: ['category', 'permissions', 'relatedTopics']
            }
        },
        collaboration: {
            title: 'Team Collaboration',
            icon: AtSign,
            description: 'Team communication and collaboration tools',
            schema: {
                type: 'object',
                properties: {
                    teamMembers: {
                        fieldType: 'transfer',
                        title: 'Team Members',
                        description: 'Select team members for this project'
                    },
                    discussionNotes: {
                        fieldType: 'mentions',
                        title: 'Discussion Notes',
                        description: 'Team discussion with @mentions and #topics'
                    },
                    primaryContact: {
                        fieldType: 'combobox',
                        title: 'Primary Contact',
                        description: 'Search and select primary contact person'
                    },
                    quickActions: {
                        fieldType: 'command_palette',
                        title: 'Available Actions',
                        description: 'Configure available quick actions for team'
                    }
                },
                required: ['teamMembers', 'primaryContact'],
                propertyOrder: ['teamMembers', 'discussionNotes', 'primaryContact', 'quickActions']
            }
        }
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

    const currentExample = examples[activeExample]

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center justify-center space-x-2">
                    <Zap className="w-6 h-6 text-purple-500" />
                    <span>Special Interactive Fields</span>
                </h2>
                <p className="text-gray-600 max-w-3xl mx-auto">
                    Advanced UI patterns for complex interactions: command palettes, autocomplete with creation,
                    mentions and hashtags, hierarchical selection, and dual listbox transfers.
                </p>
            </div>

            {/* Example Selector */}
            <div className="flex justify-center">
                <div className="flex space-x-4 p-1 bg-gray-100 rounded-lg">
                    {Object.entries(examples).map(([key, example]) => {
                        const Icon = example.icon
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveExample(key)}
                                className={`
                                    flex items-center space-x-2 px-4 py-2 rounded-md transition-colors
                                    ${activeExample === key
                                        ? 'bg-white text-purple-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                    }
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="font-medium">{example.title}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Current Example */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <currentExample.icon className="w-5 h-5 text-purple-600" />
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">{currentExample.title}</h3>
                            <p className="text-sm text-gray-600">{currentExample.description}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 p-6">
                    {/* Form */}
                    <div>
                        <h4 className="text-md font-medium text-gray-900 mb-4">Interactive Form</h4>
                        <DynamicFormRenderer
                            schema={currentExample.schema}
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
                            <pre className="text-sm text-gray-700 overflow-auto max-h-96">
                                {JSON.stringify(formData, null, 2)}
                            </pre>
                        </div>

                        {/* Field Type Info */}
                        <div className="mt-4 space-y-2">
                            <h5 className="text-sm font-medium text-gray-900">Special Field Types:</h5>
                            <div className="space-y-1">
                                {Object.values(currentExample.schema.properties).map((field, index) => (
                                    <div key={index} className="flex items-center space-x-2 text-xs">
                                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                                            {field.fieldType}
                                        </span>
                                        <span className="text-gray-600">{field.title}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Special Features Showcase */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <Command className="w-8 h-8 text-blue-600 mb-2" />
                    <h4 className="font-medium text-blue-900">Command Palette</h4>
                    <p className="text-sm text-blue-700 mt-1">
                        Fuzzy search with keyboard navigation and action categories
                    </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <Search className="w-8 h-8 text-green-600 mb-2" />
                    <h4 className="font-medium text-green-900">Combobox</h4>
                    <p className="text-sm text-green-700 mt-1">
                        Async search with option creation and virtualized lists
                    </p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <AtSign className="w-8 h-8 text-purple-600 mb-2" />
                    <h4 className="font-medium text-purple-900">Mentions</h4>
                    <p className="text-sm text-purple-700 mt-1">
                        @user mentions and #topic hashtags in rich text
                    </p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <TreePine className="w-8 h-8 text-orange-600 mb-2" />
                    <h4 className="font-medium text-orange-900">Tree Select</h4>
                    <p className="text-sm text-orange-700 mt-1">
                        Hierarchical data selection with breadcrumb navigation
                    </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <ArrowLeftRight className="w-8 h-8 text-red-600 mb-2" />
                    <h4 className="font-medium text-red-900">Transfer List</h4>
                    <p className="text-sm text-red-700 mt-1">
                        Dual listbox for moving items between collections
                    </p>
                </div>
            </div>

            {/* Usage Tips */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Tips</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <h4 className="font-medium text-gray-900 mb-2">Keyboard Navigation</h4>
                        <ul className="space-y-1 text-gray-600">
                            <li>• <kbd className="bg-white px-1 rounded">⌘K</kbd> - Open command palette</li>
                            <li>• <kbd className="bg-white px-1 rounded">↑↓</kbd> - Navigate options</li>
                            <li>• <kbd className="bg-white px-1 rounded">Enter</kbd> - Select option</li>
                            <li>• <kbd className="bg-white px-1 rounded">Esc</kbd> - Close dropdown</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-medium text-gray-900 mb-2">Special Interactions</h4>
                        <ul className="space-y-1 text-gray-600">
                            <li>• Type <kbd className="bg-white px-1 rounded">@</kbd> for user mentions</li>
                            <li>• Type <kbd className="bg-white px-1 rounded">#</kbd> for topic hashtags</li>
                            <li>• Click tree nodes to expand/collapse</li>
                            <li>• Drag to transfer items between lists</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}

SpecialFieldsDemo.displayName = 'SpecialFieldsDemo'

export default SpecialFieldsDemo
