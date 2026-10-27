import '../user-tools.css'
import React, { useId, useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { taxonomyApi, classificationError } from '../../api/taxonomy'
import { getCurrentTenantId } from '../../utils/tenant'
import CompactSelect from './CompactSelect'

/** Controlled IDs belong to the editor's working copy, never to the live version. */
export default function ClassificationPicker({ value = [], onChange, namespace, use, allowProposed = false, disabled = false }) {
    const id = useId()
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [page, setPage] = useState(1)
    const [suggesting, setSuggesting] = useState(false)
    const [proposalName, setProposalName] = useState('')
    const [proposalType, setProposalType] = useState('')
    const [proposalBusy, setProposalBusy] = useState(false)
    const [proposalError, setProposalError] = useState('')
    const [proposalMessage, setProposalMessage] = useState('')
    const queryClient = useQueryClient()
    const tenant = getCurrentTenantId()
    useEffect(() => { setSearch(''); setTypeFilter(''); setPage(1); setSuggesting(false); setProposalType(''); setProposalName(''); setProposalError(''); setProposalMessage('') }, [tenant, namespace, use])
    const defaultNamespace = useQuery({
        queryKey: ['classification', tenant, 'defaultNamespace'],
        queryFn: async () => await taxonomyApi.defaultNamespace(),
        enabled: !namespace,
    })
    const effectiveNamespace = namespace || defaultNamespace.data?.results?.[0]?.id
    const terms = useQuery({
        queryKey: ['classification', tenant, 'picker', effectiveNamespace, use, typeFilter, search, page],
        queryFn: async () => await taxonomyApi.terms({ namespace: effectiveNamespace, use, classification_type: typeFilter || undefined, search, page }),
        enabled: !!effectiveNamespace,
    })
    const selected = useQuery({
        queryKey: ['classification', tenant, 'selected', value],
        queryFn: () => Promise.all(value.map(async termId => await taxonomyApi.term(termId))),
    })
    const definitions = useQuery({
        queryKey: ['classification', tenant, 'proposalTypes', effectiveNamespace, use],
        queryFn: async () => await taxonomyApi.types({ namespace: effectiveNamespace, page_size: 200, ordering: 'name' }),
        enabled: !!effectiveNamespace,
    })
    const availableTypes = (definitions.data?.results || []).filter(type => !use || type.allowedUses?.includes(use))
    const proposalTypes = (definitions.data?.results || []).filter(type => type.permissions?.includes('propose') && (!use || type.allowedUses?.includes(use)))
    const submitProposal = async () => {
        setProposalBusy(true); setProposalError('')
        try {
            const result = await taxonomyApi.propose(proposalType || proposalTypes[0]?.id, 'create', { name: proposalName.trim() })
            if (allowProposed && result.term?.id) onChange([...value, result.term.id])
            setProposalMessage(allowProposed ? 'Proposal submitted. Approval is required before publishing.' : 'Proposal submitted. Select the term after approval; this proposal does not satisfy mandatory media tagging.')
            setSuggesting(false); setProposalName('')
            await queryClient.invalidateQueries({ queryKey: ['classification', tenant] })
        } catch (error) { setProposalError(classificationError(error)) }
        finally { setProposalBusy(false) }
    }
    const choices = (terms.data?.results || []).filter(term =>
        !value.includes(term.id) && (term.status === 'approved' || (allowProposed && term.status === 'proposed')))
    return <fieldset disabled={disabled} className="user-tools-content min-w-0 space-y-3 text-gray-900">
        <legend className="font-medium">Tags</legend>
        <ul className="space-y-2" aria-label="Selected tags">
            {value.map(termId => {
                const term = selected.data?.find(item => item.id === termId)
                return <li key={termId} className="flex items-center gap-3">
                    <span>{term?.path || term?.name || termId}{term && term.status !== 'approved' ? ` (${term.status})` : ''}</span>
                    <button type="button" className="px-2 py-1 underline focus-visible:outline" onClick={() => onChange(value.filter(item => item !== termId))}>Remove<span className="sr-only"> {term?.name || termId}</span></button>
                </li>
            })}
        </ul>
        <label htmlFor={id} className="block text-sm">Find a tag</label>
        <input id={id} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} className="w-full" type="search" />
        {availableTypes.length > 1 && <CompactSelect label="Filter tag type" value={typeFilter}
            onChange={event => { setTypeFilter(event.target.value); setPage(1) }}>
            <option value="">All tag types</option>
            {availableTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
        </CompactSelect>}
        {definitions.error && <p role="alert">{classificationError(definitions.error)}</p>}
        {terms.isPending && <p role="status">Loading tags…</p>}
        {(terms.error || selected.error || defaultNamespace.error) && <p role="alert">{classificationError(terms.error || selected.error || defaultNamespace.error)}</p>}
        {!terms.isPending && !terms.error && choices.length === 0 && <p className="text-sm">No matching tags.</p>}
        <ul className="max-h-56 overflow-auto space-y-1">
            {choices.map(term => <li key={term.id}><button type="button" className="w-full justify-start px-2 py-2 text-left hover:bg-gray-100 focus-visible:outline" onClick={() => onChange([...value, term.id])}>
                {term.path}{term.status === 'proposed' ? ' (pending approval)' : ''}
            </button></li>)}
        </ul>
        {!suggesting && <button type="button" className="underline text-sm" onClick={() => { setSuggesting(true); setProposalName(search) }}>Suggest a tag</button>}
        {suggesting && <div className="space-y-2 rounded border p-3">
            <label htmlFor={`${id}-type`} className="block text-sm">Tag type</label>
            <select id={`${id}-type`} className="w-full" value={proposalType || proposalTypes[0]?.id || ''} onChange={event => setProposalType(event.target.value)}>
                {proposalTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
            <label htmlFor={`${id}-proposal`} className="block text-sm">Suggested tag name</label>
            <input id={`${id}-proposal`} className="w-full" value={proposalName} onChange={event => setProposalName(event.target.value)} />
            {definitions.isPending && <p role="status">Loading tag types…</p>}
            {definitions.error && <p role="alert">{classificationError(definitions.error)}</p>}
            {!definitions.isPending && !definitions.error && proposalTypes.length === 0 && <p>No tag types available for proposals in this scope.</p>}
            <div className="flex gap-4"><button type="button" className="user-tools-primary" disabled={proposalBusy || !proposalName.trim() || proposalTypes.length === 0} onClick={submitProposal}>Submit proposal</button><button type="button" onClick={() => setSuggesting(false)}>Cancel</button></div>
        </div>}
        {proposalError && <p role="alert">{proposalError}</p>}
        {proposalMessage && <p role="status">{proposalMessage}</p>}
        <div className="flex gap-4 text-sm">
            {page > 1 && <button type="button" onClick={() => setPage(page - 1)}>Previous</button>}
            {terms.data?.next && <button type="button" onClick={() => setPage(page + 1)}>Next</button>}
        </div>
    </fieldset>
}
