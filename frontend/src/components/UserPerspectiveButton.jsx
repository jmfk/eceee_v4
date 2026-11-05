import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { startUserPerspective } from '../api/userPerspective'

export default function UserPerspectiveButton({ target }) {
    const { user, language } = useAuth()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const swedish = language === 'sv-se'
    if (!user?.isSuperuser || user.userPerspective || !target?.isActive || target.isSuperuser || target.id === user.id) return null
    const start = async () => {
        setPending(true)
        setError('')
        try { await startUserPerspective(target.id) }
        catch (error) {
            setError(error.response?.data?.detail || (swedish ? 'Kunde inte byta användarvy. Försök igen.' : 'Could not switch user perspective. Try again.'))
            setPending(false)
        }
    }
    return <span className="inline-flex flex-col items-start gap-1">
        <button type="button" className="inline-flex min-h-7 items-center rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50" onClick={start} disabled={pending} title={swedish ? 'Agera med användarens behörigheter i alla flikar, högst 30 minuter.' : 'Act with this user’s permissions in all tabs, for up to 30 minutes.'}>
            {swedish ? (pending ? 'Byter vy…' : 'Visa som användare') : (pending ? 'Switching…' : 'View as user')}
        </button>
        {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
}
