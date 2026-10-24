import CompactSelect from './CompactSelect'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { taxonomyApi } from '../../api/taxonomy'

const inputClass = 'block w-full mt-1'

export default function ClassificationTypeForm({ definition, tenant, busy, onSave }) {
    const [name, setName] = useState(definition?.name || '')
    const [key, setKey] = useState(definition?.key || '')
    const [namespace, setNamespace] = useState(definition?.namespace || '')
    const [description, setDescription] = useState(definition?.description || '')
    const [sortOrder, setSortOrder] = useState(definition?.sortOrder || 0)
    const [uses, setUses] = useState(definition?.allowedUses || [])
    const namespaces = useQuery({ queryKey: ['classification', tenant, 'namespaces'], queryFn: async () => await taxonomyApi.namespaces() })
    const objectTypes = useQuery({ queryKey: ['classification', tenant, 'objectTypes'], queryFn: async () => await taxonomyApi.objectTypes() })
    const choices = [['pages', 'Pages'], ['media_files', 'Media files'], ['media_collections', 'Media collections'],
        ...(objectTypes.data?.results || []).map(type => [`object:${type.id}`, type.label || type.name])]
    return <form className="space-y-4 max-w-xl" onSubmit={event => {
        event.preventDefault()
        onSave({ name, description, sort_order: Number(sortOrder), allowed_uses: uses,
            ...(!definition && { key, namespace: Number(namespace) }) })
    }}>
        <h2 className="text-xl font-semibold">{definition ? 'Configure type' : 'New tag type'}</h2>
        <label className="block"><span className="classification-field-label">Name</span><input placeholder=" " required className={inputClass} data-filled={String(name ?? '').length > 0} value={name} onChange={event => setName(event.target.value)} /></label>
        {!definition && <>
            <label className="block"><span className="classification-field-label">Stable key</span><input placeholder=" " required maxLength={32} pattern="[a-z0-9_-]+" className={inputClass} data-filled={String(key ?? '').length > 0} value={key} onChange={event => setKey(event.target.value)} /></label>
            <label className="block"><span className="classification-field-label">Namespace</span><CompactSelect label="Namespace" required className={inputClass} value={namespace} onChange={event => setNamespace(event.target.value)}>
                <option value="">Choose namespace</option>{(namespaces.data?.results || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </CompactSelect></label>
        </>}
        <label className="block"><span className="classification-field-label">Description</span><textarea placeholder=" " className={inputClass} data-filled={String(description ?? '').length > 0} value={description} onChange={event => setDescription(event.target.value)} /></label>
        <label className="block"><span className="classification-field-label">Sort order</span><input placeholder=" " min={0} required type="number" className={inputClass} data-filled={String(sortOrder ?? '').length > 0} value={sortOrder} onChange={event => setSortOrder(event.target.value)} /></label>
        <fieldset className="space-y-2"><legend className="font-medium mb-2">Allowed uses</legend>{choices.map(([id, label]) => <label key={id} className="flex items-center gap-2 py-1"><input type="checkbox" checked={uses.includes(id)} onChange={event => setUses(event.target.checked ? [...uses, id] : uses.filter(item => item !== id))} />{label}</label>)}</fieldset>
        <button disabled={busy} className="user-tools-primary">Save type</button>
    </form>
}
