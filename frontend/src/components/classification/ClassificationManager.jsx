import React, { useState } from 'react'
import ClassificationTypeForm from './ClassificationTypeForm'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { taxonomyApi, classificationError } from '../../api/taxonomy'
import { getCurrentTenantId } from '../../utils/tenant'

const inputClass = 'block w-full mt-1'
const buttonClass = 'shrink-0'

function TermTree({ terms, selectedId, onSelect, parent = null, seen = [] }) {
    return <ul className={parent ? 'ml-5' : ''}>
        {terms.filter(term => term.parent === parent || (!parent && term.parent && !terms.some(item => item.id === term.parent))).filter(term => !seen.includes(term.id)).map(term => <li key={term.id}>
            <button type="button" aria-current={term.id === selectedId ? 'true' : undefined} onClick={() => onSelect(term)} className={`${buttonClass} w-full justify-start break-words text-left ${term.id === selectedId ? 'font-semibold bg-blue-50 text-blue-700' : ''}`}>
                {term.name}{term.status !== 'approved' && <span className="text-xs ml-2">{term.status}</span>}
            </button>
            <TermTree terms={terms} selectedId={selectedId} onSelect={onSelect} parent={term.id} seen={[...seen, term.id]} />
        </li>)}
    </ul>
}

export default function ClassificationManager() {
    const tenant = getCurrentTenantId()
    const client = useQueryClient()
    const [typeId, setTypeId] = useState('')
    const [selected, setSelected] = useState(null)
    const [view, setView] = useState('terms')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [proposalPage, setProposalPage] = useState(1)
    const [historyPage, setHistoryPage] = useState(1)
    const [customPermissions, setCustomPermissions] = useState(['use', 'propose'])
    const [action, setAction] = useState('create')
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
    const types = useQuery({ queryKey: ['classification', tenant, 'types'], queryFn: async () => await taxonomyApi.types({ page_size: 200 }) })
    const hasTypes = (types.data?.results || []).length > 0
    const setupPending = types.isSuccess && !hasTypes
    const definition = types.data?.results?.find(type => type.id === typeId)
    const permissions = definition?.permissions || []
    const terms = useQuery({ queryKey: ['classification', tenant, 'terms', typeId, search, page], queryFn: async () => await taxonomyApi.terms({ classification_type: typeId, search, page, page_size: 200 }), enabled: !!typeId || (setupPending && ['terms', 'history'].includes(view)) })
    const proposals = useQuery({ queryKey: ['classification', tenant, 'proposals', proposalPage], queryFn: async () => await taxonomyApi.proposals({ page: proposalPage }), enabled: view === 'proposals' })
    const history = useQuery({ queryKey: ['classification', tenant, 'history', typeId, historyPage], queryFn: async () => await taxonomyApi.history({ classification_type: typeId, page: historyPage }), enabled: view === 'history' && !!typeId })
    const grants = useQuery({ queryKey: ['classification', tenant, 'grants', typeId], queryFn: async () => await taxonomyApi.grants(typeId), enabled: view === 'rights' && permissions.includes('administer') })
    const usage = useQuery({ queryKey: ['classification', tenant, 'usage', selected?.id], queryFn: async () => await taxonomyApi.usage(selected.id), enabled: !!selected })
    const members = useQuery({ queryKey: ['classification', tenant, 'members', typeId], queryFn: async () => await taxonomyApi.members(typeId), enabled: view === 'rights' && permissions.includes('administer') })
    const refresh = () => client.invalidateQueries({ queryKey: ['classification', tenant] })
    const run = async operation => {
        setBusy(true); setError(''); setNotice('')
        try { await operation(); await refresh() } catch (failure) { setError(classificationError(failure)) } finally { setBusy(false) }
    }
    const choose = term => {
        setSelected(term); setAction(term.status === 'archived' ? 'reactivate' : 'edit'); setName(term.name); setDescription(term.description || '')
        setAliases((term.alternativeNames || []).join('\n')); setDestination(''); setError('')
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
            if (permissions.includes(action === 'reactivate' ? 'restore' : action)) {
                const result = action === 'create' ? await taxonomyApi.create(typeId, payload) : await taxonomyApi.change(selected, action, payload)
                setUndoId(result.operation?.id || result.id); setNotice('Tag saved.')
                setSelected(null); setAction('create'); setName(''); setDescription(''); setAliases('')
            } else {
                await taxonomyApi.propose(typeId, action, payload, selected)
                setNotice('Proposal submitted. It will take effect after approval.')
            }
        })
    }
    const roles = {
        user: ['use'], proposer: ['use', 'propose'],
        steward: ['use', 'propose', 'create', 'edit', 'move', 'merge', 'archive', 'restore', 'approve'],
        administrator: ['administer'],
    }
    return <div className="user-tools-content min-w-0 space-y-6 text-gray-900" aria-busy={busy}>
        <nav aria-label="Tag views" className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
            {['terms', 'types', 'proposals', 'history', ...(permissions.includes('administer') ? ['rights'] : [])].map(item => <button type="button" key={item} className={buttonClass} aria-pressed={view === item} aria-current={view === item ? 'page' : undefined} onClick={() => { setView(item); setError('') }}>{({ terms: 'Tags', types: 'Types', proposals: 'Proposals', history: 'History', rights: 'Rights' })[item]}</button>)}
        </nav>
        {types.isPending && <p role="status">Loading tag types…</p>}
        {types.error && <p role="alert">{classificationError(types.error)}</p>}
        {!types.isPending && !types.error && (types.data?.results || []).length > 0 && view !== 'proposals' && <div className="flex flex-wrap items-end gap-3">
            <label className="block w-full max-w-sm font-medium">Tag type<select className={inputClass} value={typeId} onChange={event => { setTypeId(event.target.value); setSelected(null); setAction('create'); setPage(1); setHistoryPage(1); setName(''); setDescription(''); setAliases('') }}>
                <option value="">{view === 'types' ? 'New tag type' : 'Choose a type'}</option>{(types.data?.results || []).map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select></label>
        </div>}
        {!types.isPending && !types.error && ['terms', 'history'].includes(view) && !definition && <div className="py-4 space-y-4">
            {hasTypes ? <p className="text-gray-600">Choose a tag type to {view === 'history' ? 'view its history' : 'browse and manage its tags'}.</p> : <>
                {terms.isPending && <p role="status">Checking existing tags…</p>}
                {terms.error && <p role="alert">{classificationError(terms.error)}</p>}
                {terms.isSuccess && ((terms.data?.results || []).length > 0 ? <section aria-label="Existing tags" className="space-y-4">
                    <div>
                        <h2 className="text-xl font-semibold">Existing tags</h2>
                        <p className="mt-2 text-gray-600">Tag setup is incomplete. A workspace owner needs to finish the migration before these tags can be edited here.</p>
                    </div>
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
                    <button type="button" className="user-tools-primary" onClick={() => setView('types')}>Add tag type</button>
                </>)}
            </>}
        </div>}
        {notice && <p role="status" className="text-green-700">{notice} {undoId && <button type="button" disabled={busy} className="underline px-2 py-1" onClick={() => run(async () => { await taxonomyApi.undo(undoId); setUndoId(null); setNotice('Change undone.'); setSelected(null) })}>Undo</button>}</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {view === 'types' && <>
            {definition && !permissions.includes('administer') ? <p>Type administration requires administrator rights.</p> :
                <ClassificationTypeForm key={typeId || 'new'} definition={definition} tenant={tenant} busy={busy}
                    onSave={values => run(async () => {
                        if (definition) await taxonomyApi.configure(definition, values)
                        else await taxonomyApi.createType(values)
                        setNotice('Tag type saved.')
                    })} />}
        </>}
        {view === 'terms' && definition && <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,1fr)_2fr] gap-8">
            <section aria-label="Tag tree" className="min-w-0 space-y-4">
                <label className="block">Search tags<input type="search" value={search} className={inputClass} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
                {terms.isPending && <p role="status">Loading tags…</p>}
                {terms.error && <p role="alert">{classificationError(terms.error)}</p>}
                {terms.data?.count === 0 && <p>No tags yet. Use the form to add your first tag.</p>}
                <TermTree terms={terms.data?.results || []} selectedId={selected?.id} onSelect={choose} />
                <div className="flex gap-4">{page > 1 && <button type="button" onClick={() => setPage(page - 1)}>Previous</button>}{terms.data?.next && <button type="button" onClick={() => setPage(page + 1)}>Next</button>}</div>
                <button type="button" className={buttonClass} onClick={() => { setSelected(null); setAction('create'); setName(''); setDescription(''); setAliases('') }}>New tag</button>
            </section>
            <section className="min-w-0 space-y-5">
                <h2 className="text-xl font-semibold">{selected?.name || 'New tag'}</h2>
                {selected && <p className="text-sm">{selected.path} · {selected.status} · revision {selected.revision}</p>}
                {selected && <section className="space-y-3" aria-label="Term usage">
                    <h3 className="font-medium">Usage</h3>
                    {usage.isPending && <p role="status">Loading usage…</p>}
                    {usage.error && <p role="alert">{classificationError(usage.error)}</p>}
                    {Object.entries(usage.data || {}).map(([kind, group]) => <div key={kind}>
                        <p>{kind.replace(/([A-Z])/g, ' $1')}: {group.count}</p>
                        <ul className="text-sm space-y-1">{group.results.map(item => <li key={item.id}><a className="underline" href={item.url}>{item.name}</a></li>)}</ul>
                    </div>)}
                </section>}
                <form onSubmit={save} className="space-y-4 max-w-xl">
                    <label className="block">Action<select className={inputClass} value={action} onChange={event => { setAction(event.target.value); setDestination('') }}>{(selected ? (selected.status === 'archived' ? ['reactivate'] : ['edit', 'move', 'merge', 'archive']) : ['create']).map(item => <option key={item} value={item}>{item}</option>)}</select></label>
                    {['create', 'edit'].includes(action) && <>
                        <label className="block">Name<input required maxLength={50} className={inputClass} value={name} onChange={event => setName(event.target.value)} /></label>
                        <label className="block">Description<textarea className={inputClass} value={description} onChange={event => setDescription(event.target.value)} /></label>
                        <label className="block">Alternative names (one per line)<textarea className={inputClass} value={aliases} onChange={event => setAliases(event.target.value)} /></label>
                    </>}
                    {['move', 'merge'].includes(action) && <>
                        <label className="block">{action === 'move' ? 'New parent' : 'Merge target'}<select required={action === 'merge'} className={inputClass} value={destination} onChange={event => setDestination(event.target.value)}><option value="">{action === 'move' ? 'Type root' : 'Choose target'}</option>{(terms.data?.results || []).filter(term => term.id !== selected?.id && term.status === 'approved').map(term => <option key={term.id} value={term.id}>{term.path}</option>)}</select></label>
                        <p className="text-sm">{action === 'merge' ? 'The source keeps its identity and redirects to the target. Its children move to the target. Existing version assignments are preserved.' : 'The term and its subtree move together. Existing assignments keep their identities.'}</p>
                    </>}
                    {action === 'archive' && <p>Existing assignments remain visible. New assignments will be blocked. Active children must be moved or archived first.</p>}
                    <button type="submit" disabled={busy || (!permissions.includes(action === 'reactivate' ? 'restore' : action) && (!permissions.includes('propose') || action === 'reactivate')) || (selected && !['approved', 'archived'].includes(selected.status))} className="user-tools-primary">{permissions.includes(action === 'reactivate' ? 'restore' : action) ? 'Apply change' : 'Submit proposal'}</button>
                </form>
            </section>
        </div>}
        {view === 'proposals' && <section className="space-y-6">
            <h2 className="text-xl font-semibold">Proposals</h2>
            {(proposals.data?.results || []).some(proposal => {
                const rights = types.data?.results?.find(type => type.id === proposal.classificationType)?.permissions || []
                return proposal.status === 'pending' && rights.includes('approve') && rights.includes(proposal.action)
            }) && <label className="block max-w-lg">Decision reason<input className={inputClass} value={reason} onChange={event => setReason(event.target.value)} /></label>}
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
        {view === 'history' && definition && <section className="min-w-0 space-y-5"><h2 className="text-xl font-semibold">History</h2>{history.isPending && <p role="status">Loading history…</p>}{history.data?.count === 0 && <p className="py-8 text-gray-500">No changes recorded for this tag type.</p>}{history.error && <p role="alert">{classificationError(history.error)}</p>}{(history.data?.results || []).map(operation => <article key={operation.id} className="space-y-2"><p>{operation.action} · user {operation.actor} · {new Date(operation.createdAt).toLocaleString()}</p><details><summary className="cursor-pointer py-2">Before and after</summary><pre className="overflow-auto text-sm">{JSON.stringify({ before: operation.before, after: operation.after }, null, 2)}</pre></details>{permissions.includes('restore') && ['create', 'edit', 'move', 'merge', 'archive', 'reactivate'].includes(operation.action) && operation.typeRevision === definition.revision && <button type="button" className={buttonClass} disabled={busy} onClick={() => run(async () => await taxonomyApi.undo(operation.id))}>Undo change</button>}</article>)}<div className="flex gap-4">{historyPage > 1 && <button type="button" onClick={() => setHistoryPage(historyPage - 1)}>Previous history</button>}{history.data?.next && <button type="button" onClick={() => setHistoryPage(historyPage + 1)}>Next history</button>}</div></section>}
        {view === 'rights' && permissions.includes('administer') && <section className="space-y-5 max-w-xl"><h2 className="text-xl font-semibold">Named user rights</h2><p>Members can use and propose. These templates add explicit permissions for this type.</p>{grants.error && <p role="alert">{classificationError(grants.error)}</p>}<ul>{(grants.data?.results || []).map(grant => <li key={grant.id}>{grant.username}: {grant.permissions.join(', ')}</li>)}</ul><form className="space-y-4" onSubmit={event => { event.preventDefault(); run(async () => await taxonomyApi.grant(typeId, Number(grantUser), customPermissions)) }}><label className="block">User<select required className={inputClass} value={grantUser} onChange={event => setGrantUser(event.target.value)}><option value="">Choose user</option>{(members.data?.results || []).map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label className="block">Role template<select className={inputClass} value={grantRole} onChange={event => { setGrantRole(event.target.value); setCustomPermissions(roles[event.target.value]) }}>{Object.keys(roles).map(role => <option key={role}>{role}</option>)}</select></label><fieldset className="space-y-2"><legend>Permissions</legend>{roles.administrator.concat(roles.steward).map(permission => <label key={permission} className="flex items-center gap-2"><input type="checkbox" checked={customPermissions.includes(permission)} onChange={event => setCustomPermissions(event.target.checked ? [...customPermissions, permission] : customPermissions.filter(item => item !== permission))} />{permission}</label>)}</fieldset><button className={buttonClass} disabled={busy}>Save permissions</button></form></section>}
    </div>
}
