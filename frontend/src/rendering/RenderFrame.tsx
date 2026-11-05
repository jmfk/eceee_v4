import { useCallback, useEffect, useRef, useState } from 'react'
import type { RenderPageModel } from './types'

interface RenderFrameProps {
    model: RenderPageModel
    prepareModel?: (model: RenderPageModel) => RenderPageModel
    title: string
    className?: string
    style?: React.CSSProperties
    onMessage?: (event: MessageEvent) => void
    frameRef?: React.MutableRefObject<HTMLIFrameElement | null>
    src?: string
}

export const RenderFrame = ({ model, prepareModel, title, className = '', style, onMessage, frameRef, src = '/__render-frame' }: RenderFrameProps) => {
    const ref = useRef<HTMLIFrameElement>(null)
    // Start frame navigation after the host's initial page load has settled.
    const [hostLoaded, setHostLoaded] = useState(() => document.readyState === 'complete')
    useEffect(() => {
        if (document.readyState === 'complete') { setHostLoaded(true); return }
        const loaded = () => setHostLoaded(true)
        window.addEventListener('load', loaded, { once: true })
        return () => window.removeEventListener('load', loaded)
    }, [])
    const [navigationRetry, setNavigationRetry] = useState(0)
    useEffect(() => {
        if (!hostLoaded || navigationRetry || src === 'about:blank') return
        const timeout = window.setTimeout(() => {
            if (ref.current?.contentDocument?.URL === 'about:blank') setNavigationRetry(1)
        }, 2000)
        return () => window.clearTimeout(timeout)
    }, [hostLoaded, navigationRetry, src])
    const readyDocumentRef = useRef<Document | null>(null)
    const onMessageRef = useRef(onMessage)
    const modelRef = useRef(model)
    modelRef.current = model
    const prepareModelRef = useRef(prepareModel)
    prepareModelRef.current = prepareModel
    const send = useCallback(() => ref.current?.contentWindow?.postMessage({ source: 'eceee-render-host', action: 'render', model: prepareModelRef.current?.(modelRef.current) || modelRef.current }, '*'), [])

    useEffect(() => { onMessageRef.current = onMessage }, [onMessage])

    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (event.source !== ref.current?.contentWindow) return
            if (event.data?.source === 'eceee-render-frame' && event.data.action === 'ready') {
                readyDocumentRef.current = ref.current?.contentDocument || null
                send()
            }
            onMessageRef.current?.(event)
        }
        window.addEventListener('message', receive)
        return () => window.removeEventListener('message', receive)
    }, [send])

    // Either side may initialize first; each event sends the latest model.
    useEffect(() => { send() }, [model, send, hostLoaded, navigationRetry])

    const setRef = useCallback((node: HTMLIFrameElement | null) => {
        ref.current = node
        if (frameRef) frameRef.current = node
    }, [frameRef])

    const handleLoad = () => {
        // Ready may precede load; do not repaint over inline edits in that document.
        if (readyDocumentRef.current && readyDocumentRef.current === ref.current?.contentDocument) return
        send()
    }

    if (!hostLoaded) return <div role="status" className={className} style={style}>Preparing preview…</div>

    return <iframe key={`${src}:${navigationRetry}`} ref={setRef} title={title} src={src} loading="eager" onLoad={handleLoad} sandbox="allow-scripts allow-same-origin" scrolling="auto" className={className} style={style} />
}

export default RenderFrame
