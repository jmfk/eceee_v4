import { useEffect, useState } from 'react'
import RenderDocument from './RenderDocument'
import { loadVersionRenderModel, parseVersionRenderPath } from './directRender'
import type { RenderPageModel } from './types'

export const StandaloneVersionRenderRuntime = () => {
    const [model, setModel] = useState<RenderPageModel | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        const location = parseVersionRenderPath(window.location.pathname, window.location.search)
        if (!location) {
            setError('Invalid page-version preview URL.')
            return undefined
        }

        let current = true
        loadVersionRenderModel(location)
            .then((loadedModel) => { if (current) setModel(loadedModel) })
            .catch((loadError) => {
                if (current) setError(loadError?.message || 'Could not load this page version.')
            })
        return () => { current = false }
    }, [])

    if (error) return <div role="alert" className="render-status render-status-error">{error}</div>
    if (!model) return <div className="render-status render-status-pending">Preparing preview…</div>
    return <RenderDocument model={model} />
}

export default StandaloneVersionRenderRuntime
