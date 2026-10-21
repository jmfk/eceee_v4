import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import cases from '../../../backend/webpages/tests/fixtures/pilot_baseline/cases.json'
import RenderDocument from '../../src/rendering/RenderDocument'
import { createPageRenderModel } from '../../src/rendering/adapters'
import { compileRenderStyles } from '../../src/rendering/themeCssCompiler'

// Test-only entry point: the real renderer/CSS with deterministic data and no API.
const styles = compileRenderStyles({})
function PilotBaseline() {
    const [widgets, setWidgets] = useState(cases.widgets)
    const model = createPageRenderModel({ widgets, themeCss: styles.css, context: { mode: 'preview' } })
    return <>
        <button type="button" onClick={() => setWidgets({ main: [{
            id: 'pilot-unsaved', type: 'easy_widgets.HeadlineWidget',
            config: { content: 'Unsaved pilot heading', headerLevel: 'h2' },
        }] })}>Show unsaved draft</button>
        <button type="button" onClick={() => setWidgets(cases.widgets)}>Reload saved fixture</button>
        <RenderDocument model={model} />
    </>
}
createRoot(document.getElementById('root')!).render(<PilotBaseline />)
