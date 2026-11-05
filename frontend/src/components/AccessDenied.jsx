import { Link, useLocation } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { getCurrentTenantId } from '../utils/tenant'
import { getCmsCopyLanguage } from '../utils/cmsCopy'

export default function AccessDenied() {
    const location = useLocation()
    const swedish = getCmsCopyLanguage() === 'sv-se'
    const params = new URLSearchParams({ requestAccess: '1', from: `${window.location.origin}${location.pathname}` })
    const tenant = getCurrentTenantId()
    if (tenant) params.set('tenant', tenant)
    return <section className="mx-auto max-w-lg px-6 py-12 text-center" aria-labelledby="access-denied-heading">
        <LockKeyhole className="mx-auto mb-4 h-8 w-8 text-gray-500" aria-hidden="true" />
        <h1 id="access-denied-heading" className="mb-2 text-lg font-semibold text-gray-900">{swedish ? 'Du saknar åtkomst till den här vyn' : 'You do not have access to this view'}</h1>
        <p className="mb-5 text-sm text-gray-600">{swedish
            ? 'Kontakta administratören för att få rätt behörighet. Du kan skicka en förfrågan om mer åtkomst härifrån.'
            : 'Contact your administrator to get the permissions you need. You can send a request for more access from here.'}</p>
        <Link className="btn-primary inline-flex items-center" to={`/inbox/new?${params}`}>{swedish ? 'Begär mer åtkomst' : 'Request more access'}</Link>
    </section>
}
