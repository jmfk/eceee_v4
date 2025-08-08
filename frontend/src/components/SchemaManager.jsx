import React, { useEffect, useMemo, useState } from 'react'
import { pageDataSchemasApi } from '../api'
import VisualSchemaEditor from './VisualSchemaEditor'

export default function SchemaManager() {
    const [schemas, setSchemas] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [editingSchema, setEditingSchema] = useState(null)
    const [editorMode, setEditorMode] = useState('visual') // 'visual' or 'json'

    const [form, setForm] = useState({
        name: '',
        description: '',
        scope: 'system',
        layout_name: '',
        schema: { type: 'object', properties: {} },
        is_active: true,
    })
    
    const [validationErrors, setValidationErrors] = useState({})

    const fetchSchemas = async () => {
        setLoading(true)
        try {
            const res = await pageDataSchemasApi.list({ ordering: '-updated_at' })
            setSchemas(res?.data?.results || res?.data || res || [])
        } catch (e) {
            setError(typeof e?.message === 'string' ? e.message : 'Failed to load schemas')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchSchemas() }, [])

    const validateForm = () => {
        const errors = {}
        
        if (!form.name.trim()) {
            errors.name = 'Name is required'
        }
        
        if (form.scope === 'layout' && !form.layout_name.trim()) {
            errors.layout_name = 'Layout name is required for layout scope'
        }
        
        // Validate schema has at least one property
        if (!form.schema?.properties || Object.keys(form.schema.properties).length === 0) {
            errors.schema = 'Schema must have at least one property'
        }
        
        // Validate property keys are valid identifiers
        if (form.schema?.properties) {
            const invalidKeys = Object.keys(form.schema.properties).filter(key => 
                !key || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
            )
            if (invalidKeys.length > 0) {
                errors.schema = `Invalid property keys: ${invalidKeys.join(', ')}. Use letters, numbers, and underscores only.`
            }
        }
        
        setValidationErrors(errors)
        return Object.keys(errors).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        
        if (!validateForm()) {
            return
        }
        
        try {
            if (editingSchema) {
                await pageDataSchemasApi.update(editingSchema.id, form)
                setEditingSchema(null)
            } else {
                await pageDataSchemasApi.create(form)
            }
            setForm({ name: '', description: '', scope: 'system', layout_name: '', schema: { type: 'object', properties: {} }, is_active: true })
            setValidationErrors({})
            fetchSchemas()
        } catch (e) {
            const errorData = e?.response?.data
            if (typeof errorData === 'object' && errorData) {
                // Handle field-specific errors
                if (errorData.name) setValidationErrors(prev => ({ ...prev, name: errorData.name[0] }))
                if (errorData.layout_name) setValidationErrors(prev => ({ ...prev, layout_name: errorData.layout_name[0] }))
                if (errorData.schema) setValidationErrors(prev => ({ ...prev, schema: errorData.schema[0] }))
                
                // Show general error if no field-specific errors
                if (!errorData.name && !errorData.layout_name && !errorData.schema) {
                    setError(JSON.stringify(errorData))
                }
            } else {
                setError(e?.message || 'Save failed')
            }
        }
    }

    const handleEdit = (schema) => {
        setEditingSchema(schema)
        setForm({
            name: schema.name,
            description: schema.description,
            scope: schema.scope,
            layout_name: schema.layout_name || '',
            schema: schema.schema,
            is_active: schema.is_active
        })
    }

    const handleCancel = () => {
        setEditingSchema(null)
        setForm({ name: '', description: '', scope: 'system', layout_name: '', schema: { type: 'object', properties: {} }, is_active: true })
        setValidationErrors({})
        setError('')
    }

    const handleSchemaChange = (newSchema) => {
        setForm(f => ({ ...f, schema: newSchema }))
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">
                        {editingSchema ? 'Edit Schema' : 'Create Schema'}
                    </h2>
                    {editingSchema && (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Name</label>
                        <input 
                            className={`w-full border rounded px-3 py-2 ${validationErrors.name ? 'border-red-500' : ''}`} 
                            value={form.name} 
                            onChange={e => {
                                setForm(f => ({ ...f, name: e.target.value }))
                                if (validationErrors.name) {
                                    setValidationErrors(prev => ({ ...prev, name: '' }))
                                }
                            }} 
                            required 
                        />
                        {validationErrors.name && (
                            <div className="text-red-500 text-sm mt-1">{validationErrors.name}</div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Description</label>
                        <input className="w-full border rounded px-3 py-2" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Scope</label>
                            <select className="w-full border rounded px-3 py-2" value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}>
                                <option value="system">System</option>
                                <option value="layout">Layout</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Layout Name (for layout scope)</label>
                            <input 
                                className={`w-full border rounded px-3 py-2 ${validationErrors.layout_name ? 'border-red-500' : ''}`} 
                                value={form.layout_name} 
                                onChange={e => {
                                    setForm(f => ({ ...f, layout_name: e.target.value }))
                                    if (validationErrors.layout_name) {
                                        setValidationErrors(prev => ({ ...prev, layout_name: '' }))
                                    }
                                }} 
                                placeholder="single_column" 
                            />
                            {validationErrors.layout_name && (
                                <div className="text-red-500 text-sm mt-1">{validationErrors.layout_name}</div>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                            <input id="active" type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                            <label htmlFor="active" className="text-sm">Active</label>
                        </div>
                    </div>
                    
                    {/* Visual Schema Editor */}
                    <div>
                        <VisualSchemaEditor
                            schema={form.schema}
                            onChange={handleSchemaChange}
                        />
                        {validationErrors.schema && (
                            <div className="text-red-500 text-sm mt-2">{validationErrors.schema}</div>
                        )}
                    </div>
                    <div className="flex space-x-3">
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                            {editingSchema ? 'Update Schema' : 'Create Schema'}
                        </button>
                        {editingSchema && (
                            <button 
                                type="button" 
                                onClick={handleCancel}
                                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Existing Schemas</h2>
                {loading ? (
                    <div>Loading…</div>
                ) : (
                    <div className="space-y-3">
                        {(schemas?.results || schemas).map((s) => (
                            <div key={s.id} className="border rounded p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="font-medium">{s.name}</div>
                                        <div className="text-sm text-gray-600">{s.description}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {s.scope}{s.layout_name ? `:${s.layout_name}` : ''} 
                                            {s.is_active ? (
                                                <span className="ml-2 text-green-600">• Active</span>
                                            ) : (
                                                <span className="ml-2 text-red-600">• Inactive</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handleEdit(s)}
                                            className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-sm"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </div>
                                <details className="mt-3">
                                    <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                                        View Schema JSON
                                    </summary>
                                    <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(s.schema, null, 2)}</pre>
                                </details>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">{error}</div>
            )}
        </div>
    )
}


