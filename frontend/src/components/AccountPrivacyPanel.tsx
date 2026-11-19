import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { supportError, supportRequest } from '../api/support'

type Props = { tenant?: string; supportAvailable: boolean }
export default function AccountPrivacyPanel({ tenant, supportAvailable }: Props) {
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [threadId, setThreadId] = useState('')
    const requestId = useRef('')
    const requestDeletion = async () => {
        if (!requestId.current) requestId.current = crypto.randomUUID()
        setBusy(true); setMessage('')
        try {
            const result = await supportRequest(tenant, 'threads/', 'post', {
                requestId: requestId.current, title: 'Request account deletion', kind: 'question',
                body: 'I request deletion of my account and personal data. Please verify my identity and explain any data that must be retained before carrying out the deletion.',
                recipients: ['support'],
            })
            setThreadId(result.id || result.thread?.id || '')
            setMessage('Deletion requested. Follow the request in your Inbox. Your account remains available while support reviews it.')
        } catch (error) { setMessage(supportError(error)) } finally { setBusy(false) }
    }
    const download = async () => {
        setBusy(true); setMessage('')
        try {
            const response = await client.get('/api/v1/auth/privacy/export/', { responseType: 'blob' })
            const href = URL.createObjectURL(new Blob([response.data], { type: 'application/json' }))
            const link = document.createElement('a'); link.href = href; link.download = 'eceee-account-export.json'; link.click()
            setTimeout(() => URL.revokeObjectURL(href), 1000)
            setMessage('Account export downloaded.')
        } catch { setMessage('Could not download your account export. Sign in again and retry.') } finally { setBusy(false) }
    }
    return <section className="mb-6 rounded border border-gray-200 bg-white p-5 shadow-sm" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="text-lg font-semibold text-gray-900">Account privacy</h2>
        <p className="mt-2 text-xs text-gray-600">Download your account details and support messages you wrote. Editorial content and records held by other services are outside this export. Support can help with a complete data-access request.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-secondary" onClick={() => void download()} disabled={busy}>Download account export</button>
            <button type="button" className="btn-secondary" onClick={() => void requestDeletion()} disabled={busy || !supportAvailable || Boolean(threadId)}>Request account deletion</button>
            {threadId && <Link className="text-sm text-blue-700 underline" to={`/inbox/threads/${threadId}?tenant=${encodeURIComponent(tenant || '')}`}>View deletion request</Link>}
        </div>
        {!supportAvailable && <p className="mt-2 text-xs text-gray-600">Account deletion requests require a support contact in this workspace. Contact the site owner to arrange deletion.</p>}
        {message && <p role="status" className="mt-3 text-sm text-gray-700">{message}</p>}
    </section>
}
