import { useEffect, useState } from 'react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import { useAuth } from '../../contexts/AuthContext'

function VersionThumbnail({ version, onContextMenu }) {
    const [failed, setFailed] = useState(false)

    return <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50">
        {version.previewUrl && !failed ? <img
            src={version.previewUrl}
            alt={`Version ${version.versionNumber} preview`}
            onContextMenu={onContextMenu}
            loading="lazy"
            className="max-h-full max-w-full object-contain"
            onError={() => setFailed(true)}
        /> : <span className="px-1 text-center text-[10px] text-gray-500">No preview</span>}
    </div>
}

export default function ImageVersionHistory({ file, onRestored, onImageContextMenu }) {
    const [history, setHistory] = useState(null)
    const [loadError, setLoadError] = useState(false)
    const [busy, setBusy] = useState(false)
    const { addNotification } = useGlobalNotifications()
    const { user } = useAuth()
    const canProtect = user?.isSuperuser || user?.permissions?.includes('tenant.admin')

    useEffect(() => {
        if (!file?.id) return
        let active = true
        setHistory(null)
        setLoadError(false)
        mediaApi.files.versions(file.id).then((result) => {
            if (active) setHistory(result)
        }).catch(() => {
            if (active) {
                setLoadError(true)
                addNotification('Could not load image versions', 'error')
            }
        })
        return () => { active = false }
    }, [file?.id, file?.versionNumber, addNotification])

    if (loadError) return <p role="alert" className="py-5 text-sm text-red-700">Could not load image versions.</p>
    if (!history) return <p role="status" className="py-5 text-sm text-gray-500">Loading image versions…</p>

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

    return <section aria-label="Image versions">
        <div className="flex items-center justify-end gap-3">
            {canProtect && <label className="flex items-center gap-2 text-xs text-gray-700">
                <input type="checkbox" checked={history.protectedFromCleanup} disabled={busy} onChange={toggleProtection} />
                Protected from cleanup
            </label>}
        </div>
        <ol className="mt-3 divide-y divide-gray-200">
            {history.versions.map((version) => <li key={version.id || 'current'} className="flex items-center gap-3 py-2 text-xs">
                <VersionThumbnail version={version} onContextMenu={onImageContextMenu} />
                <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">Version {version.versionNumber}{version.isCurrent ? ' · Current' : ''}</div>
                    <div className="truncate text-gray-500" title={version.originalFilename}>{version.originalFilename} · {new Date(version.uploadedAt).toLocaleDateString()}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {version.previewUrl && <a href={version.previewUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">View</a>}
                    {!version.isCurrent && <button type="button" disabled={busy} onClick={() => restore(version)} className="rounded border border-gray-300 px-2 py-1 text-blue-700 hover:bg-blue-50 disabled:opacity-50">Restore</button>}
                </div>
            </li>)}
        </ol>
    </section>
}
