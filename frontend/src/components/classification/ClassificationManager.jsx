import CompactSelect from './CompactSelect'
import React, { useEffect, useId, useRef, useState } from 'react'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { ChevronDown, ListFilterPlus, Search, X } from 'lucide-react'
import './classification.css'
import ClassificationTypeForm from './ClassificationTypeForm'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { taxonomyApi, classificationError } from '../../api/taxonomy'
import { getCurrentTenantId } from '../../utils/tenant'

const inputClass = 'block w-full mt-1'
const buttonClass = 'shrink-0'

function TermTree({ terms, selectedId, onSelect, parent = null, seen = [] }) {
    return <ul className={parent ? 'ml-5' : ''}>
        {terms.filter(term => term.parent === parent || (!parent && term.parent && !terms.some(item => item.id === term.parent))).filter(term => !seen.includes(term.id)).map(term => <li key={term.id}>
            <button type="button" aria-current={term.id === selectedId ? 'true' : undefined} onClick={() => onSelect(term)} className={`${buttonClass} classification-tree-row w-full justify-start break-words text-left ${term.id === selectedId ? 'font-semibold bg-blue-50 text-blue-700' : ''}`}>
                {term.name}{term.status !== 'approved' && <span className="text-xs ml-2">{term.status}</span>}
            </button>
            <TermTree terms={terms} selectedId={selectedId} onSelect={onSelect} parent={term.id} seen={[...seen, term.id]} />
        </li>)}
    </ul>
}

