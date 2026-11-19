import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import CompactSelect from '../components/classification/CompactSelect'
import { useAuth } from '../contexts/AuthContext'
import { canAccessCmsPath } from '../utils/cmsNavigation'
import UserToolsNav from '../components/UserToolsNav'
import { useSupportTenant } from '../components/support/useSupportContext'
import client from '../api/client'
import '../components/website-settings.css'

type Submission = { id: string; pageId: string; pageTitle: string; formTitle: string; data: Record<string, unknown>; status: string; submittedAt: string; reviewNote: string; reviewedAt: string | null }
const statuses = { pending: 'Pending', reviewing: 'In review', accepted: 'Accepted', rejected: 'Rejected' }
function Review({ item, onSaved, tenant }: { item: Submission; onSaved: () => void; tenant?: string | null }) {
    const [status, setStatus] = useState(item.status)
    const [note, setNote] = useState(item.reviewNote)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const save = async () => {
        setBusy(true); setError('')
        try { await client.patch(`/api/v1/webpages/pages/submissions/${item.id}/`, { status, reviewNote: note, expectedReviewedAt: item.reviewedAt }, { headers: tenant ? { 'X-Tenant-ID': tenant } : {} }); onSaved() }
        catch (error: any) { setError(error.response?.status === 409 ? 'Another editor changed this submission. Reload the list before reviewing.' : 'Could not save the review. Your note is still here; retry.') }
        finally { setBusy(false) }
    }
    return <article className="website-settings mb-4">
        <h2>{item.formTitle || item.pageTitle}</h2><p>{new Date(item.submittedAt).toLocaleString()} · {item.pageTitle}</p>
        <dl>{Object.entries(item.data).map(([key, value]) => <div className="mb-3" key={key}><dt className="font-semibold">{key}</dt><dd className="whitespace-pre-wrap break-words">{Array.isArray(value) ? value.join(', ') : String(value ?? '')}</dd></div>)}</dl>
        <label className="website-field website-select my-3"><CompactSelect label="Review status" value={status} onChange={(event: any) => setStatus(event.target.value)}>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</CompactSelect><span>Review status</span></label>
        <label className="website-field website-note my-3"><textarea placeholder=" " value={note} maxLength={4000} rows={3} onChange={event => setNote(event.target.value)} /><span>Internal review note</span></label>
        <button type="button" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save review'}</button>
        {error && <p role="alert">{error}</p>}
    </article>
}
export default function SubmissionsPage() {
    const tenant = useSupportTenant()
    const { user } = useAuth()
    const canReview = Boolean(user?.id && canAccessCmsPath(user, '/submissions'))
    const cache = useQueryClient()
    const [status, setStatus] = useState('pending')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const query = useQuery({ queryKey: ['submissions', tenant, user?.id, status, search, page], enabled: canReview, gcTime: 0, staleTime: 0, queryFn: async () => (await client.get('/api/v1/webpages/pages/submissions/', { params: { status, search, page }, headers: tenant ? { 'X-Tenant-ID': tenant } : {} })).data })
    return <><UserToolsNav tenant={tenant} /><main className="flex-1 min-h-0 overflow-y-auto"><div className="container mx-auto px-4 py-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900">Editorial submissions</h1>
        <p className="mt-2 mb-5 text-sm text-gray-600">Review messages received through published forms. Accepting a submission records the decision; publish approved content separately.</p>
        <div className="website-settings mb-5"><div className="website-actions">
            <label className="website-field"><input type="search" placeholder=" " maxLength={200} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /><span>Search form title</span></label>
        </div>
        <div role="tablist" aria-label="Review status" className="submission-tabs" onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const keys = ['pending', 'reviewing', 'accepted', 'rejected', 'all']
            const index = keys.indexOf(status)
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length
            setStatus(keys[next]); setPage(1)
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()
        }}>{Object.entries({ ...statuses, all: 'All' }).map(([key, label]) => <button type="button" role="tab" aria-selected={status === key} aria-controls="submission-results" id={`submission-tab-${key}`} tabIndex={status === key ? 0 : -1} key={key} onClick={() => { setStatus(key); setPage(1) }}>{label}</button>)}</div>
        </div>
        <div id="submission-results" role="tabpanel" aria-labelledby={`submission-tab-${status}`}>
        {!canReview && <p role="alert">Reading and editing pages in this workspace is required to review submissions.</p>}
        {canReview && query.isPending && <p role="status">Loading submissions…</p>}
        {canReview && query.isError && <p role="alert">Submissions could not be loaded. Editorial page access is required. <button type="button" onClick={() => void query.refetch()}>Retry</button></p>}
        {canReview && query.data?.results?.length === 0 && <p>No submissions match this view.</p>}
        {canReview && query.data?.results?.map((item: Submission) => <Review tenant={tenant} key={`${item.id}:${item.reviewedAt}`} item={item} onSaved={() => { void cache.invalidateQueries({ queryKey: ['submissions', tenant] }) }} />)}
        <nav aria-label="Submission pages" className="flex gap-4 my-5"><button type="button" disabled={page <= 1} onClick={() => setPage(previous => previous - 1)}>Previous</button><span>Page {page}</span><button type="button" disabled={!query.data?.next} onClick={() => setPage(previous => previous + 1)}>Next</button></nav>
    </div></div></main></>
}
