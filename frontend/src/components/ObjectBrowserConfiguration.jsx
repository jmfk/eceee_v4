import React, { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { objectTypesApi } from '../api/objectStorage'

const textField = field => ['text', 'textarea', 'url', 'email', 'select'].includes(field.componentType || field.field_type || field.type)
    || (!field.componentType && field.type === 'string')
const storedFieldKey = key => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
const controlsFor = kind => kind === 'date' ? [['date_range', 'Date range']]
    : kind === 'boolean' ? [['checklist', 'Yes / no']]
        : kind === 'choice' ? [['searchable_multi', 'Searchable multiselect'], ['checklist', 'Compact multiselect']]
            : [['searchable_multi', 'Searchable multiselect']]

const ObjectBrowserConfiguration = ({ objectType, onDirtyChange }) => {
    const queryClient = useQueryClient()
    const [draft, setDraft] = useState(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [saved, setSaved] = useState(false)
    const { data, isLoading, error: loadError } = useQuery({
        queryKey: ['objectTypeBrowserConfiguration', objectType?.id],
        queryFn: async () => (await objectTypesApi.getBrowserConfiguration(objectType.id)).data,
        enabled: Boolean(objectType?.id),
    })

    useEffect(() => {
        if (data) setDraft({ searchFields: data.config?.searchFields || [], filters: data.config?.filters || [] })
    }, [data])

    useEffect(() => {
        if (!draft || !data) return undefined
        const changed = JSON.stringify(draft) !== JSON.stringify({ searchFields: data.config?.searchFields || [], filters: data.config?.filters || [] })
        onDirtyChange?.(changed)
        if (!changed) return undefined
        const beforeUnload = event => { event.preventDefault(); event.returnValue = '' }
        window.addEventListener('beforeunload', beforeUnload)
        return () => window.removeEventListener('beforeunload', beforeUnload)
    }, [draft, data, onDirtyChange])

    if (!objectType?.id) return <p className="text-xs text-gray-600">Save the Object type before configuring search and filters.</p>
    if (loadError) return <p role="alert" className="text-xs text-red-700">Could not load browser configuration.</p>
    if (isLoading || !draft) return <p className="text-xs text-gray-600">Loading browser configuration…</p>

    const options = data.availableFilters || []
    const fieldNames = Object.entries(objectType.schema?.properties || {})
        .filter(([, field]) => textField(field))
        .map(([key, field]) => [storedFieldKey(key), field])
    const selected = new Map(draft.filters.map((filter, index) => [filter.key, index]))
    const changeSearch = key => setDraft(current => ({
        ...current,
        searchFields: current.searchFields.includes(key)
            ? current.searchFields.filter(item => item !== key)
            : [...current.searchFields, key],
    }))
    const changeFilter = option => setDraft(current => ({
        ...current,
        filters: current.filters.some(item => item.key === option.key)
            ? current.filters.filter(item => item.key !== option.key)
            : [...current.filters, { key: option.key, label: option.label, overview: false, control: controlsFor(option.kind)[0][0] }],
    }))
    const changeEntry = (key, patch) => setDraft(current => ({
        ...current,
        filters: current.filters.map(item => item.key === key ? { ...item, ...patch } : item),
    }))
    const move = (key, direction) => setDraft(current => {
        const filters = [...current.filters]
        const index = filters.findIndex(item => item.key === key)
        const next = index + direction
        if (next < 0 || next >= filters.length) return current
        ;[filters[index], filters[next]] = [filters[next], filters[index]]
        return { ...current, filters }
    })
    const save = async () => {
        setSaving(true); setError(''); setSaved(false)
        try {
            const response = await objectTypesApi.updateBrowserConfiguration(objectType.id, draft)
            queryClient.setQueryData(['objectTypeBrowserConfiguration', objectType.id], previous => ({ ...previous, config: response.data.config }))
            queryClient.invalidateQueries({ queryKey: ['objectTypes'] })
            setSaved(true)
        } catch (value) {
            const details = value.response?.data
            setError(details?.filters || details?.searchFields || details?.detail || 'Could not save search and filters.')
        } finally {
            setSaving(false)
        }
    }

    return <div className="space-y-5 text-xs text-gray-900">
        <div>
            <h2 className="text-lg font-semibold">Search and filters</h2>
            <p className="mt-1 text-gray-600">Title and slug are always searchable. Select additional text fields and filters for this Object type.</p>
        </div>
        <fieldset className="space-y-2">
            <legend className="font-semibold">Searchable fields</legend>
            {fieldNames.length ? fieldNames.map(([key, field]) => <label key={key} className="flex items-center gap-2">
                <input type="checkbox" checked={draft.searchFields.includes(key)} onChange={() => changeSearch(key)} />
                {field.title || key}
            </label>) : <p className="text-gray-500">No text fields are available.</p>}
        </fieldset>
        <fieldset className="space-y-2">
            <legend className="font-semibold">Available filters</legend>
            <p className="text-gray-600">Status is available in every Object list. Overview filters appear after choosing this Object type.</p>
            {options.map(option => {
                const index = selected.get(option.key)
                const entry = index === undefined ? null : draft.filters[index]
                return <div key={option.key} className="rounded border border-gray-200 bg-white px-3 py-2">
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={Boolean(entry)} onChange={() => changeFilter(option)} />
                        <span className="font-medium">{option.label}</span>
                        <span className="text-gray-500">{option.kind}</span>
                    </label>
                    {entry && <div className="mt-2 flex flex-wrap items-center gap-3 pl-5">
                        <label className="flex items-center gap-2">Control
                            <select aria-label={`${option.label} filter control`} value={entry.control || controlsFor(option.kind)[0][0]} onChange={event => changeEntry(option.key, { control: event.target.value })} className="h-8 rounded-sm border border-gray-300 bg-white px-2 text-xs focus:border-blue-600 focus:outline-none">
                                {controlsFor(option.kind).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                        </label>
                        <label className="flex items-center gap-2">Label
                            <input aria-label={`${option.label} filter label`} className="h-8 rounded-sm border border-gray-300 px-2 text-xs focus:border-blue-600 focus:outline-none" value={entry.label} maxLength={80} onChange={event => changeEntry(option.key, { label: event.target.value })} />
                        </label>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={entry.overview} onChange={event => changeEntry(option.key, { overview: event.target.checked })} />Show on overview</label>
                        <button type="button" aria-label={`Move ${option.label} up`} disabled={index === 0} onClick={() => move(option.key, -1)} className="rounded-sm p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"><ArrowUp size={14} /></button>
                        <button type="button" aria-label={`Move ${option.label} down`} disabled={index === draft.filters.length - 1} onClick={() => move(option.key, 1)} className="rounded-sm p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-40"><ArrowDown size={14} /></button>
                    </div>}
                </div>
            })}
        </fieldset>
        {error && <p role="alert" className="text-red-700">{String(error)}</p>}
        {saved && <p role="status" className="text-green-700">Search and filters saved.</p>}
        <button type="button" onClick={save} disabled={saving} className="min-h-8 rounded-sm bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save search and filters'}</button>
    </div>
}

export default ObjectBrowserConfiguration