export default function ClassificationManager({ namespace } = {}) {
    const scope = namespace ? { namespace } : {}
    const tenant = getCurrentTenantId()
    const client = useQueryClient()
    const [typeId, setTypeId] = useState('')
    const [legacyTagType, setLegacyTagType] = useState('')
    const [selectedTypeId, setSelectedTypeId] = useState('')
    const [typeMode, setTypeMode] = useState('detail')
    const [typeSearch, setTypeSearch] = useState('')
    const [showEditor, setShowEditor] = useState(false)
    const [filterOpen, setFilterOpen] = useState(false)
    const filterRef = useRef(null)
    const filterButtonRef = useRef(null)
    const filterSelectRef = useRef(null)
    const searchId = useId()
    const typeSearchId = useId()
    const filterId = useId()
    useEffect(() => {
        if (!filterOpen) return
        filterSelectRef.current?.focus()
        const dismiss = event => {
            if (!filterRef.current?.contains(event.target) && !event.target.closest('[data-cms-select-options]')) setFilterOpen(false)
        }
        document.addEventListener('pointerdown', dismiss)
        return () => document.removeEventListener('pointerdown', dismiss)
    }, [filterOpen])
    const [selected, setSelected] = useState(null)
    const [view, setView] = useState('terms')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [proposalPage, setProposalPage] = useState(1)
    const [historyPage, setHistoryPage] = useState(1)
    const [customPermissions, setCustomPermissions] = useState(['use', 'propose'])
    const [action, setAction] = useState('create')
    const [editTypeId, setEditTypeId] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [aliases, setAliases] = useState('')
    const [destination, setDestination] = useState('')
    const [reason, setReason] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [notice, setNotice] = useState('')
    const [undoId, setUndoId] = useState(null)
    const [grantUser, setGrantUser] = useState('')
    const [grantRole, setGrantRole] = useState('proposer')
    const types = useQuery({ queryKey: ['classification', tenant, 'types', namespace], queryFn: async () => {
        let pageNumber = 1
        let response
        const results = []
        do {
            response = await taxonomyApi.types({ ...scope, page: pageNumber, page_size: 200 })
            results.push(...(response.results || []))
            pageNumber += 1
        } while (response.next)
        return { ...response, results }
    } })
    const typeDefinitions = types.data?.results || []
    const selectedType = typeDefinitions.find(type => type.id === selectedTypeId) || typeDefinitions[0]
    const matchingTypes = typeDefinitions.filter(type => `${type.name} ${type.key} ${type.description || ''}`.toLocaleLowerCase().includes(typeSearch.trim().toLocaleLowerCase()))
    const namespaces = useQuery({ queryKey: ['classification', tenant, 'namespaces'], queryFn: async () => await taxonomyApi.namespaces(), enabled: view === 'types' })
    const objectTypes = useQuery({ queryKey: ['classification', tenant, 'objectTypes'], queryFn: async () => await taxonomyApi.objectTypes(), enabled: view === 'types' })
    const useLabels = { pages: 'Pages', media_files: 'Media files', media_collections: 'Media collections' }
    for (const item of objectTypes.data?.results || []) useLabels[`object:${item.id}`] = item.label || item.name
    const hasTypes = (types.data?.results || []).length > 0
    const setupPending = types.isSuccess && !hasTypes
    const legacyTypes = useQuery({ queryKey: ['classification', tenant, 'legacyTypes', namespace], queryFn: async () => await taxonomyApi.legacyTypes(scope), enabled: setupPending })
    const definition = types.data?.results?.find(type => type.id === typeId)
    const permissions = definition?.permissions || []
    const terms = useQuery({ queryKey: ['classification', tenant, 'terms', namespace, typeId, legacyTagType, search, page], queryFn: async () => await taxonomyApi.terms({ ...scope, classification_type: typeId, tag_type: legacyTagType, search, page, page_size: 50, ordering: 'name' }), enabled: view === 'terms' || !!typeId || (setupPending && ['terms', 'history'].includes(view)) })
    const proposals = useQuery({ queryKey: ['classification', tenant, 'proposals', namespace, proposalPage], queryFn: async () => await taxonomyApi.proposals({ ...scope, page: proposalPage }), enabled: view === 'proposals' })
    const history = useQuery({ queryKey: ['classification', tenant, 'history', namespace, typeId, historyPage], queryFn: async () => await taxonomyApi.history({ ...scope, classification_type: typeId, page: historyPage }), enabled: view === 'history' && !!typeId })
    const grants = useQuery({ queryKey: ['classification', tenant, 'grants', typeId], queryFn: async () => await taxonomyApi.grants(typeId), enabled: view === 'rights' && permissions.includes('administer') })
    const usage = useQuery({ queryKey: ['classification', tenant, 'usage', selected?.id], queryFn: async () => await taxonomyApi.usage(selected.id), enabled: !!selected })
    const members = useQuery({ queryKey: ['classification', tenant, 'members', typeId], queryFn: async () => await taxonomyApi.members(typeId), enabled: view === 'rights' && permissions.includes('administer') })
    const refresh = () => client.invalidateQueries({ queryKey: ['classification', tenant] })
    const run = async operation => {
        setBusy(true); setError(''); setNotice('')
        try { await operation(); await refresh() } catch (failure) { setError(classificationError(failure)) } finally { setBusy(false) }
    }
    const choose = term => {
        setShowEditor(true); setPage(1)
        if (term.classificationType) setTypeId(term.classificationType)
        setSelected(term); setAction(null); setName(term.name); setDescription(term.description || '')
        setEditTypeId(term.classificationType || '')
        setAliases((term.alternativeNames || []).join('\n')); setDestination(''); setError('')
    }
    const startAction = nextAction => {
        setAction(nextAction); setName(selected.name); setDescription(selected.description || '')
        setEditTypeId(selected.classificationType || '')
        setAliases((selected.alternativeNames || []).join('\n')); setDestination(''); setError('')
    }
    const cancelAction = () => {
        if (!selected) { setShowEditor(false); setAction('create'); return }
        setAction(null); setName(selected.name); setDescription(selected.description || '')
        setEditTypeId(selected.classificationType || '')
        setAliases((selected.alternativeNames || []).join('\n')); setDestination(''); setError('')
    }
    const save = event => {
        event.preventDefault()
        run(async () => {
            let payload = {}
            if (action === 'create' || action === 'edit') payload = { name, description, alternative_names: aliases.split('\n').map(item => item.trim()).filter(Boolean) }
            if (action === 'move') payload = { parent_id: destination || null }
            if (action === 'merge') {
                const target = (terms.data?.results || []).find(term => term.id === destination)
                payload = { target_id: destination, target_revision: target?.revision }
            }
            const changingType = action === 'edit' && selected && editTypeId !== selected.classificationType
            if (permissions.includes(action === 'reactivate' ? 'restore' : action)) {
                const result = changingType ? await taxonomyApi.changeType(selected, editTypeId, payload)
                    : action === 'create' ? await taxonomyApi.create(typeId, payload) : await taxonomyApi.change(selected, action, payload)
                setUndoId(changingType ? null : result.operation?.id || result.id); setNotice('Tag saved.')
                setShowEditor(false); setSelected(null); setAction('create'); setName(''); setDescription(''); setAliases('')
            } else {
                await taxonomyApi.propose(typeId, action, payload, selected)
                setNotice('Proposal submitted. It will take effect after approval.')
                if (selected) setAction(null)
            }
        })
    }
    const roles = {
        user: ['use'], proposer: ['use', 'propose'],
        steward: ['use', 'propose', 'create', 'edit', 'move', 'merge', 'archive', 'restore', 'approve'],
        administrator: ['administer'],
    }
    const selectType = value => {
        setTypeId(value); setSelected(null); setShowEditor(false); setAction('create'); setPage(1); setHistoryPage(1)
        setName(''); setDescription(''); setAliases(''); setFilterOpen(false)
    }
    const filterOptions = hasTypes ? typeDefinitions : (legacyTypes.data || []).map(key => ({ id: key, name: key }))
    const activeFilter = hasTypes ? definition : filterOptions.find(type => type.id === legacyTagType)
    const visibleTerms = terms.data?.results || []
    const showTypeColumn = !typeId && new Set(visibleTerms.map(term => term.classificationType)).size > 1
    const termActions = (selected?.status === 'archived' ? ['reactivate'] : selected?.status === 'approved' ? ['edit', 'move', 'merge', 'archive'] : [])
        .filter(item => permissions.includes(item === 'reactivate' ? 'restore' : item) || (item !== 'reactivate' && permissions.includes('propose')))
    const canChangeType = action === 'edit' && selected && editTypeId !== selected.classificationType
    const targetType = typeDefinitions.find(type => type.id === editTypeId)
    return <div className="classification-manager user-tools-content min-w-0 space-y-4 text-gray-900" aria-busy={busy}>
        <nav aria-label="Tag views" className="classification-tabs">
            {['terms', 'types', 'proposals', 'history', ...(permissions.includes('administer') ? ['rights'] : [])].map(item => <button type="button" key={item} className={buttonClass} aria-pressed={view === item} aria-current={view === item ? 'page' : undefined} onClick={() => { setView(item); setError(''); if (item === 'types') setTypeMode('detail') }}>{({ terms: 'Tags', types: 'Types', proposals: 'Proposals', history: 'History', rights: 'Rights' })[item]}</button>)}
        </nav>
        {types.isPending && <p role="status">Loading tag types…</p>}
        {types.error && <p role="alert">{classificationError(types.error)}</p>}
        {view === 'terms' && types.isSuccess && <div className="classification-search-wrap" ref={filterRef}
            onKeyDown={event => { if (event.key === 'Escape' && filterOpen) { setFilterOpen(false); filterButtonRef.current?.focus() } }}>
            <div className="classification-search" data-filled={Boolean(search || activeFilter)}>
                <label className="classification-search-label" htmlFor={searchId}>Search tags</label>
                <div className="classification-search-content">
                    <Search size={16} aria-hidden="true" className="shrink-0 text-gray-400" />
                    {activeFilter && <button type="button" className="classification-filter-pill" aria-label={`Remove type filter: ${activeFilter.name}`} onClick={() => { if (hasTypes) selectType(''); else { setLegacyTagType(''); setPage(1) } }}>
                        {activeFilter.name}<X size={12} aria-hidden="true" />
                    </button>}
                    <input id={searchId} type="search" placeholder=" " data-filled={String(search ?? '').length > 0} value={search}
                        onChange={event => { setSearch(event.target.value); setPage(1) }} />
                    <button ref={filterButtonRef} type="button" className="classification-icon" title="Add filter" aria-label="Add filter"
                        aria-expanded={filterOpen} aria-controls={filterId} onClick={() => setFilterOpen(!filterOpen)}>
                        <ListFilterPlus size={18} aria-hidden="true" />
                    </button>
                </div>
            </div>
            {filterOpen && <div id={filterId} role="dialog" aria-label="Add tag filter" className="classification-filter-menu">
                <label className="classification-field"><span>Tag type</span>
                    <CompactSelect label="Tag type" ref={filterSelectRef} value={hasTypes ? typeId : legacyTagType} onChange={event => { if (hasTypes) selectType(event.target.value); else { setLegacyTagType(event.target.value); setPage(1); setFilterOpen(false) } filterButtonRef.current?.focus() }}>
                        <option value="">All types</option>{filterOptions.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                    </CompactSelect>
                    {!hasTypes && legacyTypes.isPending && <p role="status">Loading tag types…</p>}
                    {!hasTypes && legacyTypes.error && <p role="alert">{classificationError(legacyTypes.error)}</p>}
                </label>
            </div>}
        </div>}
        {hasTypes && view === 'history' && <label className="classification-field max-w-sm"><span>Tag type</span>
            <CompactSelect label="Tag type" className={inputClass} value={typeId} onChange={event => selectType(event.target.value)}>
                <option value="">Choose a type</option>{typeDefinitions.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </CompactSelect>
        </label>}
        {!types.isPending && !types.error && ((view === 'terms' && !showEditor) || (view === 'history' && !definition)) && <div className="space-y-3">
            {hasTypes ? (view === 'history' ? <p className="text-gray-600">Choose a tag type to view its history.</p> : <section aria-label="Tag list" className="space-y-2">
                {terms.isPending && <p role="status">Loading tags…</p>}
                {terms.error && <p role="alert">{classificationError(terms.error)}</p>}
                {terms.isSuccess && <>
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">{terms.data.count ?? terms.data.results?.length ?? 0} tags</p>
                        <button type="button" onClick={() => { setTypeId(typeId || types.data.results[0].id); setShowEditor(true); setSelected(null); setAction('create'); setName(''); setDescription(''); setAliases('') }}>New tag</button>
                    </div>
                    {(terms.data.results || []).length ? <ul className="divide-y divide-gray-200">
                        {terms.data.results.map(term => <li key={term.id}>
                            <button type="button" onClick={() => choose(term)} className="classification-row">
                                <span className="min-w-0"><span className="block font-semibold break-words">{term.name}</span>
                                    {term.description && <span className="mt-1 block text-sm text-gray-500 break-words">{term.description}</span>}
                                </span>
                                {(showTypeColumn || term.status !== 'approved') && <span className="shrink-0 text-xs text-gray-500">{showTypeColumn && types.data.results.find(type => type.id === term.classificationType)?.name}{term.status !== 'approved' && <span className="ml-2">{term.status}</span>}</span>}
                            </button>
                        </li>)}
                    </ul> : <p>{search ? 'No tags match your search.' : 'No tags yet. Choose a type to add a tag.'}</p>}
                    <div className="flex gap-3">
                        {page > 1 && <button type="button" onClick={() => setPage(page - 1)}>Previous tags</button>}
                        {terms.data.next && <button type="button" onClick={() => setPage(page + 1)}>Next tags</button>}
                    </div>
                </>}
            </section>) : <>
                {terms.isPending && <p role="status">Checking existing tags…</p>}
                {terms.error && <p role="alert">{classificationError(terms.error)}</p>}
                {terms.isSuccess && ((terms.data?.results || []).length > 0 || search || legacyTagType || page > 1 ? <section aria-label="Existing tags" className="space-y-4">
                    <div>
                        <h2 className="text-xl font-semibold">Existing tags</h2>
                        <p className="mt-2 text-gray-600">Tag setup is incomplete. A workspace owner needs to finish the migration before these tags can be edited here.</p>
                    </div>
                    <p className="text-xs text-gray-500">{terms.data.count ?? terms.data.results?.length ?? 0} tags</p>
                    {!terms.data.results?.length && <p>No matching tags.</p>}
                    <ul className="divide-y divide-gray-200">
                        {terms.data.results.map(term => <li key={term.id} className="py-3">
                            <p className="font-medium break-words">{term.name}</p>
                            {term.description && <p className="mt-1 text-gray-600 break-words">{term.description}</p>}
                        </li>)}
                    </ul>
                    <div className="flex gap-3">
                        {page > 1 && <button type="button" onClick={() => setPage(page - 1)}>Previous tags</button>}
                        {terms.data.next && <button type="button" onClick={() => setPage(page + 1)}>Next tags</button>}
                    </div>
                </section> : <>
                    <p className="text-gray-600">No tag types yet. Add a type to start organizing your tags.</p>
                    <button type="button" className="user-tools-primary" onClick={() => { setView('types'); setTypeMode('new') }}>Add tag type</button>
                </>)}
            </>}
        </div>}
        {notice && <p role="status" className="text-green-700">{notice} {undoId && <button type="button" disabled={busy} className="underline px-2 py-1" onClick={() => run(async () => { await taxonomyApi.undo(undoId); setUndoId(null); setNotice('Change undone.'); setSelected(null) })}>Undo</button>}</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {view === 'types' && !types.isPending && !types.error && <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,1fr)_2fr] gap-8">
            <section aria-label="Tag types" className="min-w-0 space-y-3">
                <div className="classification-search" data-filled={Boolean(typeSearch)}>
                    <label className="classification-search-label" htmlFor={typeSearchId}>Search types</label>
                    <div className="classification-search-content">
                        <Search size={16} aria-hidden="true" className="shrink-0 text-gray-400" />
                        <input id={typeSearchId} type="search" placeholder=" " data-filled={Boolean(typeSearch)} value={typeSearch} onChange={event => setTypeSearch(event.target.value)} />
                    </div>
                </div>
                <button type="button" className="user-tools-primary" onClick={() => setTypeMode('new')}>New type</button>
                {matchingTypes.length ? <ul className="divide-y divide-gray-200">
                    {matchingTypes.map(type => <li key={type.id}>
                        <button type="button" className="classification-row" aria-current={typeMode !== 'new' && type.id === selectedType?.id ? 'true' : undefined}
                            onClick={() => { setSelectedTypeId(type.id); setTypeMode('detail'); setError('') }}>
                            <span className="min-w-0 font-semibold break-words">{type.name}</span>
                        </button>
                    </li>)}
                </ul> : <p className="text-gray-600">{typeSearch ? 'No types match your search.' : 'No tag types yet.'}</p>}
            </section>
            <section aria-label="Tag type details" className="min-w-0 space-y-5">
                {typeMode === 'detail' && selectedType && <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <h2 className="text-xl font-semibold">{selectedType.name}</h2>
                        <div className="flex gap-2">
                            {selectedType.permissions?.includes('administer') && <button type="button" onClick={() => setTypeMode('edit')}>Edit</button>}
                            <button type="button" onClick={() => setTypeMode('clone')}>Clone</button>
                        </div>
                    </div>
                    <dl className="classification-tag-details">
                        <div><dt>Stable key</dt><dd className="break-words">{selectedType.key}</dd></div>
                        <div><dt>Namespace</dt><dd>{(namespaces.data?.results || []).find(item => String(item.id) === String(selectedType.namespace))?.name || selectedType.namespace}</dd></div>
                        <div><dt>Description</dt><dd className="whitespace-pre-wrap break-words">{selectedType.description || '—'}</dd></div>
                        <div><dt>Allowed uses</dt><dd>{selectedType.allowedUses?.length ? selectedType.allowedUses.map(use => useLabels[use] || use).join(', ') : '—'}</dd></div>
                    </dl>
                </>}
                {typeMode === 'detail' && !selectedType && <p className="text-gray-600">Select New type to create your first tag type.</p>}
                {typeMode !== 'detail' && <ClassificationTypeForm key={`${typeMode}-${selectedType?.id || 'new'}`} mode={typeMode}
                    definition={typeMode === 'new' ? null : selectedType} tenant={tenant} namespaceScope={namespace} busy={busy} existingTypes={typeDefinitions}
                    onCancel={() => { setTypeMode('detail'); setError('') }}
                    onSave={values => run(async () => {
                        const result = typeMode === 'edit' ? await taxonomyApi.configure(selectedType, values) : await taxonomyApi.createType(values)
                        if (result?.id) setSelectedTypeId(result.id)
                        setTypeMode('detail'); setNotice('Tag type saved.')
                    })} />}
            </section>
        </div>}
        {view === 'terms' && definition && showEditor && <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,1fr)_2fr] gap-8">
            <section aria-label="Tag tree" className="min-w-0 space-y-3">
                <button type="button" onClick={() => { setShowEditor(false); setSelected(null) }}>Back to tags</button>
                {terms.isPending && <p role="status">Loading tags…</p>}
                {terms.error && <p role="alert">{classificationError(terms.error)}</p>}
                {terms.data?.count === 0 && <p>No tags yet. Use the form to add your first tag.</p>}
                <TermTree terms={terms.data?.results || []} selectedId={selected?.id} onSelect={choose} />
                <div className="flex gap-4">{page > 1 && <button type="button" onClick={() => setPage(page - 1)}>Previous</button>}{terms.data?.next && <button type="button" onClick={() => setPage(page + 1)}>Next</button>}</div>
                <button type="button" className={buttonClass} onClick={() => { setSelected(null); setAction('create'); setName(''); setDescription(''); setAliases('') }}>New tag</button>
            </section>
            <section className="min-w-0 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold">{selected?.name || 'New tag'}</h2>
                        {selected && <p className="text-xs text-gray-500">{selected.status}</p>}
                    </div>
                    {selected && !action && termActions.length > 0 && <Menu as="div" className="classification-action-menu">
                        <MenuButton className="classification-action-trigger" disabled={busy}>Actions <ChevronDown size={14} aria-hidden="true" /></MenuButton>
                        <MenuItems anchor="bottom end" className="classification-action-options">
                            {termActions.map(item => <MenuItem key={item}>
                                <button type="button" onClick={() => startAction(item)}>{({ edit: 'Edit', move: 'Move', merge: 'Merge', archive: 'Archive', reactivate: 'Reactivate' })[item]}</button>
                            </MenuItem>)}
                        </MenuItems>
                    </Menu>}
                </div>
                {selected && !action && <dl className="classification-tag-details">
                    <div><dt>Location</dt><dd className="break-words">{selected.path || `${typeDefinitions.find(type => type.id === selected.classificationType)?.name || selected.tagType} / ${selected.name}`}</dd></div>
                    <div><dt>Description</dt><dd className="whitespace-pre-wrap break-words">{selected.description || '—'}</dd></div>
                    <div><dt>Alternative names</dt><dd className="whitespace-pre-wrap break-words">{selected.alternativeNames?.length ? selected.alternativeNames.join(', ') : '—'}</dd></div>
                </dl>}
                {selected && <section className="space-y-3" aria-label="Term usage">
                    <h3 className="font-medium">Usage</h3>
                    {usage.isPending && <p role="status">Loading usage…</p>}
                    {usage.error && <p role="alert">{classificationError(usage.error)}</p>}
                    {Object.entries(usage.data || {}).map(([kind, group]) => <div key={kind}>
                        <p>{kind.replace(/([A-Z])/g, ' $1')}: {group.count}</p>
                        <ul className="text-sm space-y-1">{group.results.map(item => <li key={item.id}><a className="underline" href={item.url}>{item.name}</a></li>)}</ul>
                    </div>)}
                </section>}
                {(!selected || action) && <form onSubmit={save} className="space-y-4 max-w-xl" aria-label={selected ? `${action[0].toUpperCase()}${action.slice(1)} tag` : 'Create tag'}>
                    {selected && <h3 className="font-medium">{({ edit: 'Edit', move: 'Move', merge: 'Merge', archive: 'Archive', reactivate: 'Reactivate' })[action]} tag</h3>}
                    {['create', 'edit'].includes(action) && <>
                        <label className="block"><span className="classification-field-label">Tag type</span><CompactSelect label="Tag type" required className={inputClass}
                            value={selected ? editTypeId : typeId} onChange={event => selected ? setEditTypeId(event.target.value) : setTypeId(event.target.value)}>
                            {typeDefinitions.filter(type => selected
                                ? type.id === selected.classificationType || (String(type.namespace) === String(selected.namespace) && permissions.includes('edit') && type.permissions?.includes('create'))
                                : type.id === typeId || type.permissions?.includes('create') || type.permissions?.includes('propose')).map(type =>
                                <option key={type.id} value={type.id}>{type.name}</option>)}
                        </CompactSelect></label>
                        {canChangeType && <p className="text-gray-600">Changing type makes this tag a root tag. Tags with children, assignments, legacy links or pending proposals cannot change type.</p>}
                        <label className="block"><span className="classification-field-label">Name</span><input placeholder=" " required maxLength={50} className={inputClass} data-filled={String(name ?? '').length > 0} value={name} onChange={event => setName(event.target.value)} /></label>
                        <label className="block"><span className="classification-field-label">Description</span><textarea placeholder=" " className={inputClass} data-filled={String(description ?? '').length > 0} value={description} onChange={event => setDescription(event.target.value)} /></label>
                        <label className="block"><span className="classification-field-label">Alternative names (one per line)</span><textarea placeholder=" " className={inputClass} data-filled={String(aliases ?? '').length > 0} value={aliases} onChange={event => setAliases(event.target.value)} /></label>
                    </>}
                    {['move', 'merge'].includes(action) && <>
                        <label className="block"><span className="classification-field-label">{action === 'move' ? 'New parent' : 'Merge target'}</span><CompactSelect label={action === 'move' ? 'New parent' : 'Merge target'} required={action === 'merge'} className={inputClass} value={destination} onChange={event => setDestination(event.target.value)}><option value="">{action === 'move' ? 'Type root' : 'Choose target'}</option>{(terms.data?.results || []).filter(term => term.id !== selected?.id && term.status === 'approved').map(term => <option key={term.id} value={term.id}>{term.path}</option>)}</CompactSelect></label>
                        <p className="text-sm">{action === 'merge' ? 'The source keeps its identity and redirects to the target. Its children move to the target. Existing version assignments are preserved.' : 'The term and its subtree move together. Existing assignments keep their identities.'}</p>
                    </>}
                    {action === 'archive' && <p>Existing assignments remain visible. New assignments will be blocked. Active children must be moved or archived first.</p>}
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" disabled={busy || (!permissions.includes(action === 'reactivate' ? 'restore' : action) && (!permissions.includes('propose') || action === 'reactivate')) || (selected && !['approved', 'archived'].includes(selected.status)) || (canChangeType && !targetType?.permissions?.includes('create'))} className="user-tools-primary">{permissions.includes(action === 'reactivate' ? 'restore' : action) ? 'Apply' : 'Submit proposal'}</button>
                        <button type="button" disabled={busy} onClick={cancelAction}>Cancel</button>
                    </div>
                </form>}
            </section>
        </div>}
        {view === 'proposals' && <section className="space-y-6">
            {(proposals.data?.results || []).some(proposal => {
                const rights = types.data?.results?.find(type => type.id === proposal.classificationType)?.permissions || []
                return proposal.status === 'pending' && rights.includes('approve') && rights.includes(proposal.action)
            }) && <label className="block max-w-lg"><span className="classification-field-label">Decision reason</span><input placeholder=" " className={inputClass} data-filled={String(reason ?? '').length > 0} value={reason} onChange={event => setReason(event.target.value)} /></label>}
            {proposals.isPending && <p role="status">Loading proposals…</p>}{proposals.error && <p role="alert">{classificationError(proposals.error)}</p>}
            {proposals.data?.count === 0 && <p className="py-8 text-gray-500">No tag proposals to review.</p>}
            {(proposals.data?.results || []).map(proposal => {
                const rights = types.data?.results?.find(type => type.id === proposal.classificationType)?.permissions || []
                const canDecide = rights.includes('approve') && rights.includes(proposal.action)
                return <article key={proposal.id} className="space-y-3 border-b border-gray-200 pb-6 last:border-0">
                    <h3 className="font-semibold">{proposal.term.name} · {proposal.action} · {proposal.status}</h3>
                    <p className="text-sm">Proposed by user {proposal.proposedBy} · {new Date(proposal.createdAt).toLocaleString()}</p>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><dt className="font-medium">Current</dt><dd className="whitespace-pre-wrap break-words text-sm">{JSON.stringify({ name: proposal.term.name, parent: proposal.term.parent, status: proposal.term.status }, null, 2)}</dd></div><div><dt className="font-medium">Proposed change</dt><dd className="whitespace-pre-wrap break-words text-sm">{JSON.stringify(proposal.payload, null, 2)}</dd></div></dl>
                    {proposal.reason && <p>{proposal.reason}</p>}
                    {proposal.status === 'pending' && <div className="flex gap-3">
                        {canDecide && ['approved', 'rejected'].map(decision => <button type="button" key={decision} disabled={busy} className={buttonClass} onClick={() => run(async () => await taxonomyApi.decide(proposal.id, decision, reason))}>{decision === 'approved' ? 'Approve' : 'Reject'}</button>)}
                        <button type="button" disabled={busy} className={buttonClass} onClick={() => run(async () => await taxonomyApi.decide(proposal.id, 'withdrawn', reason))}>Withdraw own proposal</button>
                    </div>}
                </article>
            })}
            <div className="flex gap-4">{proposalPage > 1 && <button type="button" onClick={() => setProposalPage(proposalPage - 1)}>Previous proposals</button>}{proposals.data?.next && <button type="button" onClick={() => setProposalPage(proposalPage + 1)}>Next proposals</button>}</div>
        </section>}
        {view === 'history' && definition && <section className="min-w-0 space-y-5">{history.isPending && <p role="status">Loading history…</p>}{history.data?.count === 0 && <p className="py-8 text-gray-500">No changes recorded for this tag type.</p>}{history.error && <p role="alert">{classificationError(history.error)}</p>}{(history.data?.results || []).map(operation => <article key={operation.id} className="space-y-2"><p>{operation.action} · user {operation.actor} · {new Date(operation.createdAt).toLocaleString()}</p><details><summary className="cursor-pointer py-2">Before and after</summary><pre className="overflow-auto text-sm">{JSON.stringify({ before: operation.before, after: operation.after }, null, 2)}</pre></details>{permissions.includes('restore') && ['create', 'edit', 'move', 'merge', 'archive', 'reactivate'].includes(operation.action) && operation.typeRevision === definition.revision && <button type="button" className={buttonClass} disabled={busy} onClick={() => run(async () => await taxonomyApi.undo(operation.id))}>Undo change</button>}</article>)}<div className="flex gap-4">{historyPage > 1 && <button type="button" onClick={() => setHistoryPage(historyPage - 1)}>Previous history</button>}{history.data?.next && <button type="button" onClick={() => setHistoryPage(historyPage + 1)}>Next history</button>}</div></section>}
        {view === 'rights' && permissions.includes('administer') && <section className="space-y-5 max-w-xl"><h2 className="text-xl font-semibold">Named user rights</h2><p>Members can use and propose. These templates add explicit permissions for this type.</p>{grants.error && <p role="alert">{classificationError(grants.error)}</p>}<ul>{(grants.data?.results || []).map(grant => <li key={grant.id}>{grant.username}: {grant.permissions.join(', ')}</li>)}</ul><form className="space-y-4" onSubmit={event => { event.preventDefault(); run(async () => await taxonomyApi.grant(typeId, Number(grantUser), customPermissions)) }}><label className="block"><span className="classification-field-label">User</span><CompactSelect label="User" required className={inputClass} value={grantUser} onChange={event => setGrantUser(event.target.value)}><option value="">Choose user</option>{(members.data?.results || []).map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</CompactSelect></label><label className="block"><span className="classification-field-label">Role template</span><CompactSelect label="Role template" className={inputClass} value={grantRole} onChange={event => { setGrantRole(event.target.value); setCustomPermissions(roles[event.target.value]) }}>{Object.keys(roles).map(role => <option key={role}>{role}</option>)}</CompactSelect></label><fieldset className="space-y-2"><legend>Permissions</legend>{roles.administrator.concat(roles.steward).map(permission => <label key={permission} className="flex items-center gap-2"><input type="checkbox" checked={customPermissions.includes(permission)} onChange={event => setCustomPermissions(event.target.checked ? [...customPermissions, permission] : customPermissions.filter(item => item !== permission))} />{permission}</label>)}</fieldset><button className={buttonClass} disabled={busy}>Save permissions</button></form></section>}
    </div>
}
