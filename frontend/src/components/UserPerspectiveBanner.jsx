import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { IDENTITY_CHANGE_KEY, stopUserPerspective } from '../api/userPerspective'

export default function UserPerspectiveBanner() {
    const { user, language } = useAuth()
    const perspective = user?.userPerspective
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const [now, setNow] = useState(Date.now())
    const swedish = language === 'sv-se'
    useEffect(() => {
        const changed = event => { if (event.key === IDENTITY_CHANGE_KEY) window.location.reload() }
        window.addEventListener('storage', changed)
        return () => window.removeEventListener('storage', changed)
    }, [])
    useEffect(() => {
        if (!perspective) return
        const timer = window.setInterval(() => setNow(Date.now()), 15000)
        return () => window.clearInterval(timer)
    }, [perspective])
    if (!perspective) return null
    const expired = perspective.expired || now >= perspective.expiresAt * 1000
    const stop = async () => {
        setPending(true)
        setError('')
        try { await stopUserPerspective() }
        catch (error) {
            setError(error.response?.data?.detail || (swedish ? 'Kunde inte återgå. Försök igen.' : 'Could not return to your account. Try again.'))
            setPending(false)
        }
    }
    return <aside aria-label={swedish ? 'Användarvy' : 'User perspective'} className="fixed bottom-12 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-gray-900 shadow-sm">
        <div>
            <p className="font-medium">{expired
                ? (swedish ? 'Användarvyn har avslutats.' : 'User perspective has ended.')
                : (swedish ? `Du visar som ${perspective.username}` : `Viewing as ${perspective.username}`)}</p>
            <p className="text-xs text-gray-600">{swedish ? 'Ändringar görs som användaren · alla flikar · högst 30 minuter' : 'Changes are made as this user · all tabs · up to 30 minutes'}</p>
            {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
        </div>
        <button type="button" className="btn-secondary" disabled={pending} onClick={stop}>{swedish ? (pending ? 'Återgår…' : 'Återgå till mitt konto') : (pending ? 'Returning…' : 'Return to my account')}</button>
    </aside>
}
