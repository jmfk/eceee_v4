import { useEffect, useState } from 'react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import { useAuth } from '../../contexts/AuthContext'

export default function ImageVersionHistory({ file, onRestored }) {
    const [history, setHistory] = useState(null)
    const [busy, setBusy] = useState(false)
    const { addNotification } = useGlobalNotifications()
    const { user } = useAuth()
    const canProtect = user?.isSuperuser || user?.permissions?.includes('tenant.admin')

    useEffect(() => {
        if (!file?.id) return
        let active = true
        mediaApi.files.versions(file.id).then((result) => {
            if (active) setHistory(result)
        }).catch(() => {
            if (active) addNotification('Could not load image versions', 'error')
        })
        return () => { active = false }
    }, [file?.id, file?.versionNumber, addNotification])

    if (!history) return null

    const restore = async (version) => {
        setBusy(true)
        try {
            const restored = await mediaApi.files.restoreVersion(file.id, version.id)
            setHistory(await mediaApi.files.versions(file.id))
            onRestored(restored)
            addNotification(`Version ${version.versionNumber} restored as a new version`, 'success')
        } catch {
            addNotification('Could not restore image version', 'error')
        } finally {
            setBusy(false)
        }
    }

    const toggleProtection = async () => {
        setBusy(true)
        try {
            const result = await mediaApi.files.protectVersions(file.id, !history.protectedFromCleanup)
            setHistory((current) => ({ ...current, protectedFromCleanup: result.protectedFromCleanup }))
        } catch {
            addNotification('Could not change image protection', 'error')
        } finally {
            setBusy(false)
        }
    }

    return <section className="mt-5 border-t border-gray-200 pt-4" aria-label="Image versions">
        <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Image versions</h3>
            {canProtect && <label className="flex items-center gap-2 text-xs text-gray-700">
                <input type="checkbox" checked={history.protectedFromCleanup} disabled={busy} onChange={toggleProtection} />
                Protected from cleanup
            </label>}
        </div>
        <ol className="mt-3 divide-y divide-gray-200">
            {history.versions.map((version) => <li key={version.id || 'current'} className="flex items-center justify-between gap-3 py-2 text-xs">
                <div>
                    <span className="font-medium">Version {version.versionNumber}{version.isCurrent ? ' · Current' : ''}</span>
                    <span className="ml-2 text-gray-500">{version.originalFilename} · {new Date(version.uploadedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                    {version.previewUrl && <a href={version.previewUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">View</a>}
                    {!version.isCurrent && <button type="button" disabled={busy} onClick={() => restore(version)} className="rounded border border-gray-300 px-2 py-1 text-blue-700 hover:bg-blue-50 disabled:opacity-50">Restore</button>}
                </div>
            </li>)}
        </ol>
    </section>
}
