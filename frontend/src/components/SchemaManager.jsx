import React, { useEffect, useMemo, useState } from 'react'
import { pageDataSchemasApi, layoutsApi } from '../api'
import VisualSchemaEditor from './VisualSchemaEditor'

export default function SchemaManager() {
    const [schemas, setSchemas] = useState([])
    const [layouts, setLayouts] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [editingSchema, setEditingSchema] = useState(null)
    const [activeTab, setActiveTab] = useState('system') // 'system' or 'layout'

    const [systemForm, setSystemForm] = useState({
        id: null, // Include ID for updates
        scope: 'system',
        layout_name: '', // Initialize to avoid undefined
        name: '', // Initialize to avoid undefined
        schema: { type: 'object', properties: {} },
        is_active: true,
    })

    const [layoutForm, setLayoutForm] = useState({
        scope: 'layout',
        layout_name: '',
        schema: { type: 'object', properties: {} },
        is_active: true,
    })

    const [validationErrors, setValidationErrors] = useState({})

    const fetchData = async () => {
        setLoading(true)
        try {
            const [schemasRes, layoutsRes] = await Promise.all([
                pageDataSchemasApi.list({ ordering: '-updated_at' }),
                layoutsApi.list({ active_only: true })
            ])

            console.log('Raw API responses:', { schemasRes, layoutsRes })

            // Handle different possible response structures
            let allSchemas = []
            if (Array.isArray(schemasRes)) {
                allSchemas = schemasRes
            } else if (schemasRes?.data) {
                if (Array.isArray(schemasRes.data)) {
                    allSchemas = schemasRes.data
                } else if (schemasRes.data.results && Array.isArray(schemasRes.data.results)) {
                    allSchemas = schemasRes.data.results
                }
            }

            let allLayouts = []
            if (Array.isArray(layoutsRes)) {
                allLayouts = layoutsRes
            } else if (layoutsRes?.data) {
                if (Array.isArray(layoutsRes.data)) {
                    allLayouts = layoutsRes.data
                } else if (layoutsRes.data.results && Array.isArray(layoutsRes.data.results)) {
                    allLayouts = layoutsRes.data.results
                }
            }

            setSchemas(allSchemas)
            setLayouts(allLayouts)

            console.log('Processed schemas:', allSchemas)
            console.log('Looking for system schema...')

            // Auto-populate forms with existing schemas
            const systemSchema = allSchemas.find(s => s.scope === 'system')
            if (systemSchema) {
                console.log('Loading existing system schema:', systemSchema)
                setSystemForm({
                    id: systemSchema.id,
                    scope: 'system',
                    schema: systemSchema.schema || { type: 'object', properties: {} },
                    is_active: systemSchema.is_active,
                })
            } else {
                console.log('No existing system schema found in:', allSchemas)
            }

        } catch (e) {
            setError(typeof e?.message === 'string' ? e.message : 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    // Ensure schemas is always an array
    const schemasArray = Array.isArray(schemas) ? schemas : []

    const validateForm = (formData, isLayout = false) => {
        const errors = {}

        if (isLayout && !formData.layout_name?.trim()) {
            errors.layout_name = 'Layout selection is required'
        }

        // Validate schema has at least one property (for now we'll allow empty schemas)
        if (formData.schema?.properties) {
            const invalidKeys = Object.keys(formData.schema.properties).filter(key =>
                !key || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
            )
            if (invalidKeys.length > 0) {
                errors.schema = `Invalid property keys: ${invalidKeys.join(', ')}. Use letters, numbers, and underscores only.`
            }
        }

        return errors
    }

    const handleSubmit = async (isLayout = false) => {
        setError('')
        const formData = isLayout ? layoutForm : systemForm
        const errors = validateForm(formData, isLayout)

        setValidationErrors(errors)
        if (Object.keys(errors).length > 0) {
            return
        }

                try {
            // Clean up form data for submission
            const cleanFormData = { ...formData }
            
            // For system schemas, remove layout_name and name fields
            if (!isLayout) {
                delete cleanFormData.layout_name
                delete cleanFormData.name
            }
            
            console.log('Submitting schema data:', cleanFormData)
            
            // For system schema, use the ID from the form if available
            if (!isLayout && formData.id) {
                console.log('Updating existing system schema with ID:', formData.id)
                await pageDataSchemasApi.update(formData.id, cleanFormData)
            } else {
                // For layout schemas or new system schema, check if one exists
                const existingSchema = schemasArray.find(s => 
                    isLayout ? (s.scope === 'layout' && s.layout_name === formData.layout_name) 
                             : s.scope === 'system'
                )
                
                if (existingSchema) {
                    console.log('Updating existing schema with ID:', existingSchema.id)
                    await pageDataSchemasApi.update(existingSchema.id, cleanFormData)
                } else {
                    console.log('Creating new schema')
                    await pageDataSchemasApi.create(cleanFormData)
                }
            }

            setValidationErrors({})
            fetchData()
        } catch (e) {
            const errorData = e?.response?.data
            if (typeof errorData === 'object' && errorData) {
                if (errorData.layout_name) setValidationErrors(prev => ({ ...prev, layout_name: errorData.layout_name[0] }))
                if (errorData.schema) setValidationErrors(prev => ({ ...prev, schema: errorData.schema[0] }))

                if (!errorData.layout_name && !errorData.schema) {
                    setError(JSON.stringify(errorData))
                }
            } else {
                setError(e?.message || 'Save failed')
            }
        }
    }

    const handleSystemSchemaChange = (newSchema) => {
        setSystemForm(f => ({ ...f, schema: newSchema }))
    }

    const handleLayoutSchemaChange = (newSchema) => {
        setLayoutForm(f => ({ ...f, schema: newSchema }))
    }

    const systemSchema = schemasArray.find(s => s.scope === 'system')
    const layoutSchemas = schemasArray.filter(s => s.scope === 'layout')

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex">
                        <button
                            onClick={() => setActiveTab('system')}
                            className={`py-4 px-6 border-b-2 font-medium text-sm ${activeTab === 'system'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            System Schema
                            <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                                Base
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('layout')}
                            className={`py-4 px-6 border-b-2 font-medium text-sm ${activeTab === 'layout'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Layout Extensions
                            <span className="ml-2 text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">
                                Optional
                            </span>
                        </button>
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'system' && (
                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-lg font-semibold">System Schema</h2>
                                    {systemSchema && (
                                        <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">
                                            Existing • ID: {systemSchema.id}
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-600 text-sm mb-4">
                                    Define the base fields that will be available on all pages. These fields are mandatory and cannot be removed by layout schemas.
                                </p>
                            </div>

                            <VisualSchemaEditor
                                key={`system-${systemForm.id || 'new'}`}
                                schema={systemForm.schema}
                                onChange={handleSystemSchemaChange}
                            />
                            {validationErrors.schema && (
                                <div className="text-red-500 text-sm mt-2">{validationErrors.schema}</div>
                            )}

                            <div className="flex space-x-3">
                                <button
                                    onClick={() => handleSubmit(false)}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    {systemSchema ? 'Update System Schema' : 'Create System Schema'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'layout' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold mb-2">Layout Schema Extensions</h2>
                                <p className="text-gray-600 text-sm mb-4">
                                    Add additional fields specific to certain layouts. These fields extend the system schema and are only available for the selected layout.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Layout</label>
                                <select
                                    className={`w-full max-w-md border rounded-lg px-3 py-2 ${validationErrors.layout_name ? 'border-red-500' : ''}`}
                                    value={layoutForm.layout_name}
                                    onChange={e => {
                                        const newLayoutName = e.target.value
                                        setLayoutForm(f => ({ ...f, layout_name: newLayoutName }))

                                        // Load existing layout schema if available
                                        const existingLayoutSchema = layoutSchemas.find(s => s.layout_name === newLayoutName)
                                        if (existingLayoutSchema) {
                                            setLayoutForm(f => ({
                                                ...f,
                                                schema: existingLayoutSchema.schema,
                                                is_active: existingLayoutSchema.is_active
                                            }))
                                        } else {
                                            setLayoutForm(f => ({
                                                ...f,
                                                schema: { type: 'object', properties: {} },
                                                is_active: true
                                            }))
                                        }

                                        if (validationErrors.layout_name) {
                                            setValidationErrors(prev => ({ ...prev, layout_name: '' }))
                                        }
                                    }}
                                >
                                    <option value="">Select a layout...</option>
                                    {layouts.map(layout => (
                                        <option key={layout.name} value={layout.name}>
                                            {layout.name} - {layout.description}
                                        </option>
                                    ))}
                                </select>
                                {validationErrors.layout_name && (
                                    <div className="text-red-500 text-sm mt-1">{validationErrors.layout_name}</div>
                                )}
                            </div>

                            {layoutForm.layout_name && (
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-md font-medium">Additional Fields for {layoutForm.layout_name}</h3>
                                        {layoutSchemas.find(s => s.layout_name === layoutForm.layout_name) && (
                                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                                                Existing Schema
                                            </span>
                                        )}
                                    </div>
                                    <VisualSchemaEditor
                                        key={`layout-${layoutForm.layout_name}`}
                                        schema={layoutForm.schema}
                                        onChange={handleLayoutSchemaChange}
                                    />
                                    {validationErrors.schema && (
                                        <div className="text-red-500 text-sm mt-2">{validationErrors.schema}</div>
                                    )}

                                    <div className="flex space-x-3">
                                        <button
                                            onClick={() => handleSubmit(true)}
                                            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                                        >
                                            {layoutSchemas.find(s => s.layout_name === layoutForm.layout_name)
                                                ? 'Update Layout Schema'
                                                : 'Create Layout Schema'}
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Show existing layout schemas */}
                            {layoutSchemas.length > 0 && (
                                <div className="mt-8 pt-6 border-t">
                                    <h3 className="text-md font-medium mb-4">Existing Layout Schemas</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {layoutSchemas.map(schema => (
                                            <div key={schema.id} className="border rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-medium">{schema.layout_name}</h4>
                                                    <span className={`text-xs px-2 py-1 rounded ${schema.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {schema.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {Object.keys(schema.schema?.properties || {}).length} additional field(s)
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg">{error}</div>
            )}
        </div>
    )
}


