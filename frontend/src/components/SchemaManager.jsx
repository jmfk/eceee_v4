import React, { useEffect, useMemo, useState } from 'react'
import { pageDataSchemasApi } from '../api'

export default function SchemaManager() {
    const [schemas, setSchemas] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [form, setForm] = useState({
        name: '',
        description: '',
        scope: 'system',
        layout_name: '',
        schema: { type: 'object', properties: {} },
        is_active: true,
    })

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

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await pageDataSchemasApi.create(form)
            setForm({ name: '', description: '', scope: 'system', layout_name: '', schema: { type: 'object', properties: {} }, is_active: true })
            fetchSchemas()
        } catch (e) {
            setError(typeof e?.response?.data === 'object' ? JSON.stringify(e.response.data) : (e?.message || 'Create failed'))
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Create Schema</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Name</label>
                        <input className="w-full border rounded px-3 py-2" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
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
                            <input className="w-full border rounded px-3 py-2" value={form.layout_name} onChange={e => setForm(f => ({ ...f, layout_name: e.target.value }))} placeholder="single_column" />
                        </div>
                        <div className="flex items-center space-x-2">
                            <input id="active" type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                            <label htmlFor="active" className="text-sm">Active</label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Schema (JSON)</label>
                        <textarea className="w-full border rounded px-3 py-2 font-mono" rows={10} value={JSON.stringify(form.schema, null, 2)} onChange={e => {
                            try {
                                const parsed = JSON.parse(e.target.value)
                                setForm(f => ({ ...f, schema: parsed }))
                            } catch (err) {
                                // ignore typing errors, will validate on submit
                            }
                        }} />
                    </div>
                    <div>
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Save Schema</button>
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
                                    <div className="font-medium">{s.name}</div>
                                    <div className="text-xs text-gray-500">{s.scope}{s.layout_name ? `:${s.layout_name}` : ''}</div>
                                </div>
                                <div className="text-sm text-gray-600">{s.description}</div>
                                <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(s.schema, null, 2)}</pre>
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


