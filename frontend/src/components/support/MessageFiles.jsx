import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supportRequest, supportError, validateBugVideo } from '../../api/support'
import { useSupportTenant } from './useSupportContext'

export async function uploadMessageFiles(tenant, files, cache) {
    const ids = []
    for (const file of files) {
        let id = cache.get(file)
        if (!id) {
            const data = new FormData(); data.append('file', file)
            const result = await supportRequest(tenant, 'attachments/', 'post', data)
            id = result.id; cache.set(file, id)
        }
        ids.push(id)
    }
    return ids
}

export function MessageFilePicker({ files, setFiles, disabled = false, onCheckingChange }) {
    const tenant = useSupportTenant()
    const [error, setError] = useState('')
    const [checking, setChecking] = useState(false)
    const sequence = useRef(0)
    const select = async (event) => {
        const selected = [...event.target.files]
        event.target.value = ''
        const version = ++sequence.current
        setError(''); setChecking(true); onCheckingChange?.(true)
        try {
            if (files.length + selected.length > 10) throw new Error('Högst tio bilagor per meddelande.')
            for (const file of selected) {
                if (file.size > 25 * 1024 * 1024) throw new Error('Varje bilaga får vara högst 25 MB.')
                if (file.type.startsWith('video/')) await validateBugVideo(file, 25 * 1024 * 1024)
            }
            if (version === sequence.current) setFiles((previous) => [...previous, ...selected])
        } catch (err) { setError(err.message) }
        finally { if (version === sequence.current) { setChecking(false); onCheckingChange?.(false) } }
    }
    return <section aria-label="Meddelandebilagor" className="message-files">
        <label>Filer, bilder eller video
            <input type="file" multiple disabled={disabled || checking} onChange={select} />
        </label>
        <p className="support-muted">Högst 25 MB per fil. Video: MP4 eller WebM, högst 5 sekunder. Videons längd kontrolleras även på servern.</p>
        {files.map((file, index) => <div key={index} className="flex items-center gap-2 my-2"><span>{file.name}</span><button type="button" disabled={disabled || checking} onClick={() => setFiles(files.filter((_, i) => i !== index))}>Ta bort {file.name}</button></div>)}
        {checking && <p role="status">Kontrollerar bilagorna…</p>}
        {error && <p role="alert" className="support-error">{error}</p>}
        <Link className="text-xs font-medium text-blue-600 underline hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" to={`/help/how-to/record-bug-video?tenant=${encodeURIComponent(tenant || '')}`} target="_blank" rel="noopener noreferrer">
            Så spelar du in en femsekunders buggrapport (öppnas i nytt fönster)
        </Link>
    </section>
}

export function MessageFile({ file }) {
    const tenant = useSupportTenant()
    const [error, setError] = useState('')
    const download = async () => {
        setError('')
        try {
            const result = await supportRequest(tenant, `attachments/${file.id}/download/`)
            if (result.content) {
                const url = URL.createObjectURL(new Blob([result.content], { type: 'application/json' }))
                const link = document.createElement('a'); link.href = url; link.download = result.filename; link.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
            } else {
                const link = document.createElement('a'); link.href = result.url; link.rel = 'noreferrer'; link.click()
            }
        } catch (err) { setError(supportError(err)) }
    }
    return <div className="my-2"><button type="button" onClick={download}>{file.filename} · {Math.ceil(file.byteSize / 1024)} kB</button>{error && <p role="alert">{error}</p>}</div>
}
