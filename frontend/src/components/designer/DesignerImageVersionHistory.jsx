import { useEffect, useState } from 'react'
import { designerThemesApi } from '../../api/designerThemes'

export default function DesignerImageVersionHistory({ themeId, asset, draftVersion, onRestored, disabled }) {
    const [history, setHistory] = useState(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!asset?.url) return
        let active = true
        designerThemesApi.imageVersions(themeId, asset.assetKey).then((result) => {
            if (active) setHistory(result)
        }).catch(() => { if (active) setError('Could not load image history') })
        return () => { active = false }
    }, [themeId, asset?.assetKey, asset?.url, draftVersion])

    if (!history?.versions?.length) return null

    const restore = async (version) => {
        setBusy(true)
        setError('')
        try {
            const result = await designerThemesApi.restoreImageVersion(themeId, asset.assetKey, version.id, draftVersion)
            onRestored(result)
        } catch (failure) { setError(failure.message || 'Could not restore image') }
        finally { setBusy(false) }
    }

    const protect = async () => {
        setBusy(true)
        setError('')
        try {
            const result = await designerThemesApi.protectImageVersions(themeId, asset.assetKey, !history.protectedFromCleanup)
            setHistory((current) => ({ ...current, protectedFromCleanup: result.protectedFromCleanup }))
        } catch (failure) { setError(failure.message || 'Could not change image protection') }
        finally { setBusy(false) }
    }

    return <section className="mt-3 border-t border-gray-200 pt-3 text-xs" aria-label={`${asset.displayName} versions`}>
        <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-gray-900">Versions</span>
            <label className="flex items-center gap-2"><input type="checkbox" checked={history.protectedFromCleanup} disabled={busy || disabled} onChange={protect} />Protected from cleanup</label>
        </div>
        {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
        <ol className="mt-2 divide-y divide-gray-100">{history.versions.map((version) => <li key={version.id} className="flex items-center justify-between gap-2 py-1.5">
            <span>Version {version.versionNumber}{version.isCurrent ? ' · Current' : ''}</span>
            <span className="flex items-center gap-2">
                <a href={version.previewUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">View</a>
                {!version.isCurrent && <button type="button" disabled={busy || disabled} onClick={() => restore(version)} className="rounded border border-gray-300 px-2 py-1 text-blue-700 disabled:opacity-50">Restore to draft</button>}
            </span>
        </li>)}</ol>
    </section>
}
