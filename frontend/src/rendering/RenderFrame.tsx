import { useCallback, useEffect, useRef, useState } from 'react'
import type { RenderPageModel } from './types'

interface RenderFrameProps {
    model: RenderPageModel
    title: string
    className?: string
    style?: React.CSSProperties
    onMessage?: (event: MessageEvent) => void
    frameRef?: React.MutableRefObject<HTMLIFrameElement | null>
    src?: string
}

export const RenderFrame = ({ model, title, className = '', style, onMessage, frameRef, src = '/__render-frame' }: RenderFrameProps) => {
    const ref = useRef<HTMLIFrameElement>(null)
    const [ready, setReady] = useState(false)
    const send = useCallback(() => ref.current?.contentWindow?.postMessage({ source: 'eceee-render-host', action: 'render', model }, '*'), [model])

    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (event.source !== ref.current?.contentWindow) return
            if (event.data?.source === 'eceee-render-frame' && event.data.action === 'ready') setReady(true)
            onMessage?.(event)
        }
        window.addEventListener('message', receive)
        return () => window.removeEventListener('message', receive)
    }, [onMessage])

    useEffect(() => { if (ready) send() }, [ready, send])

    const setRef = (node: HTMLIFrameElement | null) => {
        ref.current = node
        if (frameRef) frameRef.current = node
    }

    return <iframe ref={setRef} title={title} src={src} sandbox="allow-scripts allow-same-origin" scrolling="auto" className={className} style={style} />
}

export default RenderFrame
