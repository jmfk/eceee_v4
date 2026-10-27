import React, { useEffect, useId, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Check, CircleDot, ListFilterPlus, Search, Shapes, SlidersHorizontal, Tag, X } from 'lucide-react'
import { objectInstancesApi } from '../api/objectStorage'
import { datePresets } from './objectDatePresets'

const STATUS_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
]

const ObjectFilterBar = ({ search, onSearchChange, statuses, onStatusesChange, filters, onFiltersChange, objectType, availableFilters = [], overview = false, typeOptions = [], overviewType = '', onOverviewTypeChange }) => {
    const [menuOpen, setMenuOpen] = useState(false)
    const [editing, setEditing] = useState('')
    const [lastDateKey, setLastDateKey] = useState('')
    const [optionSearch, setOptionSearch] = useState('')
    const root = useRef(null)
    const trigger = useRef(null)
    const dateTabsId = useId()
    const configuredFilters = objectType?.browserConfig?.filters || []
    const options = configuredFilters
        .filter(item => !overview || item.overview)
        .map(item => ({ ...availableFilters.find(option => option.key === item.key), ...item }))
        .filter(item => item.kind)
    const dateOptions = options.filter(item => item.kind === 'date')
    const quickOptions = options.filter(item => item.kind !== 'date' && item.quick).slice(0, dateOptions.length ? 2 : 3)
    const remainingOptions = options.filter(item => item.kind !== 'date' && !quickOptions.some(quick => quick.key === item.key))
    const selected = filters.find(item => item.key === editing)
    const option = options.find(item => item.key === editing)
    const control = option?.control || (option?.kind === 'boolean' ? 'checklist' : 'searchable_multi')
    const values = editing === 'status' ? statuses : selected?.values || []
    const { data: choicePage, isFetching } = useQuery({
        queryKey: ['objectFilterOptions', objectType?.name, editing, optionSearch],
        queryFn: async () => (await objectInstancesApi.filterOptions({ type: objectType.name, filter: editing, q: optionSearch })).data,
        enabled: Boolean(objectType && option && option.kind !== 'date' && editing),
    })
    const choices = choicePage?.results || []

    useEffect(() => {
        const outside = event => {
            if (!root.current?.contains(event.target)) { setEditing(''); setMenuOpen(false) }
        }
        document.addEventListener('pointerdown', outside)
        return () => document.removeEventListener('pointerdown', outside)
    }, [])

    const show = (key, button) => {
        if (button) trigger.current = button
        if (dateOptions.some(item => item.key === key)) setLastDateKey(key)
        setMenuOpen(false)
        setEditing(key)
        setOptionSearch('')
    }
    const close = () => { setEditing(''); setMenuOpen(false); trigger.current?.focus() }
    const remove = key => {
        if (key === 'status') onStatusesChange([])
        else if (key === 'type') onOverviewTypeChange('')
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
    const applyPreset = preset => {
        onFiltersChange([...filters.filter(item => item.key !== editing), { key: editing, values: preset.values, preset: preset.label }])
        close()
    }
    const active = [
        ...(overviewType ? [{ key: 'type', label: `Object type: ${typeOptions.find(type => String(type.id) === overviewType)?.pluralLabel || typeOptions.find(type => String(type.id) === overviewType)?.label || overviewType}` }] : []),
        ...(statuses.length && statuses.length < STATUS_OPTIONS.length ? [{ key: 'status', label: `Status: ${statuses.map(value => STATUS_OPTIONS.find(item => item.value === value)?.label).join(', ')}` }] : []),
        ...filters.map(item => {
            const definition = options.find(option => option.key === item.key)
            const valueLabel = definition?.kind === 'date'
                ? item.preset || item.values.filter(Boolean).join(' – ')
                : item.values.map(value => item.labels?.[value] || value).join(', ')
            return { key: item.key, label: `${definition?.label || item.key}: ${valueLabel}` }
        }),
    ]
    const quickIcon = item => item.kind === 'tag' ? Tag : SlidersHorizontal
    const dateMenuOpen = option?.kind === 'date'
    const showDateMenu = button => {
        if (dateMenuOpen) { close(); return }
        const key = dateOptions.some(item => item.key === lastDateKey) ? lastDateKey : dateOptions[0].key
        show(key, button)
    }
    const onDateTabKeyDown = event => {
        const current = dateOptions.findIndex(item => item.key === editing)
        let next = current
        if (event.key === 'ArrowRight') next = (current + 1) % dateOptions.length
        else if (event.key === 'ArrowLeft') next = (current - 1 + dateOptions.length) % dateOptions.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = dateOptions.length - 1
        else return
        event.preventDefault()
        show(dateOptions[next].key)
        event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus()
    }

    return <div ref={root} className="relative z-30 min-w-0 flex-1" onKeyDown={event => {
        if (event.key === 'Escape' && (editing || menuOpen)) { event.stopPropagation(); close() }
    }}>
        <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-sm border border-gray-300 bg-white px-2 py-1 text-xs focus-within:border-blue-600">
            <Search size={16} className="mx-1 shrink-0 text-gray-400" aria-hidden="true" />
            {active.map(item => <span key={item.key} className="inline-flex max-w-52 items-center rounded-sm bg-blue-50 text-blue-800" title={item.label}>
                <button type="button" onClick={event => show(item.key, event.currentTarget)} className="min-w-0 truncate py-1 pl-2 text-left">{item.label}</button>
                <button type="button" aria-label={`Remove ${item.label}`} onClick={() => remove(item.key)} className="rounded-sm p-1 hover:bg-blue-100"><X size={12} aria-hidden="true" /></button>
            </span>)}
            <input aria-label={overview ? 'Search all objects' : `Search ${objectType?.pluralLabel || 'objects'}`} type="search" placeholder="Search objects…" value={search} onChange={event => onSearchChange(event.target.value)} className="min-w-28 flex-1 border-0 bg-transparent py-1 text-xs outline-none placeholder:text-gray-500" />
            {overview && <button type="button" aria-label="Filter by object type" title="Object type" aria-expanded={editing === 'type'} onClick={event => show('type', event.currentTarget)} className={`flex min-h-7 min-w-7 items-center justify-center rounded-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-600 ${overviewType ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}><Shapes size={16} aria-hidden="true" /></button>}
            <button type="button" aria-label="Filter by status" title="Status" aria-expanded={editing === 'status'} onClick={event => show('status', event.currentTarget)} className={`flex min-h-7 min-w-7 items-center justify-center rounded-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-600 ${statuses.length ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}><CircleDot size={16} aria-hidden="true" /></button>
            {dateOptions.length > 0 && <button type="button" aria-label="Filter by date" title="Date filters" aria-expanded={dateMenuOpen} onClick={event => showDateMenu(event.currentTarget)} className={`flex min-h-7 min-w-7 items-center justify-center rounded-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-600 ${dateOptions.some(item => filters.some(filter => filter.key === item.key)) ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}><CalendarDays size={16} aria-hidden="true" /></button>}
            {quickOptions.map(item => {
                const Icon = quickIcon(item)
                return <button key={item.key} type="button" aria-label={`Filter by ${item.label}`} title={item.label} aria-expanded={editing === item.key} onClick={event => show(item.key, event.currentTarget)} className={`flex min-h-7 min-w-7 items-center justify-center rounded-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-600 ${filters.some(filter => filter.key === item.key) ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}><Icon size={16} aria-hidden="true" /></button>
            })}
            {remainingOptions.length > 0 && <button type="button" aria-label="Add filter" title={remainingOptions.length === 1 ? `Filter by ${remainingOptions[0].label}` : 'Add filter'} aria-expanded={menuOpen || (remainingOptions.length === 1 && editing === remainingOptions[0].key)} onClick={event => {
                if (remainingOptions.length === 1) {
                    if (editing === remainingOptions[0].key) close()
                    else show(remainingOptions[0].key, event.currentTarget)
                } else {
                    trigger.current = event.currentTarget
                    setEditing('')
                    setMenuOpen(!menuOpen)
                }
            }} className="flex min-h-7 min-w-7 items-center justify-center rounded-sm text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-600"><ListFilterPlus size={17} aria-hidden="true" /></button>}
        </div>
        {menuOpen && <div className="absolute right-0 top-full z-50 mt-2 w-full max-w-lg rounded-sm border border-gray-200 bg-white p-1 text-xs shadow-lg" role="menu" aria-label="Available Object filters">
            {remainingOptions.map(item => <button key={item.key} type="button" role="menuitem" onClick={() => show(item.key)} className="block w-full rounded-sm px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50">{item.label}</button>)}
        </div>}
        {editing && <div role="dialog" aria-label={dateMenuOpen ? 'Date filters' : `Filter ${editing === 'status' ? 'Status' : editing === 'type' ? 'Object type' : option?.label || editing}`} className="absolute right-0 top-full z-50 mt-2 w-full max-w-lg rounded-sm border border-gray-200 bg-white p-3 text-xs shadow-lg">
            <div className="mb-2 flex items-center justify-between font-semibold"><span>{dateMenuOpen ? 'Dates' : editing === 'status' ? 'Status' : editing === 'type' ? 'Object type' : option?.label}</span><button type="button" aria-label="Close filter" onClick={close} className="rounded-sm p-1 hover:bg-gray-100"><X size={14} /></button></div>
            {dateMenuOpen && dateOptions.length > 1 && <div role="tablist" aria-label="Date fields" onKeyDown={onDateTabKeyDown} className="mb-3 flex gap-4 overflow-x-auto border-b border-gray-200">
                {dateOptions.map((item, index) => <button key={item.key} type="button" role="tab" id={`${dateTabsId}-tab-${index}`} aria-controls={`${dateTabsId}-panel`} aria-selected={editing === item.key} tabIndex={editing === item.key ? 0 : -1} onClick={() => show(item.key)} className={`-mb-px shrink-0 border-b-2 px-1 pb-2 pt-1 text-xs focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-600 ${editing === item.key ? 'border-blue-600 font-semibold text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>{item.label}{filters.some(filter => filter.key === item.key) && <span className="ml-1 text-blue-600" aria-hidden="true">•</span>}</button>)}
            </div>}
            {editing === 'type' ? <div className="max-h-60 overflow-y-auto">
                {typeOptions.length > 8 && <input type="search" aria-label="Find object type" placeholder="Find an object type…" value={optionSearch} onChange={event => setOptionSearch(event.target.value)} className="mb-2 w-full rounded-sm border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-600 focus:outline-none" />}
                {[{ id: '', pluralLabel: 'All object types' }, ...typeOptions].filter(type => !optionSearch || `${type.pluralLabel || type.label}`.toLocaleLowerCase().includes(optionSearch.toLocaleLowerCase())).map(type => <button key={type.id} type="button" onClick={() => { onOverviewTypeChange(String(type.id)); close() }} className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-blue-50"><span>{type.pluralLabel || type.label}</span>{overviewType === String(type.id) && <Check size={13} className="text-blue-600" aria-hidden="true" />}</button>)}
            </div> : dateMenuOpen ? <div id={`${dateTabsId}-panel`} role={dateOptions.length > 1 ? 'tabpanel' : undefined} aria-labelledby={dateOptions.length > 1 ? `${dateTabsId}-tab-${dateOptions.findIndex(item => item.key === editing)}` : undefined} className="space-y-3">
                <div className="grid grid-cols-2 gap-1">
                    {datePresets().map(preset => <button key={preset.label} type="button" onClick={() => applyPreset(preset)} className="rounded-sm px-2 py-1.5 text-left hover:bg-blue-50 focus:bg-blue-50">{preset.label}</button>)}
                </div>
                <div className="border-t border-gray-200 pt-2 font-medium">Custom range</div>
                <label className="flex items-center justify-between gap-2">From<input type="date" value={dateValues[0]} onChange={event => setDate(0, event.target.value)} className="min-w-0 rounded-sm border border-gray-300 px-2 py-1" /></label>
                <label className="flex items-center justify-between gap-2">To<input type="date" value={dateValues[1]} onChange={event => setDate(1, event.target.value)} className="min-w-0 rounded-sm border border-gray-300 px-2 py-1" /></label>
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
