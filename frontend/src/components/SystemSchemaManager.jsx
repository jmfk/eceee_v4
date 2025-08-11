import React, { useEffect, useState } from 'react'
import { pageDataSchemasApi } from '../api'
import VisualSchemaEditor from './VisualSchemaEditor'
import SchemaFormPreview from './SchemaFormPreview'

// Default fields that are always present in all schemas
const DEFAULT_SCHEMA_FIELDS = {
    title: {
        type: 'string',
        title: 'Page Title',
        description: 'The main title of this page',
        default: '',
        minLength: 1,
        maxLength: 200,
    },
    description: {
        type: 'string',
        title: 'Page Description',
        description: 'A brief description of this page for SEO and previews',
        format: 'textarea',
        default: '',
        maxLength: 500,
    },
    featured_image: {
        type: 'string',
        title: 'Featured Image URL',
        description: 'URL of the main image for this page',
        format: 'url',
        default: '',
    },
}

const mergeWithDefaults = (schema) => {
    const mergedProperties = { ...DEFAULT_SCHEMA_FIELDS }
    if (schema?.properties) {
        Object.entries(schema.properties).forEach(([key, value]) => {
            if (!DEFAULT_SCHEMA_FIELDS[key]) {
                mergedProperties[key] = value
            }
        })
    }
    return {
        type: 'object',
        properties: mergedProperties,
        required: ['title', ...(schema?.required || []).filter((field) => field !== 'title')],
    }
}

const getSchemaWithoutDefaults = (schema) => {
    if (!schema?.properties) return { type: 'object', properties: {} }
    const userProperties = {}
    Object.entries(schema.properties).forEach(([key, value]) => {
        if (!DEFAULT_SCHEMA_FIELDS[key]) {
            userProperties[key] = value
        }
    })
    return {
        type: 'object',
        properties: userProperties,
        required: (schema.required || []).filter((field) => !DEFAULT_SCHEMA_FIELDS[field]),
    }
}

export default function SystemSchemaManager() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [validationErrors, setValidationErrors] = useState({})
    const [systemForm, setSystemForm] = useState({
        id: null,
        scope: 'system',
        schema: { type: 'object', properties: {} },
        is_active: true,
    })
    const [systemSchema, setSystemSchema] = useState(null)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const schemasRes = await pageDataSchemasApi.list({ ordering: '-updated_at' })
                const allSchemas = Array.isArray(schemasRes) ? schemasRes : (schemasRes?.results || [])
                const sys = allSchemas.find((s) => s.scope === 'system') || null
                setSystemSchema(sys)
                if (sys) {
                    setSystemForm({
                        id: sys.id,
                        scope: 'system',
                        schema: getSchemaWithoutDefaults(sys.schema),
                        is_active: sys.is_active,
                    })
                }
            } catch (e) {
                setError(typeof e?.message === 'string' ? e.message : 'Failed to load data')
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const validateForm = (formData) => {
        const errors = {}
        if (formData.schema?.properties) {
            const invalidKeys = Object.keys(formData.schema.properties).filter(
                (key) => !key || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
            )
            if (invalidKeys.length > 0) {
                errors.schema = `Invalid property keys: ${invalidKeys.join(', ')}. Use letters, numbers, and underscores only.`
            }
        }
        return errors
    }

    const handleSubmit = async () => {
        setError('')
        const formData = systemForm
        const errors = validateForm(formData)
        setValidationErrors(errors)
        if (Object.keys(errors).length > 0) return

        try {
            const cleanFormData = { ...formData }
            cleanFormData.schema = mergeWithDefaults(formData.schema)

            if (formData.id) {
                await pageDataSchemasApi.update(formData.id, cleanFormData)
            } else if (systemSchema) {
                await pageDataSchemasApi.update(systemSchema.id, cleanFormData)
            } else {
                await pageDataSchemasApi.create(cleanFormData)
            }
            setValidationErrors({})
        } catch (e) {
            const errorData = e?.response?.data
            if (typeof errorData === 'object' && errorData) {
                if (errorData.schema) setValidationErrors((prev) => ({ ...prev, schema: errorData.schema[0] }))
                if (!errorData.schema) setError(JSON.stringify(errorData))
            } else {
                setError(e?.message || 'Save failed')
            }
        }
    }

    const handleSystemSchemaChange = (newSchema) => {
        setSystemForm((f) => ({ ...f, schema: newSchema }))
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-lg font-semibold">System Schema</h2>
                                {systemSchema && (
                                    <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">Existing • ID: {systemSchema.id}</span>
                                )}
                            </div>
                            <p className="text-gray-600 text-sm mb-4">
                                Define the base fields that will be available on all pages. These fields are mandatory and cannot be removed by layout schemas.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-md font-medium mb-4">Schema Definition</h3>
                                <VisualSchemaEditor key={`system-${systemForm.id || 'new'}`} schema={systemForm.schema} onChange={handleSystemSchemaChange} />
                                {validationErrors.schema && <div className="text-red-500 text-sm mt-2">{validationErrors.schema}</div>}

                                <div className="flex space-x-3 mt-6">
                                    <button onClick={handleSubmit} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors" disabled={loading}>
                                        {systemSchema ? 'Update System Schema' : 'Create System Schema'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-md font-medium mb-4">Complete Form Preview</h3>
                                <div className="bg-white border rounded-lg p-4">
                                    <div className="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
                                        <strong>Includes:</strong> Default fields + System schema fields
                                    </div>
                                    <SchemaFormPreview schema={mergeWithDefaults(systemForm.schema)} title="Complete Schema Preview" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg">{error}</div>}
        </div>
    )
}


