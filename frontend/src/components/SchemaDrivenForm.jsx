import React, { useEffect, useMemo, useState } from 'react'
import { pageDataSchemasApi } from '../api'

// Minimal JSON Schema -> form renderer (text/number/boolean/select) for top-level properties
export default function SchemaDrivenForm({ pageVersionData, onChange }) {
    const [schema, setSchema] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')



    useEffect(() => {
        let mounted = true
        setLoading(true)
        pageDataSchemasApi.getEffective(pageVersionData?.codeLayout)
            .then((res) => {
                const s = res?.data?.schema || res?.schema || null
                if (mounted) setSchema(s)
            })
            .catch((e) => setError(typeof e?.message === 'string' ? e.message : 'Failed to load schema'))
            .finally(() => setLoading(false))
        return () => { mounted = false }
    }, [pageVersionData?.codeLayout])

    const properties = useMemo(() => {
        if (!schema) return {}
        // If combined via allOf, flatten first object with properties for simple use-cases
        if (schema.allOf && Array.isArray(schema.allOf)) {
            const merged = schema.allOf.reduce((acc, part) => ({
                ...acc,
                ...(part.properties || {}),
            }), {})
            return merged
        }
        return schema.properties || {}
    }, [schema])

    if (loading) {
        return <div className="p-6 bg-white rounded-lg shadow">Loading schema...</div>
    }

    if (error) {
        return <div className="p-6 bg-red-50 border border-red-200 rounded">{error}</div>
    }

    if (!schema) {
        return <div className="p-6 bg-white rounded-lg shadow">No schema configured.</div>
    }

    const renderField = (key, def) => {
        const value = pageVersionData?.pageData?.[key] ?? ''
        const type = Array.isArray(def.type) ? def.type[0] : def.type
        const title = def.title || key
        const description = def.description || ''

        const common = {
            id: `field-${key}`,
            name: key,
            className: 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
            value: value ?? '',
            onChange: (e) => {
                const v = type === 'number' ? Number(e.target.value) : type === 'boolean' ? (e.target.checked) : e.target.value
                onChange?.({ [key]: v })
            }
        }

        if (type === 'boolean') {
            return (
                <div key={key} className="space-y-1">
                    <div className="flex items-center space-x-2">
                        <input type="checkbox" checked={!!value} onChange={(e) => onChange?.({ [key]: e.target.checked })} />
                        <label htmlFor={common.id} className="text-sm font-medium text-gray-700">{title}</label>
                    </div>
                    {description && <p className="text-xs text-gray-500">{description}</p>}
                </div>
            )
        }

        if (def.enum) {
            return (
                <div key={key} className="space-y-1">
                    <label htmlFor={common.id} className="block text-sm font-medium text-gray-700">{title}</label>
                    <select {...common} value={value ?? ''}>
                        <option value="">-- select --</option>
                        {def.enum.map((opt) => (
                            <option key={String(opt)} value={opt}>{String(opt)}</option>
                        ))}
                    </select>
                    {description && <p className="text-xs text-gray-500">{description}</p>}
                </div>
            )
        }

        if (type === 'number' || type === 'integer') {
            return (
                <div key={key} className="space-y-1">
                    <label htmlFor={common.id} className="block text-sm font-medium text-gray-700">{title}</label>
                    <input {...common} type="number" />
                    {description && <p className="text-xs text-gray-500">{description}</p>}
                </div>
            )
        }

        // default: string or others as text
        return (
            <div key={key} className="space-y-1">
                <label htmlFor={common.id} className="block text-sm font-medium text-gray-700">{title}</label>
                {def.format === 'textarea' ? (
                    <textarea {...common} rows={3} />
                ) : (
                    <input {...common} type="text" />
                )}
                {description && <p className="text-xs text-gray-500">{description}</p>}
            </div>
        )
    }

    return (
        <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Page Data</h2>
                    <div className="space-y-4">
                        {Object.entries(properties).map(([key, def]) => renderField(key, def))}
                    </div>
                </div>
            </div>
        </div>
    )
}


