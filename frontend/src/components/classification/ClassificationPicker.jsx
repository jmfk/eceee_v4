import React, { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { taxonomyApi, classificationError } from '../../api/taxonomy'
import { getCurrentTenantId } from '../../utils/tenant'

/** Controlled IDs belong to the editor's working copy, never to the live version. */
export default function ClassificationPicker({ value = [], onChange, namespace, use, allowProposed = false, disabled = false }) {
    const id = useId()
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const tenant = getCurrentTenantId()
    const defaultNamespace = useQuery({
        queryKey: ['classification', tenant, 'defaultNamespace'],
        queryFn: async () => await taxonomyApi.defaultNamespace(),
        enabled: !namespace,
    })
    const effectiveNamespace = namespace || defaultNamespace.data?.results?.[0]?.id
    const terms = useQuery({
        queryKey: ['classification', tenant, 'picker', effectiveNamespace, use, search, page],
        queryFn: async () => await taxonomyApi.terms({ namespace: effectiveNamespace, use, search, page }),
        enabled: !!effectiveNamespace,
    })
    const selected = useQuery({
        queryKey: ['classification', tenant, 'selected', value],
        queryFn: () => Promise.all(value.map(async termId => await taxonomyApi.term(termId))),
    })
    const choices = (terms.data?.results || []).filter(term =>
        !value.includes(term.id) && (term.status === 'approved' || (allowProposed && term.status === 'proposed')))
    return <fieldset disabled={disabled} className="space-y-3 text-gray-900 dark:text-gray-100">
        <legend className="font-medium">Classification</legend>
        <ul className="space-y-2" aria-label="Selected classifications">
            {value.map(termId => {
                const term = selected.data?.find(item => item.id === termId)
                return <li key={termId} className="flex items-center gap-3">
                    <span>{term?.path || term?.name || termId}{term && term.status !== 'approved' ? ` (${term.status})` : ''}</span>
                    <button type="button" className="px-2 py-1 underline focus-visible:outline" onClick={() => onChange(value.filter(item => item !== termId))}>Remove<span className="sr-only"> {term?.name || termId}</span></button>
                </li>
            })}
        </ul>
        <label htmlFor={id} className="block text-sm">Find a classification</label>
        <input id={id} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} className="w-full rounded border-gray-300 bg-transparent" type="search" />
        {terms.isPending && <p role="status">Loading classifications…</p>}
        {(terms.error || selected.error || defaultNamespace.error) && <p role="alert">{classificationError(terms.error || selected.error || defaultNamespace.error)}</p>}
        {!terms.isPending && !terms.error && choices.length === 0 && <p className="text-sm">No matching classifications.</p>}
        <ul className="max-h-56 overflow-auto space-y-1">
            {choices.map(term => <li key={term.id}><button type="button" className="w-full px-2 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline" onClick={() => onChange([...value, term.id])}>
                {term.path}{term.status === 'proposed' ? ' (pending approval)' : ''}
            </button></li>)}
        </ul>
        <div className="flex gap-4 text-sm">
            {page > 1 && <button type="button" onClick={() => setPage(page - 1)}>Previous</button>}
            {terms.data?.next && <button type="button" onClick={() => setPage(page + 1)}>Next</button>}
        </div>
    </fieldset>
}
