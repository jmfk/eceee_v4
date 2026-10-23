import { useState } from 'react'
import Avatar from './Avatar'
import client from '../api/client'
import { supportError } from '../api/support'

export default function ProfilePhotoEditor({ user }) {
    const [revision, setRevision] = useState(0)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [status, setStatus] = useState('')
    const update = async (file) => {
        setBusy(true); setError(''); setStatus('')
        try {
            if (file) {
                const form = new FormData(); form.append('file', file)
                await client.put(`/api/v1/utils/profile-photos/${user.id}/`, form, { headers: { 'Content-Type': undefined } })
            } else await client.delete(`/api/v1/utils/profile-photos/${user.id}/`)
            setRevision((value) => value + 1)
            setStatus(file ? 'Profilbilden har sparats.' : 'Profilbilden har tagits bort.')
        } catch (err) { setError(supportError(err)) }
        finally { setBusy(false) }
    }
    return <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6" aria-label="Profilbild">
        <h2 className="text-xl font-semibold mb-4">Profilbild</h2>
        <div className="flex flex-wrap items-center gap-4">
            <Avatar userId={user.id} name={user.firstName || user.username} size={72} revision={revision} />
            <label className="text-sm">Ladda upp profilbild
                <input className="block mt-2" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !user.id} onChange={(e) => { const file = e.target.files[0]; if (file) update(file); e.target.value = '' }} />
            </label>
            <button type="button" className="btn-secondary" disabled={busy || !user.id} onClick={() => update(null)}>Ta bort profilbild</button>
        </div>
        <p className="text-sm text-gray-500 mt-3">JPEG, PNG eller WebP, högst 5 MB. Bilden beskärs till en kvadrat.</p>
        {error && <p role="alert" className="text-red-600 mt-2">{error}</p>}
        {status && <p role="status" className="mt-2">{status}</p>}
    </section>
}
