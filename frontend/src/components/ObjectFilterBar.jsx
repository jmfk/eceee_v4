import React, { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ListFilterPlus, Search, X } from 'lucide-react'
import { objectInstancesApi } from '../api/objectStorage'
import CompactSelect from './classification/CompactSelect'

const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'published', label: 'Published' },
]

const ObjectFilterBar = ({ search, onSearchChange, statuses, onStatusesChange, filters, onFiltersChange, objectType, availableFilters = [], overview = false, typeOptions = [], overviewType = '', onOverviewTypeChange }) => {
    const [menuOpen, setMenuOpen] = useState(false)
    const [editing, setEditing] = useState('')
    const [optionSearch, setOptionSearch] = useState('')
    const root = useRef(null)
    const addButton = useRef(null)
    const options = availableFilters.filter(option => {
        const configured = objectType?.browserConfig?.filters?.find(item => item.key === option.key)
        return configured && (!overview || configured.overview)
    })
    const selected = filters.find(item => item.key === editing)
    const option = options.find(item => item.key === editing)
    const control = objectType?.browserConfig?.filters?.find(item => item.key === editing)?.control || (option?.kind === 'boolean' ? 'checklist' : 'searchable_multi')
    const values = editing === 'status' ? statuses : selected?.values || []
    const { data: choicePage, isFetching } = useQuery({
        queryKey: ['objectFilterOptions', objectType?.name, editing, optionSearch],
        queryFn: async () => (await objectInstancesApi.filterOptions({ type: objectType.name, filter: editing, q: optionSearch })).data,
        enabled: Boolean(objectType && option && option.kind !== 'date' && editing),
    })
    const choices = choicePage?.results || []

    useEffect(() => {
        const outside = event => {
            if (!root.current?.contains(event.target) && !event.target.closest('[data-headlessui-portal]')) {
                setEditing(''); setMenuOpen(false)
            }
        }
        document.addEventListener('pointerdown', outside)
        return () => document.removeEventListener('pointerdown', outside)
    }, [])

    const show = key => { setMenuOpen(false); setEditing(key); setOptionSearch('') }
    const remove = key => {
        if (key === 'status') onStatusesChange([])
        else onFiltersChange(filters.filter(item => item.key !== key))
        setEditing('')
    }
    const updateValues = (key, next, label) => {
        if (key === 'status') { onStatusesChange(next); return }
        const existing = filters.filter(item => item.key !== key)
        const labels = { ...(selected?.labels || {}) }
        if (label) labels[label.value] = label.label
        onFiltersChange(next.length ? [...existing, { key, values: next, labels }] : existing)
    }
    const toggleValue = choice => {
        const next = !values.length ? [choice.value] : values.includes(choice.value) ? values.filter(value => value !== choice.value) : [...values, choice.value]
        updateValues(editing, next, choice)
    }
    const dateValues = selected?.values || ['', '']
    const setDate = (index, value) => {
        const next = [...dateValues]
        next[index] = value
        updateValues(editing, next.some(Boolean) ? next : [])
    }
    const active = [
        ...(statuses.length && statuses.length < STATUS_OPTIONS.length ? [{ key: 'status', label: `Status: ${statuses.map(value => STATUS_OPTIONS.find(item => item.value === value)?.label).join(', ')}` }] : []),
        ...filters.map(item => {
            const definition = options.find(option => option.key === item.key)
            const valueLabel = definition?.kind === 'date'
                ? item.values.filter(Boolean).join(' – ')
                : item.values.map(value => item.labels?.[value] || value).join(', ')
            return { key: item.key, label: `${objectType?.browserConfig?.filters?.find(filter => filter.key === item.key)?.label || definition?.label || item.key}: ${valueLabel}` }
        }),
    ]

    return <div ref={root} className="relative min-w-0 flex-1" onKeyDown={event => {
        if (event.key === 'Escape' && (editing || menuOpen)) { setEditing(''); setMenuOpen(false); addButton.current?.focus() }
    }}>
        <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-sm border border-gray-300 bg-white px-3 py-1 text-xs focus-within:border-blue-600">
            <Search size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
            {active.map(item => <span key={item.key} className="inline-flex max-w-52 items-center rounded-sm bg-blue-50 text-blue-800" title={item.label}>
                <button type="button" onClick={() => show(item.key)} className="min-w-0 truncate py-1 pl-2 text-left">{item.label}</button>
                <button type="button" aria-label={`Remove ${item.label}`} onClick={() => remove(item.key)} className="rounded-sm p-1 hover:bg-blue-100"><X size={12} aria-hidden="true" /></button>
            </span>)}
            <input aria-label={overview ? 'Search all objects' : `Search ${objectType?.pluralLabel || 'objects'}`} type="search" placeholder="Search objects…" value={search} onChange={event => onSearchChange(event.target.value)} className="min-w-28 flex-1 border-0 bg-transparent py-1 text-xs outline-none placeholder:text-gray-500" />
            <button ref={addButton} type="button" aria-label="Add filter" aria-expanded={menuOpen} onClick={() => { setEditing(''); setMenuOpen(!menuOpen) }} className="rounded-sm p-1 text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-600"><ListFilterPlus size={17} aria-hidden="true" /></button>
        </div>
        {overview && <div className="mt-2 max-w-52"><CompactSelect label="Object type filter" value={overviewType} onChange={event => onOverviewTypeChange(event.target.value)}>
            <option value="">All Object types</option>
            {typeOptions.map(type => <option key={type.id} value={String(type.id)}>{type.pluralLabel || type.label}</option>)}
        </CompactSelect></div>}
        {menuOpen && <div className="absolute right-0 z-30 mt-1 w-64 rounded-sm border border-gray-200 bg-white p-1 text-xs shadow-lg" role="menu" aria-label="Available Object filters">
            <button type="button" role="menuitem" onClick={() => show('status')} className="block w-full rounded-sm px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50">Status</button>
            {options.map(item => <button key={item.key} type="button" role="menuitem" onClick={() => show(item.key)} className="block w-full rounded-sm px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50">{objectType?.browserConfig?.filters?.find(filter => filter.key === item.key)?.label || item.label}</button>)}
        </div>}
        {editing && <div role="dialog" aria-label={`Filter ${editing === 'status' ? 'Status' : option?.label || editing}`} className="absolute right-0 z-30 mt-1 w-72 rounded-sm border border-gray-200 bg-white p-3 text-xs shadow-lg">
            <div className="mb-2 flex items-center justify-between font-semibold"><span>{editing === 'status' ? 'Status' : objectType?.browserConfig?.filters?.find(filter => filter.key === editing)?.label || option?.label}</span><button type="button" aria-label="Close filter" onClick={() => setEditing('')}><X size={14} /></button></div>
            {option?.kind === 'date' ? <div className="space-y-2">
                <label className="flex items-center justify-between gap-2">From<input type="date" value={dateValues[0]} onChange={event => setDate(0, event.target.value)} className="rounded-sm border border-gray-300 px-2 py-1" /></label>
                <label className="flex items-center justify-between gap-2">To<input type="date" value={dateValues[1]} onChange={event => setDate(1, event.target.value)} className="rounded-sm border border-gray-300 px-2 py-1" /></label>
                <button type="button" onClick={() => remove(editing)} className="text-blue-700 underline">All dates</button>
            </div> : <>
                {editing !== 'status' && (control !== 'checklist' || choicePage?.hasMore || optionSearch) && <input type="search" aria-label="Find filter values" placeholder="Find a value…" value={optionSearch} onChange={event => setOptionSearch(event.target.value)} className="mb-2 w-full rounded-sm border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-600 focus:outline-none" />}
                <div className="max-h-60 space-y-0.5 overflow-y-auto">
                    <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-blue-50"><input type="checkbox" checked={!values.length || (editing === 'status' && values.length === STATUS_OPTIONS.length)} onChange={() => updateValues(editing, [])} />All</label>
                    {(editing === 'status' ? STATUS_OPTIONS : choices).map(choice => <label key={choice.value} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-blue-50">
                        <input type="checkbox" checked={!values.length || values.includes(choice.value)} onChange={() => toggleValue(choice)} />
                        <span className="min-w-0 flex-1 truncate">{choice.label}</span>
                        {values.includes(choice.value) && <Check size={13} className="text-blue-600" aria-hidden="true" />}
                    </label>)}
                    {isFetching && <p className="px-2 py-1 text-gray-500">Loading values…</p>}
                    {!isFetching && editing !== 'status' && !choices.length && <p className="px-2 py-1 text-gray-500">No values found.</p>}
                </div>
            </>}
        </div>}
    </div>
}

export default ObjectFilterBar
