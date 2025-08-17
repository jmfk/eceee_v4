import React, { useEffect, useState } from 'react'
import { pageDataSchemasApi } from '../api'
import VisualSchemaEditor from './VisualSchemaEditor'
import SchemaFormPreview from './SchemaFormPreview'
import ConfirmDialog from './ConfirmDialog'
import { mergeWithDefaults, getSchemaWithoutDefaults, validateFieldName, DEFAULT_SCHEMA_FIELDS } from '../utils/schemaValidation'

export default function SystemSchemaManager() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [validationErrors, setValidationErrors] = useState({})
    // Initial state includes default fields as template for new system schemas
    const [systemForm, setSystemForm] = useState({
        id: null,
        scope: 'system',
        schema: { type: 'object', properties: { ...DEFAULT_SCHEMA_FIELDS } },
        isActive: true,
    })
    const [systemSchema, setSystemSchema] = useState(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const schemasRes = await pageDataSchemasApi.list({ ordering: '-updatedAt' })
                const allSchemas = Array.isArray(schemasRes) ? schemasRes : (schemasRes?.results || [])
                const sys = allSchemas.find((s) => s.scope === 'system') || null
                setSystemSchema(sys)
                if (sys) {
                    // For existing schemas, show only user-defined fields (defaults are merged automatically)
                    setSystemForm({
                        id: sys.id,
                        scope: 'system',
                        schema: getSchemaWithoutDefaults(sys.schema),
                        isActive: sys.isActive,
                    })
                }
                // If no existing schema, the initial state already includes default fields as template
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

    const handleDeleteClick = () => {
        if (!systemSchema || !systemSchema.id) {
            setError('No system schema to delete')
            return
        }
        setShowDeleteConfirm(true)
    }

    const handleDeleteConfirm = async () => {
        setError('')
        try {
            await pageDataSchemasApi.delete(systemSchema.id)
            setSystemSchema(null)
            setSystemForm({
                id: null,
                scope: 'system',
                schema: { type: 'object', properties: { ...DEFAULT_SCHEMA_FIELDS } },
                isActive: true,
            })
            setValidationErrors({})
        } catch (e) {
            const errorMessage = e?.response?.data?.detail || e?.message || 'Delete failed'
            setError(errorMessage)
        }
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
                                {!systemSchema && (
                                    <span className="block mt-2 text-blue-600 font-medium">
                                        The default fields (Meta Title, Page Description, Featured Image) are included as a starting template.
                                    </span>
                                )}
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
                                    {systemSchema && (
                                        <button
                                            onClick={handleDeleteClick}
                                            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
                                            disabled={loading}
                                        >
                                            Delete System Schema
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-md font-medium mb-4">Schema Editor Preview</h3>
                                <div className="bg-white border rounded-lg p-4">
                                    <SchemaFormPreview schema={systemForm.schema} title="Current Schema Fields" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg">{error}</div>}

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setShowDeleteConfirm(false)}
                title="Delete System Schema"
                message="Are you sure you want to delete the system schema? This will permanently remove all system-wide page data fields and cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                confirmButtonStyle="danger"
            />
        </div>
    )
}


