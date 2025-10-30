import React, { useState, useEffect } from 'react'
import { fieldTypeRegistry } from '../utils/fieldTypeRegistry'
import DynamicFormRenderer from './forms/DynamicFormRenderer'
import EnhancedWidgetEditorDemo from './EnhancedWidgetEditorDemo'
import { Settings } from 'lucide-react'

/**
 * FieldTypeTest Component
 * 
 * Test component to verify the field type registry and dynamic form renderer work correctly.
 * This can be used for development and testing purposes.
 */
const FieldTypeTest = () => {
    const [fieldTypes, setFieldTypes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [formData, setFormData] = useState({})
    const [showWidgetEditor, setShowWidgetEditor] = useState(false)

    // Load field types on mount
    useEffect(() => {
        const loadFieldTypes = async () => {
            try {
                setLoading(true)
                await fieldTypeRegistry.ensureLoaded()
                const types = fieldTypeRegistry.getAllFieldTypes()
                setFieldTypes(types)
                setError(null)
            } catch (err) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        loadFieldTypes()
    }, [])

    // Sample form schema for testing
    const testSchema = {
        type: 'object',
        properties: {
            name: {
                fieldType: 'text',
                title: 'Full Name',
                description: 'Enter your full name'
            },
            email: {
                fieldType: 'email',
                title: 'Email Address',
                description: 'Enter your email address'
            },
            website: {
                fieldType: 'url',
                title: 'Website',
                description: 'Enter your website URL'
            },
            password: {
                fieldType: 'password',
                title: 'Password',
                description: 'Create a secure password'
            },
            age: {
                fieldType: 'number',
                title: 'Age',
                description: 'Enter your age in years'
            },
            birthDate: {
                fieldType: 'date',
                title: 'Birth Date',
                description: 'Select your birth date'
            },
            appointmentTime: {
                fieldType: 'datetime',
                title: 'Appointment',
                description: 'Select appointment date and time'
            },
            preferredTime: {
                fieldType: 'time',
                title: 'Preferred Time',
                description: 'Select your preferred time'
            },
            bio: {
                fieldType: 'textarea',
                title: 'Biography',
                description: 'Tell us about yourself'
            },
            country: {
                fieldType: 'choice',
                title: 'Country',
                description: 'Select your country',
                enum: ['USA', 'Canada', 'UK', 'Germany', 'France']
            },
            interests: {
                fieldType: 'multi_choice',
                title: 'Interests',
                description: 'Select your interests (multiple)',
                items: { enum: ['Technology', 'Sports', 'Music', 'Art', 'Travel', 'Food'] }
            },
            preferredContact: {
                fieldType: 'choice',
                title: 'Preferred Contact Method',
                description: 'How would you like to be contacted?',
                enum: ['Email', 'Phone', 'SMS', 'Mail']
            },
            isActive: {
                fieldType: 'boolean',
                title: 'Active Status',
                description: 'Are you currently active?'
            },
            favoriteColor: {
                fieldType: 'color',
                title: 'Favorite Color',
                description: 'Pick your favorite color'
            },
            priority: {
                fieldType: 'slider',
                title: 'Priority Level',
                description: 'Set your priority level (1-10)',
                minimum: 1,
                maximum: 10
            },
            skills: {
                fieldType: 'tags',
                title: 'Skills',
                description: 'Add your skills as tags'
            },
            projectDuration: {
                fieldType: 'date_range',
                title: 'Project Duration',
                description: 'Select project start and end dates'
            }
        },
        required: ['name', 'email', 'age'],
        propertyOrder: ['name', 'email', 'website', 'password', 'age', 'birthDate', 'appointmentTime', 'preferredTime', 'bio', 'country', 'interests', 'preferredContact', 'isActive', 'favoriteColor', 'priority', 'skills', 'projectDuration']
    }

    const handleFormChange = (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }))
    }

    const handleFormSubmit = (data) => {
        alert('Form submitted! Check console for data.')
    }

    if (loading) {
        return (
            <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">Field Type Registry Test</h2>
                <p>Loading field types from backend...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">Field Type Registry Test</h2>
                <div className="bg-red-50 border border-red-200 rounded p-4">
                    <p className="text-red-700">Error: {error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Field Type Registry Test</h2>

            {/* Field Types List */}
            <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Available Field Types ({fieldTypes.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fieldTypes.map(fieldType => (
                        <div key={fieldType.key} className="border border-gray-200 rounded p-4 bg-gray-50">
                            <h4 className="font-medium text-gray-900">{fieldType.label}</h4>
                            <p className="text-sm text-gray-600 mt-1">{fieldType.description}</p>
                            <div className="mt-2 text-xs text-gray-500">
                                <div>Component: {fieldType.component}</div>
                                <div>Type: {fieldType.jsonSchemaType}</div>
                                <div>Category: {fieldType.category}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Integration Demos */}
            <div className="border-t pt-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold">Integration Demonstrations</h3>
                    <button
                        onClick={() => setShowWidgetEditor(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                        <span>Widget Editor Demo</span>
                    </button>
                </div>

                <h4 className="text-lg font-medium mb-4">Dynamic Form Test</h4>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <DynamicFormRenderer
                        schema={testSchema}
                        data={formData}
                        onChange={handleFormChange}
                        onSubmit={handleFormSubmit}
                        submitLabel="Test Submit"
                    />
                </div>

                {/* Form Data Display */}
                <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-4">
                    <h4 className="font-medium mb-2">Current Form Data:</h4>
                    <pre className="text-sm text-gray-700 overflow-auto">
                        {JSON.stringify(formData, null, 2)}
                    </pre>
                </div>
            </div>

            {/* Enhanced Widget Editor Demo */}
            {showWidgetEditor && (
                <EnhancedWidgetEditorDemo
                    isOpen={showWidgetEditor}
                    onClose={() => setShowWidgetEditor(false)}
                />
            )}
        </div>
    )
}

export default FieldTypeTest
