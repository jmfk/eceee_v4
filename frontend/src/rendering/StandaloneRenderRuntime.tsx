import { useCallback, useEffect, useState } from 'react'
import RenderDocument from './RenderDocument'
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

    useEffect(() => {
        const captureWindow = window as Window & { __ECEEE_CAPTURE_RENDER_MODEL__?: boolean }
        if (!model || !captureWindow.__ECEEE_CAPTURE_RENDER_MODEL__) return
        window.dispatchEvent(new CustomEvent('eceee-standalone-render-ready', { detail: { model } }))
    }, [model])

    const handleNavigate = useCallback((href: string) => {
        let destination: URL
        try {
            destination = new URL(href, window.location.origin)
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
    return <RenderDocument model={model} onNavigate={handleNavigate} />
}

export default StandaloneRenderRuntime
