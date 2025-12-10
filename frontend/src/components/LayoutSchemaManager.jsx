import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { layoutsApi, pageDataSchemasApi } from '../api'
import VisualSchemaEditor from './VisualSchemaEditor'
import SchemaFormPreview from './SchemaFormPreview'
import { validateFieldName } from '../utils/schemaValidation'

export default function LayoutSchemaManager({ fixedLayoutName = null }) {
    const [schemas, setSchemas] = useState([])
    const [layouts, setLayouts] = useState([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [validationErrors, setValidationErrors] = useState({})
    const [saveSuccess, setSaveSuccess] = useState(false)
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
                    schema: existingLayoutSchema ? existingLayoutSchema.schema : { type: 'object', properties: {} },
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
        setSaveSuccess(false)
        const formData = layoutForm
        const errors = validateForm(formData)
        setValidationErrors(errors)
        if (Object.keys(errors).length > 0) return

        setSaving(true)
        try {
            // Save the schema exactly as edited
            const existingSchema = layoutSchemas.find((s) => s.layoutName === formData.layoutName)
            if (existingSchema) {
                await pageDataSchemasApi.update(existingSchema.id, formData)
            } else {
                await pageDataSchemasApi.create(formData)
            }
            setValidationErrors({})
            setSaveSuccess(true)

            // Clear success message after 3 seconds
            setTimeout(() => setSaveSuccess(false), 3000)
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
        } finally {
            setSaving(false)
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
                            <div className="text-lg font-semibold mb-2" role="heading" aria-level="2">Layout Schema Extensions</div>
                            <div className="text-gray-600 text-sm mb-4">
                                Define fields specific to certain layouts. These fields are separate from the system schema and only available for the selected layout.
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Column 1: Layout Selection & Schema Editor */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Layout</label>
                                    {fixedLayoutName ? (
                                        <div className="flex items-center justify-between w-full">
                                            <div className="text-gray-900 font-medium">{fixedLayoutName}</div>
                                            <Link to="/schemas/layout" className="text-blue-600 text-sm hover:underline">
                                                Change
                                            </Link>
                                        </div>
                                    ) : (
                                        <select
                                            className={`w-full border rounded-lg px-3 py-2 ${validationErrors.layoutName ? 'border-red-500' : ''}`}
                                            value={layoutForm.layoutName}
                                            onChange={(e) => {
                                                const newLayoutName = e.target.value
                                                const existingLayoutSchema = layoutSchemas.find((s) => s.layoutName === newLayoutName)
                                                setLayoutForm((prev) => ({
                                                    ...prev,
                                                    layoutName: newLayoutName,
                                                    schema: existingLayoutSchema
                                                        ? existingLayoutSchema.schema
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
                                            <div className="text-md font-medium" role="heading" aria-level="3">Additional Fields for {layoutForm.layoutName}</div>
                                            {layoutSchemas.find((s) => s.layoutName === layoutForm.layoutName) && (
                                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Existing Schema</span>
                                            )}
                                        </div>

                                        <VisualSchemaEditor key={`layout-${layoutForm.layoutName}`} schema={layoutForm.schema} onChange={handleLayoutSchemaChange} />
                                        {validationErrors.schema && <div className="text-red-500 text-sm mt-2">{validationErrors.schema}</div>}

                                        <div className="flex space-x-3 mt-6">
                                            <button
                                                onClick={handleSubmit}
                                                className={`px-6 py-2 rounded-lg transition-colors inline-flex items-center space-x-2 ${saving
                                                        ? 'bg-green-400 cursor-not-allowed'
                                                        : saveSuccess
                                                            ? 'bg-green-600 hover:bg-green-700'
                                                            : 'bg-green-600 hover:bg-green-700'
                                                    } text-white`}
                                                disabled={loading || saving}
                                            >
                                                {saving && (
                                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                                                        <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                )}
                                                {saveSuccess && <span>✓</span>}
                                                <span>
                                                    {saving
                                                        ? 'Saving...'
                                                        : saveSuccess
                                                            ? 'Saved!'
                                                            : (layoutSchemas.find((s) => s.layoutName === layoutForm.layoutName) ? 'Update Layout Schema' : 'Create Layout Schema')
                                                    }
                                                </span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Column 2: Layout Schema Preview */}
                            {layoutForm.layoutName && (
                                <div>
                                    <div className="text-md font-medium mb-4" role="heading" aria-level="3">Layout Schema Preview</div>
                                    <div className="bg-white border rounded-lg p-4">
                                        <SchemaFormPreview
                                            key={`layout-preview-${layoutForm.layoutName}-${Object.keys(layoutForm.schema?.properties || {}).length}`}
                                            schema={layoutForm.schema}
                                            title="Layout Fields Only"
                                        />
                                    </div>
                                </div>
                            )}


                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg">{error}</div>}
        </div>
    )
}


