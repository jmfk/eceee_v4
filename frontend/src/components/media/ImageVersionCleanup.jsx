import { useState } from 'react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'

export default function ImageVersionCleanup() {
    const [open, setOpen] = useState(false)
    const [years, setYears] = useState(3)
    const [preview, setPreview] = useState(null)
    const [busy, setBusy] = useState(false)
    const { addNotification } = useGlobalNotifications()

    const load = async () => {
        setBusy(true)
        try { setPreview(await mediaApi.imageCleanup.preview(years)) }
        catch { addNotification('Could not preview image cleanup', 'error') }
        finally { setBusy(false) }
    }

    const execute = async () => {
        if (!window.confirm(`Permanently remove up to ${preview.count} old image versions? This cannot be undone.`)) return
        setBusy(true)
        try {
            const result = await mediaApi.imageCleanup.execute(years)
            addNotification(`Removed ${result.deleted} image versions${result.errors ? `; ${result.errors} failed` : ''}`, result.errors ? 'error' : 'success')
            setPreview(await mediaApi.imageCleanup.preview(years))
        } catch { addNotification('Image cleanup failed', 'error') }
        finally { setBusy(false) }
    }

    return <div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Clean up image versions</button>
        {open && <section className="mt-3 rounded border border-gray-200 bg-white p-4 text-xs" aria-label="Image version cleanup">
            <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1">Remove unused versions superseded more than
                    <span className="flex items-center gap-1"><input aria-label="Years before cleanup" type="number" min="1" max="100" value={years} onChange={(event) => { setYears(Number(event.target.value)); setPreview(null) }} className="w-16 rounded border border-gray-300 px-2 py-1" /> years ago</span>
                </label>
                <button type="button" disabled={busy || !Number.isInteger(years) || years < 1 || years > 100} onClick={load} className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50">Preview</button>
            </div>
            {preview && <div className="mt-3 space-y-2">
                <p>{preview.count} versions · {(preview.bytes / 1024 / 1024).toFixed(1)} MB</p>
                <p className="text-gray-600">{preview.notice}</p>
                <ul className="max-h-40 overflow-y-auto divide-y divide-gray-100">{preview.candidates.map((item) => <li key={`${item.kind}:${item.id}`} className="py-1">{item.image} · version {item.versionNumber} · {item.kind}</li>)}</ul>
                {preview.count > 0 && <button type="button" disabled={busy} onClick={execute} className="rounded border border-red-300 px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50">Remove these versions</button>}
            </div>}
        </section>}
    </div>
}
