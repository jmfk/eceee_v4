import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { layoutsApi, pageDataSchemasApi } from '../api'
import VisualSchemaEditor from './VisualSchemaEditor'
import SchemaFormPreview from './SchemaFormPreview'
import { mergeWithDefaults, getSchemaWithoutDefaults, validateFieldName } from '../utils/schemaValidation'

export default function LayoutSchemaManager({ fixedLayoutName = null }) {
    const [schemas, setSchemas] = useState([])
    const [layouts, setLayouts] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [validationErrors, setValidationErrors] = useState({})
    const [layoutForm, setLayoutForm] = useState({
        scope: 'layout',
        layoutName: '',
        schema: { type: 'object', properties: {} },
        isActive: true,
    })

    const fetchData = async () => {
        setLoading(true)
        try {
            const [schemasRes, layoutsRes] = await Promise.all([
                pageDataSchemasApi.list({ ordering: '-updatedAt' }),
                layoutsApi.list({ activeOnly: true }),
            ])
            const allSchemas = Array.isArray(schemasRes) ? schemasRes : (schemasRes?.results || [])
            const allLayouts = Array.isArray(layoutsRes) ? layoutsRes : (layoutsRes?.results || [])
            setSchemas(allSchemas)
            setLayouts(allLayouts)

            if (fixedLayoutName) {
                const existingLayoutSchema = allSchemas.find(
                    (s) => s.scope === 'layout' && s.layoutName === fixedLayoutName
                )
                setLayoutForm((f) => ({
                    ...f,
                    layoutName: fixedLayoutName,
                    schema: existingLayoutSchema ? getSchemaWithoutDefaults(existingLayoutSchema.schema) : { type: 'object', properties: {} },
                    isActive: existingLayoutSchema ? existingLayoutSchema.isActive : true,
                }))
            }
        } catch (e) {
            setError(typeof e?.message === 'string' ? e.message : 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fixedLayoutName])

    const layoutSchemas = useMemo(() => schemas.filter((s) => s.scope === 'layout'), [schemas])
    const systemSchema = useMemo(() => schemas.find((s) => s.scope === 'system') || null, [schemas])

    const validateForm = (formData) => {
        const errors = {}
        if (!formData.layoutName?.trim()) {
            errors.layoutName = 'Layout selection is required'
        }
        if (formData.schema?.properties) {
            const invalidKeys = Object.keys(formData.schema.properties).filter(
                (key) => !key || !validateFieldName(key)
            )
            if (invalidKeys.length > 0) {
                errors.schema = `Invalid property keys: ${invalidKeys.join(', ')}. Use letters, numbers, and underscores only.`
            }
        }
        return errors
    }

    const handleSubmit = async () => {
        setError('')
        const formData = layoutForm
        const errors = validateForm(formData)
        setValidationErrors(errors)
        if (Object.keys(errors).length > 0) return

        try {
            const cleanFormData = { ...formData }
            cleanFormData.schema = mergeWithDefaults(formData.schema)

            const existingSchema = layoutSchemas.find((s) => s.layoutName === formData.layoutName)
            if (existingSchema) {
                await pageDataSchemasApi.update(existingSchema.id, cleanFormData)
            } else {
                await pageDataSchemasApi.create(cleanFormData)
            }
            setValidationErrors({})
            fetchData()
        } catch (e) {
            const errorData = e?.response?.data
            if (typeof errorData === 'object' && errorData) {
                if (errorData.layoutName)
                    setValidationErrors((prev) => ({ ...prev, layoutName: errorData.layoutName[0] }))
                if (errorData.schema) setValidationErrors((prev) => ({ ...prev, schema: errorData.schema[0] }))
                if (!errorData.layoutName && !errorData.schema) setError(JSON.stringify(errorData))
            } else {
                setError(e?.message || 'Save failed')
            }
        }
    }

    const handleLayoutSchemaChange = (newSchema) => {
        setLayoutForm((f) => ({ ...f, schema: newSchema }))
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold mb-2">Layout Schema Extensions</h2>
                            <p className="text-gray-600 text-sm mb-4">
                                Add additional fields specific to certain layouts. These fields extend the system schema and are only available for the selected layout.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Layout</label>
                                    {fixedLayoutName ? (
                                        <div className="flex items-center justify-between w-full max-w-md">
                                            <div className="text-gray-900 font-medium">{fixedLayoutName}</div>
                                            <Link to="/schemas/layout" className="text-blue-600 text-sm hover:underline">
                                                Change
                                            </Link>
                                        </div>
                                    ) : (
                                        <select
                                            className={`w-full max-w-md border rounded-lg px-3 py-2 ${validationErrors.layoutName ? 'border-red-500' : ''}`}
                                            value={layoutForm.layoutName}
                                            onChange={(e) => {
                                                const newLayoutName = e.target.value
                                                const existingLayoutSchema = layoutSchemas.find((s) => s.layoutName === newLayoutName)
                                                setLayoutForm((prev) => ({
                                                    ...prev,
                                                    layoutName: newLayoutName,
                                                    schema: existingLayoutSchema
                                                        ? getSchemaWithoutDefaults(existingLayoutSchema.schema)
                                                        : { type: 'object', properties: {} },
                                                    isActive: existingLayoutSchema ? existingLayoutSchema.isActive : true,
                                                }))
                                                if (validationErrors.layoutName) {
                                                    setValidationErrors((prev) => ({ ...prev, layoutName: '' }))
                                                }
                                            }}
                                        >
                                            <option value="">Select a layout...</option>
                                            {layouts.map((layout) => (
                                                <option key={layout.name} value={layout.name}>
                                                    {layout.name} - {layout.description}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {validationErrors.layoutName && (
                                        <div className="text-red-500 text-sm mt-1">{validationErrors.layoutName}</div>
                                    )}
                                </div>

                                {layoutForm.layoutName && (
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-md font-medium">Additional Fields for {layoutForm.layoutName}</h3>
                                            {layoutSchemas.find((s) => s.layoutName === layoutForm.layoutName) && (
                                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Existing Schema</span>
                                            )}
                                        </div>

                                        <VisualSchemaEditor key={`layout-${layoutForm.layoutName}`} schema={layoutForm.schema} onChange={handleLayoutSchemaChange} />
                                        {validationErrors.schema && <div className="text-red-500 text-sm mt-2">{validationErrors.schema}</div>}

                                        <div className="flex space-x-3 mt-6">
                                            <button onClick={handleSubmit} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors" disabled={loading}>
                                                {layoutSchemas.find((s) => s.layoutName === layoutForm.layoutName) ? 'Update Layout Schema' : 'Create Layout Schema'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div>
                                <h3 className="text-md font-medium mb-4">Complete Form Preview</h3>
                                <div className="bg-white border rounded-lg p-4">
                                    {layoutForm.layoutName ? (
                                        <>
                                            <div className="mb-3 p-2 bg-green-50 rounded text-sm text-green-700">
                                                <strong>Includes:</strong> Default fields + System schema + Layout fields
                                            </div>
                                            <SchemaFormPreview
                                                key={`preview-${layoutForm.layoutName}-${Object.keys(layoutForm.schema?.properties || {}).length}`}
                                                schema={mergeWithDefaults({
                                                    type: 'object',
                                                    properties: {
                                                        ...(systemSchema?.schema?.properties || {}),
                                                        ...(layoutForm.schema?.properties || {}),
                                                    },
                                                })}
                                                title="Complete Schema Preview"
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <div className="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
                                                <strong>Shows:</strong> Default fields + System schema (select layout to see extensions)
                                            </div>
                                            <SchemaFormPreview
                                                key="preview-system-only"
                                                schema={mergeWithDefaults(systemSchema?.schema || { type: 'object', properties: {} })}
                                                title="Complete Schema Preview"
                                            />
                                        </>
                                    )}
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


