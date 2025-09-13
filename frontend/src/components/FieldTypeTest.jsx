import React, { useState, useEffect } from 'react'
import { fieldTypeRegistry } from '../utils/fieldTypeRegistry'
import DynamicFormRenderer from './forms/DynamicFormRenderer'

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
                console.error('Failed to load field types:', err)
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
            age: {
                fieldType: 'number',
                title: 'Age',
                description: 'Enter your age in years'
            },
            isActive: {
                fieldType: 'boolean',
                title: 'Active Status',
                description: 'Are you currently active?'
            },
            country: {
                fieldType: 'choice',
                title: 'Country',
                description: 'Select your country',
                enum: ['USA', 'Canada', 'UK', 'Germany', 'France']
            }
        },
        required: ['name', 'age'],
        propertyOrder: ['name', 'age', 'country', 'isActive']
    }

    const handleFormChange = (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }))
    }

    const handleFormSubmit = (data) => {
        console.log('Form submitted:', data)
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

            {/* Test Form */}
            <div className="border-t pt-8">
                <h3 className="text-xl font-semibold mb-4">Test Form</h3>
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
        </div>
    )
}

export default FieldTypeTest
