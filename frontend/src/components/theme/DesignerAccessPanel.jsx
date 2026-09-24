import { useCallback, useEffect, useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { api } from '../../api/client'
import { processResponse } from '../../api/utils'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'

const DesignerAccessPanel = ({ themeId }) => {
    const [assignments, setAssignments] = useState([])
    const [username, setUsername] = useState('')
    const [busy, setBusy] = useState(false)
    const { addNotification } = useGlobalNotifications()
    const endpoint = `/api/v1/webpages/themes/${themeId}/designer-assignments/`

    const load = useCallback(async () => {
        try {
            const response = processResponse(await api.get(endpoint))
            setAssignments(response.results || [])
        } catch (error) {
            addNotification({ type: 'error', message: error.response?.data?.detail || 'Could not load Designer access' })
        }
    }, [addNotification, endpoint])

    useEffect(() => { if (themeId) load() }, [themeId, load])

    const add = async () => {
        if (!username.trim()) return
        setBusy(true)
        try {
            await api.post(endpoint, { username: username.trim() })
            setUsername('')
            await load()
            addNotification({ type: 'success', message: 'Designer assigned to this theme' })
        } catch (error) {
            addNotification({ type: 'error', message: error.response?.data?.detail || 'Designer could not be assigned' })
        } finally { setBusy(false) }
    }

    const remove = async (assignment) => {
        try {
            await api.delete(endpoint, { data: { assignmentId: assignment.id } })
            await load()
            addNotification({ type: 'success', message: 'Designer access removed' })
        } catch (error) {
            addNotification({ type: 'error', message: error.response?.data?.detail || 'Designer access could not be removed' })
        }
    }

    return (
        <section className="border-t border-gray-200 pt-6">
            <h3 className="text-md font-semibold text-gray-900">Designer access</h3>
            <p className="mt-1 text-sm text-gray-600">Assign restricted access to this theme by exact username. Designer-only users should not also be tenant members.</p>
            <div className="mt-4 flex max-w-lg gap-2">
                <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Designer username" className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                <button type="button" onClick={add} disabled={busy || !username.trim()} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"><UserPlus className="h-4 w-4" />Assign</button>
            </div>
            <div className="mt-4 max-w-lg space-y-2">
                {assignments.map((assignment) => <div key={assignment.id} className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2"><div><div className="text-sm font-medium text-gray-900">{assignment.username}</div><div className="text-xs text-gray-500">{assignment.email || 'No email address'}</div></div><button type="button" onClick={() => remove(assignment)} aria-label={`Remove ${assignment.username}`} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}
                {assignments.length === 0 && <p className="text-sm text-gray-500">No restricted designers assigned.</p>}
            </div>
        </section>
    )
}

export default DesignerAccessPanel
