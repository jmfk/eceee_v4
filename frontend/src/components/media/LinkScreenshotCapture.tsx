import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../api/client'
import ClassificationPicker from '../classification/ClassificationPicker'

type CapturedPhoto = { image: string, token: string }
type SavedMedia = { id: string, title: string }

export default function LinkScreenshotCapture({ namespace = 'default', onSaved }: {
    namespace?: string
    onSaved: (media: SavedMedia) => void
}) {
    const [url, setUrl] = useState('')
    const [title, setTitle] = useState('')
    const [tags, setTags] = useState<string[]>([])
    const capture = useMutation({
        mutationFn: async () => (await api.post('/api/v1/media/link-screenshot/', { url })).data as CapturedPhoto,
        onSuccess: () => {
            setTitle(new URL(url).hostname)
            setTags([])
        },
    })
    const save = useMutation({
        mutationFn: async (photo: CapturedPhoto) => {
            const bytes = Uint8Array.from(atob(photo.image), character => character.charCodeAt(0))
            const data = new FormData()
            data.set('image', new Blob([bytes], { type: 'image/png' }), 'webpage-screenshot.png')
            data.set('token', photo.token)
            data.set('namespace', namespace)
            data.set('title', title.trim())
            tags.forEach((tag, index) => data.set(`classification_ids[${index}]`, tag))
            return (await api.post('/api/v1/media/link-screenshot/save/', data, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })).data as SavedMedia
        },
        onSuccess: onSaved,
    })
    const locked = capture.isPending || save.isPending
    return (
        <div className="space-y-4">
            <form onSubmit={event => {
                event.preventDefault()
                if (!locked) capture.mutate()
            }} className="space-y-2">
                <label className="block text-xs">
                    Public webpage URL
                    <input type="url" required maxLength={2000} value={url} disabled={locked}
                        onChange={event => { setUrl(event.target.value); capture.reset(); save.reset() }}
                        className="input-field mt-1 block w-full" />
                </label>
                <button type="submit" className="btn-secondary" disabled={locked}>
                    {capture.isPending ? 'Capturing…' : 'Capture screenshot'}
                </button>
                {capture.isError && <p role="alert">Could not capture that webpage. Check the link or try another public page.</p>}
            </form>
            {capture.data && <>
                <img src={`data:image/png;base64,${capture.data.image}`} alt="Captured webpage preview"
                    className="max-h-96 w-full rounded border object-contain" />
                <label className="block text-xs">
                    Image title
                    <input value={title} onChange={event => setTitle(event.target.value)} maxLength={255}
                        disabled={save.isPending} className="input-field mt-1 block w-full" />
                </label>
                <ClassificationPicker namespace={namespace} use="media_files" value={tags} onChange={setTags}
                    disabled={save.isPending} />
                <button type="button" className="btn-primary" disabled={locked || !title.trim() || !tags.length}
                    onClick={() => { if (capture.data) save.mutate(capture.data) }}>
                    {save.isPending ? 'Saving…' : 'Save screenshot and continue'}
                </button>
                {save.isError && <p role="alert">Could not save the screenshot. Review the tags or capture it again.</p>}
            </>}
        </div>
    )
}
