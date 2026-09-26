import { useCallback, useEffect, useState } from 'react'
import RenderFrame from './RenderFrame'
import { loadDirectRenderModel, parseDirectRenderPath } from './directRender'
import type { RenderPageModel } from './types'

export const StandaloneRenderRuntime = () => {
    const [location, setLocation] = useState(() => parseDirectRenderPath(window.location.pathname))
    const [model, setModel] = useState<RenderPageModel | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!location) {
            setError('Invalid standalone render URL.')
            return undefined
        }

        let current = true
        setModel(null)
        setError('')
        loadDirectRenderModel(location)
            .then((loadedModel) => { if (current) setModel(loadedModel) })
            .catch((loadError) => {
                if (current) setError(loadError?.message || 'Could not load this page.')
        })
        return () => { current = false }
    }, [location])

    useEffect(() => {
        const handlePopState = () => setLocation(parseDirectRenderPath(window.location.pathname))
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [])

    const handleFrameMessage = useCallback((event: MessageEvent) => {
        if (event.data?.source !== 'eceee-render-frame' || event.data.action !== 'navigate') return
        let destination: URL
        try {
            destination = new URL(event.data.href, window.location.origin)
        } catch {
            return
        }
        if (destination.origin !== window.location.origin) return
        const nextLocation = parseDirectRenderPath(destination.pathname)
        if (!nextLocation) return
        window.history.pushState({}, '', `${destination.pathname}${destination.search}${destination.hash}`)
        setLocation(nextLocation)
    }, [])

    if (error) {
        return <div role="alert" className="min-h-screen bg-white p-6 text-red-700">{error}</div>
    }
    if (!model) {
        return <div className="min-h-screen bg-white p-6 text-gray-500">Preparing preview…</div>
    }
    return <RenderFrame model={model} title="Saved page preview" className="block h-screen w-full border-0" onMessage={handleFrameMessage} />
}

export default StandaloneRenderRuntime
