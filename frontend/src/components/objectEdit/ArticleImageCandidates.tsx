import { isAxiosError } from 'axios'
import { useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ClassificationPicker from '../classification/ClassificationPicker'
import { api } from '../../api/client'

type Candidate = {
    id: string
    previewUrl: string | null
    expiresAt: string
    suggestedClassificationIds?: string[]
    savedMediaId?: string | null
}

type CandidateCollection = {
    available: boolean
    canSave?: boolean
    items: Candidate[]
}

function generationError(error: Error | null) {
    switch (isAxiosError(error) ? error.response?.status : undefined) {
        case 400:
            return 'Save an editable article draft with a title or body, then try again.'
        case 429:
            return 'The image generation limit has been reached. Try again later.'
        case 503:
            return 'The image service is temporarily unavailable. Try again later.'
        default:
            return 'The image could not be generated. Try again.'
    }
}

type MediaReference = { id: string, title: string, width?: number, height?: number, absoluteUrl?: string }

function SaveCandidate({ candidate, endpoint, namespace, onInsert, onSaved }: {
    candidate: Candidate
    endpoint: string
    namespace?: string
    onInsert?: (media: MediaReference) => void
    onSaved: (id: string, mediaId: string) => void
}) {
    const [tags, setTags] = useState(candidate.suggestedClassificationIds ?? [])
    const [media, setMedia] = useState<MediaReference | null>(null)
    const [notice, setNotice] = useState('')
    const mounted = useRef(false)
    useLayoutEffect(() => {
        mounted.current = true
        return () => { mounted.current = false }
    }, [])
    const saved = Boolean(media || candidate.savedMediaId)
    const save = useMutation({
        mutationFn: async () => {
            if (media) return media
            return (await api.post(`${endpoint}${candidate.id}/save/`, { classificationIds: tags })).data as MediaReference
        },
        onSuccess: (result, insert: boolean) => {
            onSaved(candidate.id, result.id)
            if (!mounted.current) return
            setMedia(result)
            if (insert && onInsert) {
                onInsert(result)
                setNotice('Added to the article draft.')
            } else {
                setNotice('Saved in Media Manager.')
            }
        },
    })
    return (
        <div className="space-y-2">
            {!saved && <ClassificationPicker value={tags} onChange={setTags} namespace={namespace} use="media_files"
                disabled={save.isPending} allowProposed={false} />}
            <p className="text-xs text-gray-600">AI tag is applied automatically.</p>
            <div className="flex flex-wrap gap-2">
                {!saved && <button type="button" className="btn-secondary" disabled={save.isPending}
                    onClick={() => save.mutate(false)}>Save in Media Manager</button>}
                {onInsert && <button type="button" className="btn-secondary" disabled={save.isPending}
                    onClick={() => save.mutate(true)}>Use as article image</button>}
            </div>
            {save.isPending && <p role="status">Saving image…</p>}
            {save.isError && <p role="alert">The image could not be saved. Review the tags and try again.</p>}
            {notice && !save.isError && <p role="status">{notice}</p>}
        </div>
    )
}

export default function ArticleImageCandidates({ articleId, namespace, onInsert }: {
    articleId: string
    namespace?: string
    onInsert?: (media: MediaReference) => void
}) {
    const queryClient = useQueryClient()
    const [prompt, setPrompt] = useState('')
    const endpoint = `/api/v1/objects/objects/${articleId}/image-candidates/`
    const key = ['article-image-candidates', articleId]
    const candidates = useQuery({
        queryKey: key,
        queryFn: async () => (await api.get(endpoint)).data as CandidateCollection,
        staleTime: 60_000,
        refetchInterval: 240_000,
    })
    const generation = useMutation({
        mutationFn: () => api.post(endpoint, { prompt }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    })

    if (candidates.isPending) return <p role="status">Loading image variants…</p>
    if (candidates.isError) return <p role="status">Image variants could not be loaded.</p>

    return (
        <div className="space-y-3">
            <form className="space-y-2" onSubmit={event => {
                event.preventDefault()
                if (!generation.isPending && candidates.data.available) generation.mutate()
            }}>
                <label className="block text-xs">
                    Image instructions (optional)
                    <textarea
                        className="input-field mt-1 block w-full"
                        value={prompt}
                        onChange={event => setPrompt(event.target.value)}
                        maxLength={1000}
                        rows={2}
                    />
                </label>
                {candidates.data.available
                    ? <button type="submit" className="btn-secondary" disabled={generation.isPending}>
                        {generation.isPending ? 'Generating…' : 'Generate image'}
                    </button>
                    : <p role="status">Image generation is unavailable for this workspace.</p>}
                {generation.isError && <p role="alert">{generationError(generation.error)}</p>}
            </form>
            {!!candidates.data.items.length && (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {candidates.data.items.map((candidate, index) => (
                        <li key={candidate.id}>
                            {candidate.previewUrl && <img src={candidate.previewUrl} alt={`Generated image variant ${index + 1}`} referrerPolicy="no-referrer"
                                className="aspect-[3/2] w-full rounded object-cover" />}
                            <p className="text-xs text-gray-600">
                                Available until {new Date(candidate.expiresAt).toLocaleDateString()}
                            </p>
                            {candidates.data.canSave && <SaveCandidate candidate={candidate} endpoint={endpoint}
                                namespace={namespace} onInsert={onInsert}
                                onSaved={(id, mediaId) => queryClient.setQueryData<CandidateCollection>(key, previous => previous && ({
                                    ...previous,
                                    items: previous.items.map(item => item.id === id ? { ...item, savedMediaId: mediaId } : item),
                                }))} />}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
