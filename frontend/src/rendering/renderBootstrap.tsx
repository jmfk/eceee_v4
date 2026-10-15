import { createRoot } from 'react-dom/client'
import RenderFrameRuntime from './RenderFrameRuntime'
import StandaloneRenderRuntime from './StandaloneRenderRuntime'
import StandaloneVersionRenderRuntime from './StandaloneVersionRenderRuntime'

const pathname = window.location.pathname
const RootComponent = pathname === '/__render-frame'
    ? RenderFrameRuntime
    : pathname.startsWith('/_render-version/')
        ? StandaloneVersionRenderRuntime
        : StandaloneRenderRuntime

createRoot(document.getElementById('root')!).render(<RootComponent />)
