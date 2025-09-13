import React, { useState } from 'react'
import { DynamicFormRenderer } from './forms'
import { Filter, GripVertical, Star, ToggleRight, Calculator, Sparkles } from 'lucide-react'

/**
 * AdvancedUIDemo Component
 * 
 * Demonstrates the advanced UI pattern field types with sophisticated interactions.
 * Shows enterprise-grade UI patterns for complex form requirements.
 */
const AdvancedUIDemo = () => {
    const [formData, setFormData] = useState({})
    const [activeExample, setActiveExample] = useState('filtering')

    const examples = {
        filtering: {
            title: 'Advanced Filtering',
            icon: Filter,
            description: 'Rule builder and search interfaces',
            schema: {
                type: 'object',
                properties: {
                    filterRules: {
                        fieldType: 'rule_builder',
                        title: 'Filter Rules',
                        description: 'Build complex filter conditions'
                    },
                    searchUser: {
                        fieldType: 'combobox',
                        title: 'Search User',
                        description: 'Search for users with autocomplete'
                    },
                    priority: {
                        fieldType: 'rating',
                        title: 'Priority Rating',
                        description: 'Rate the priority level (1-5 stars)'
                    }
                },
                required: ['filterRules'],
                propertyOrder: ['filterRules', 'searchUser', 'priority']
            }
        },
        organization: {
            title: 'Content Organization',
            icon: GripVertical,
            description: 'Sorting and organizing interfaces',
            schema: {
                type: 'object',
                properties: {
                    taskList: {
                        fieldType: 'reorderable_list',
                        title: 'Task Priority Order',
                        description: 'Drag to reorder tasks by priority'
                    },
                    status: {
                        fieldType: 'segmented_control',
                        title: 'Project Status',
                        description: 'Select current project status',
                        enum: ['Planning', 'In Progress', 'Review', 'Complete']
                    },
                    budget: {
                        fieldType: 'numeric_stepper',
                        title: 'Budget Amount',
                        description: 'Set project budget with steppers',
                        minimum: 0,
                        maximum: 1000000,
                        step: 1000
                    }
                },
                required: ['status'],
                propertyOrder: ['taskList', 'status', 'budget']
            }
        },
        evaluation: {
            title: 'Ratings & Feedback',
            icon: Star,
            description: 'Rating and evaluation interfaces',
            schema: {
                type: 'object',
                properties: {
                    overallRating: {
                        fieldType: 'rating',
                        title: 'Overall Rating',
                        description: 'Rate your overall experience'
                    },
                    satisfaction: {
                        fieldType: 'segmented_control',
                        title: 'Satisfaction Level',
                        description: 'How satisfied are you?',
                        enum: ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied']
                    },
                    score: {
                        fieldType: 'numeric_stepper',
                        title: 'Numeric Score',
                        description: 'Enter a numeric score (0-100)',
                        minimum: 0,
                        maximum: 100,
                        step: 5
                    },
                    categories: {
                        fieldType: 'reorderable_list',
                        title: 'Evaluation Categories',
                        description: 'Rank categories by importance'
                    }
                },
                required: ['overallRating'],
                propertyOrder: ['overallRating', 'satisfaction', 'score', 'categories']
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
        console.log('Advanced UI form submitted:', data)
        alert('Form submitted! Check console for data.')
    }

    const currentExample = examples[activeExample]

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center justify-center space-x-2">
                    <Sparkles className="w-6 h-6 text-indigo-500" />
                    <span>Advanced UI Patterns</span>
                </h2>
                <p className="text-gray-600 max-w-3xl mx-auto">
                    Enterprise-grade UI patterns: rule builders, drag-and-drop lists, rating systems,
                    segmented controls, and enhanced numeric inputs with sophisticated interactions.
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
                                        ? 'bg-white text-indigo-600 shadow-sm'
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
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <currentExample.icon className="w-5 h-5 text-indigo-600" />
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
                            <h5 className="text-sm font-medium text-gray-900">Advanced UI Patterns:</h5>
                            <div className="space-y-1">
                                {Object.values(currentExample.schema.properties).map((field, index) => (
                                    <div key={index} className="flex items-center space-x-2 text-xs">
                                        <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full">
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

            {/* Advanced UI Patterns Showcase */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <Filter className="w-8 h-8 text-blue-600 mb-2" />
                    <h4 className="font-medium text-blue-900">Rule Builder</h4>
                    <p className="text-sm text-blue-700 mt-1">
                        Visual query builder with nested AND/OR logic
                    </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <GripVertical className="w-8 h-8 text-green-600 mb-2" />
                    <h4 className="font-medium text-green-900">Reorderable List</h4>
                    <p className="text-sm text-green-700 mt-1">
                        Drag-and-drop sortable lists with add/remove
                    </p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <Star className="w-8 h-8 text-yellow-600 mb-2" />
                    <h4 className="font-medium text-yellow-900">Rating System</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                        Customizable ratings with stars, hearts, or custom icons
                    </p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <ToggleRight className="w-8 h-8 text-purple-600 mb-2" />
                    <h4 className="font-medium text-purple-900">Segmented Control</h4>
                    <p className="text-sm text-purple-700 mt-1">
                        iOS-style toggle groups with multiple variants
                    </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <Calculator className="w-8 h-8 text-red-600 mb-2" />
                    <h4 className="font-medium text-red-900">Numeric Stepper</h4>
                    <p className="text-sm text-red-700 mt-1">
                        Enhanced number input with precision controls
                    </p>
                </div>
            </div>

            {/* Feature Highlights */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Advanced Features</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div>
                        <h4 className="font-medium text-gray-900 mb-2">Interaction Patterns</h4>
                        <ul className="space-y-1 text-gray-600">
                            <li>• Drag-and-drop reordering</li>
                            <li>• Visual rule construction</li>
                            <li>• Multi-thumb range sliders</li>
                            <li>• Interactive rating systems</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-medium text-gray-900 mb-2">Advanced Controls</h4>
                        <ul className="space-y-1 text-gray-600">
                            <li>• Fuzzy search algorithms</li>
                            <li>• Async data loading</li>
                            <li>• Keyboard navigation</li>
                            <li>• Touch-friendly interfaces</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-medium text-gray-900 mb-2">Enterprise Features</h4>
                        <ul className="space-y-1 text-gray-600">
                            <li>• Complex validation rules</li>
                            <li>• Accessibility compliance</li>
                            <li>• Performance optimization</li>
                            <li>• Extensible architecture</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Implementation Stats */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Implementation Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <div className="text-2xl font-bold text-indigo-600">31</div>
                        <div className="text-sm text-gray-600">Field Types</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-green-600">25</div>
                        <div className="text-sm text-gray-600">Components</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-purple-600">5</div>
                        <div className="text-sm text-gray-600">Categories</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-blue-600">6</div>
                        <div className="text-sm text-gray-600">Phases</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

AdvancedUIDemo.displayName = 'AdvancedUIDemo'

export default AdvancedUIDemo
