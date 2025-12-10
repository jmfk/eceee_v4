import React, { useState } from 'react'
import { DynamicFormRenderer } from './forms'
import { Sparkles, Palette, Sliders, Tag, CalendarRange } from 'lucide-react'

/**
 * AdvancedFieldDemo Component
 * 
 * Demonstrates the advanced field types and their capabilities.
 * Shows real-world use cases for each advanced field component.
 */
const AdvancedFieldDemo = () => {
    const [formData, setFormData] = useState({})
    const [activeExample, setActiveExample] = useState('design')

    const examples = {
        design: {
            title: 'Design Configuration',
            icon: Palette,
            description: 'Color and styling configuration form',
            schema: {
                type: 'object',
                properties: {
                    primaryColor: {
                        fieldType: 'color',
                        title: 'Primary Color',
                        description: 'Main brand color for the design'
                    },
                    secondaryColor: {
                        fieldType: 'color',
                        title: 'Secondary Color',
                        description: 'Accent color for highlights'
                    },
                    opacity: {
                        fieldType: 'slider',
                        title: 'Opacity Level',
                        description: 'Background opacity percentage',
                        minimum: 0,
                        maximum: 100
                    },
                    borderRadius: {
                        fieldType: 'slider',
                        title: 'Border Radius',
                        description: 'Corner roundness in pixels',
                        minimum: 0,
                        maximum: 50
                    },
                    designTags: {
                        fieldType: 'tags',
                        title: 'Design Tags',
                        description: 'Tags to categorize this design'
                    }
                },
                required: ['primaryColor'],
                propertyOrder: ['primaryColor', 'secondaryColor', 'opacity', 'borderRadius', 'designTags']
            }
        },
        project: {
            title: 'Project Settings',
            icon: CalendarRange,
            description: 'Project configuration with timeline',
            schema: {
                type: 'object',
                properties: {
                    projectName: {
                        fieldType: 'text',
                        title: 'Project Name',
                        description: 'Name of the project'
                    },
                    timeline: {
                        fieldType: 'date_range',
                        title: 'Project Timeline',
                        description: 'Start and end dates for the project'
                    },
                    priority: {
                        fieldType: 'slider',
                        title: 'Priority Level',
                        description: 'Project priority from 1 (low) to 10 (critical)',
                        minimum: 1,
                        maximum: 10
                    },
                    budget: {
                        fieldType: 'slider',
                        title: 'Budget (thousands)',
                        description: 'Project budget in thousands of dollars',
                        minimum: 0,
                        maximum: 1000
                    },
                    technologies: {
                        fieldType: 'tags',
                        title: 'Technologies',
                        description: 'Technologies used in this project'
                    },
                    statusColor: {
                        fieldType: 'color',
                        title: 'Status Color',
                        description: 'Color to represent project status'
                    }
                },
                required: ['projectName', 'timeline', 'priority'],
                propertyOrder: ['projectName', 'timeline', 'priority', 'budget', 'technologies', 'statusColor']
            }
        },
        content: {
            title: 'Content Management',
            icon: Tag,
            description: 'Content tagging and categorization',
            schema: {
                type: 'object',
                properties: {
                    title: {
                        fieldType: 'text',
                        title: 'Content Title',
                        description: 'Title of the content piece'
                    },
                    categories: {
                        fieldType: 'tags',
                        title: 'Categories',
                        description: 'Content categories for organization'
                    },
                    publishDate: {
                        fieldType: 'date_range',
                        title: 'Publication Period',
                        description: 'When this content should be published'
                    },
                    importance: {
                        fieldType: 'slider',
                        title: 'Content Importance',
                        description: 'How important is this content (1-5)',
                        minimum: 1,
                        maximum: 5
                    },
                    highlightColor: {
                        fieldType: 'color',
                        title: 'Highlight Color',
                        description: 'Color for highlighting this content'
                    }
                },
                required: ['title', 'categories'],
                propertyOrder: ['title', 'categories', 'publishDate', 'importance', 'highlightColor']
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
                <div className="text-2xl font-bold text-gray-900 mb-4 flex items-center justify-center space-x-2" role="heading" aria-level="2">
                    <Sparkles className="w-6 h-6 text-yellow-500" />
                    <span>Advanced Field Types Demo</span>
                </div>
                <div className="text-gray-600 max-w-2xl mx-auto">
                    Explore the advanced field types: color picker, slider, tag input, and date range.
                    These components provide rich UI interactions for complex form requirements.
                </div>
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
                                        ? 'bg-white text-blue-600 shadow-sm'
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
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <currentExample.icon className="w-5 h-5 text-blue-600" />
                        <div>
                            <div className="text-lg font-medium text-gray-900" role="heading" aria-level="3">{currentExample.title}</div>
                            <div className="text-sm text-gray-600">{currentExample.description}</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                    {/* Form */}
                    <div>
                        <div className="text-md font-medium text-gray-900 mb-4" role="heading" aria-level="4">Interactive Form</div>
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
                        <div className="text-md font-medium text-gray-900 mb-4" role="heading" aria-level="4">Form Data</div>
                        <div className="bg-gray-50 border border-gray-200 rounded p-4">
                            <pre className="text-sm text-gray-700 overflow-auto max-h-96">
                                {JSON.stringify(formData, null, 2)}
                            </pre>
                        </div>

                        {/* Field Type Info */}
                        <div className="mt-4 space-y-2">
                            <div className="text-sm font-medium text-gray-900" role="heading" aria-level="5">Field Types Used:</div>
                            <div className="flex flex-wrap gap-2">
                                {Object.values(currentExample.schema.properties).map((field, index) => (
                                    <span
                                        key={index}
                                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                    >
                                        {field.fieldType}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Advanced Features Showcase */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <Palette className="w-8 h-8 text-purple-600 mb-2" />
                    <div className="font-medium text-purple-900" role="heading" aria-level="4">Color Picker</div>
                    <div className="text-sm text-purple-700 mt-1">
                        Advanced color selection with presets, eyedropper, and format support
                    </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <Sliders className="w-8 h-8 text-green-600 mb-2" />
                    <div className="font-medium text-green-900" role="heading" aria-level="4">Range Slider</div>
                    <div className="text-sm text-green-700 mt-1">
                        Interactive range selection with visual feedback and step controls
                    </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <Tag className="w-8 h-8 text-yellow-600 mb-2" />
                    <div className="font-medium text-yellow-900" role="heading" aria-level="4">Tag Input</div>
                    <div className="text-sm text-yellow-700 mt-1">
                        Tag creation and selection with autocomplete and color coding
                    </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <CalendarRange className="w-8 h-8 text-blue-600 mb-2" />
                    <div className="font-medium text-blue-900" role="heading" aria-level="4">Date Range</div>
                    <div className="text-sm text-blue-700 mt-1">
                        Date range selection with presets and validation
                    </div>
                </div>
            </div>
        </div>
    )
}

AdvancedFieldDemo.displayName = 'AdvancedFieldDemo'

export default AdvancedFieldDemo
