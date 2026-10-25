import CompactSelect from './CompactSelect'
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { taxonomyApi } from '../../api/taxonomy'

const inputClass = 'block w-full mt-1'

export default function ClassificationTypeForm({ definition, mode = 'new', tenant, namespaceScope, busy, existingTypes = [], onSave, onCancel }) {
    const isEdit = mode === 'edit'
    const [name, setName] = useState(definition?.name || '')
    const [key, setKey] = useState(isEdit ? definition?.key || '' : '')
    const [namespace, setNamespace] = useState(definition?.namespace || '')
    const [description, setDescription] = useState(definition?.description || '')
    const [uses, setUses] = useState(definition?.allowedUses || [])
    const [formError, setFormError] = useState('')
    const namespaces = useQuery({ queryKey: ['classification', tenant, 'namespaces'], queryFn: async () => await taxonomyApi.namespaces() })
    const objectTypes = useQuery({ queryKey: ['classification', tenant, 'objectTypes'], queryFn: async () => await taxonomyApi.objectTypes() })
    const namespaceOptions = (namespaces.data?.results || []).filter(item => !namespaceScope || String(item.id) === String(namespaceScope) || item.slug === namespaceScope)
    const effectiveNamespace = namespaceScope ? namespaceOptions[0]?.id : namespace
    const choices = [['pages', 'Pages'], ['media_files', 'Media files'], ['media_collections', 'Media collections'],
        ...(objectTypes.data?.results || []).map(type => [`object:${type.id}`, type.label || type.name])]
    return <form className="space-y-4 max-w-xl" onSubmit={event => {
        event.preventDefault()
        const duplicate = existingTypes.some(type => type.id !== (isEdit ? definition?.id : null)
            && String(type.namespace) === String(effectiveNamespace)
            && type.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())
        if (duplicate) { setFormError('A tag type with this name already exists in this namespace.'); return }
        setFormError('')
        onSave({ name, description, allowed_uses: uses,
            ...(!isEdit && { key, namespace: Number(effectiveNamespace) }) })
    }}>
        <h2 className="text-xl font-semibold">{mode === 'edit' ? 'Edit tag type' : mode === 'clone' ? 'Clone tag type' : 'New tag type'}</h2>
        {mode === 'clone' && <p className="text-gray-600">Choose a new name and stable key for this copy.</p>}
        {formError && <p role="alert" className="text-red-700">{formError}</p>}
        <label className="block"><span className="classification-field-label">Name</span><input placeholder=" " required className={inputClass} data-filled={String(name ?? '').length > 0} value={name} onChange={event => setName(event.target.value)} /></label>
        {!isEdit && <>
            <label className="block"><span className="classification-field-label">Stable key</span><input placeholder=" " required maxLength={32} pattern="[a-z0-9_-]+" className={inputClass} data-filled={String(key ?? '').length > 0} value={key} onChange={event => setKey(event.target.value)} /></label>
            <label className="block"><span className="classification-field-label">Namespace</span><CompactSelect label="Namespace" required disabled={Boolean(namespaceScope)} className={inputClass} value={effectiveNamespace || ''} onChange={event => setNamespace(event.target.value)}>
                <option value="">Choose namespace</option>{namespaceOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </CompactSelect></label>
        </>}
        <label className="block"><span className="classification-field-label">Description</span><textarea placeholder=" " className={inputClass} data-filled={String(description ?? '').length > 0} value={description} onChange={event => setDescription(event.target.value)} /></label>
        <fieldset className="space-y-2"><legend className="font-medium mb-2">Allowed uses</legend>{choices.map(([id, label]) => <label key={id} className="flex items-center gap-2 py-1"><input type="checkbox" checked={uses.includes(id)} onChange={event => setUses(event.target.checked ? [...uses, id] : uses.filter(item => item !== id))} />{label}</label>)}</fieldset>
        <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || Boolean(namespaceScope && !effectiveNamespace)} className="user-tools-primary">Apply</button>
            <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
    </form>
}
