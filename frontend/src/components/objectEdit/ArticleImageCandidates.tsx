import { isAxiosError } from 'axios'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'

type Candidate = {
    id: string
    previewUrl: string | null
    expiresAt: string
}

type CandidateCollection = {
    available: boolean
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

export default function ArticleImageCandidates({ articleId }: { articleId: string }) {
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
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
