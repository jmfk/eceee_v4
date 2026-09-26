import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getRenderLayout, getRenderWidget } from './registry'
import { normalizeCssName, RenderFailure, SafeHtml } from './primitives'
import { renderMustache } from '../utils/mustacheRenderer'
import type { RenderPageModel, RenderWidgetModel } from './types'

class RenderBoundary extends Component<{ children: ReactNode, type: string }, { failed: boolean }> {
    state = { failed: false }

    static getDerivedStateFromError() { return { failed: true } }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(`[render-layer] ${this.props.type} failed`, error, info)
    }

    render() {
        return this.state.failed ? <RenderFailure message={`Could not render ${this.props.type}.`} /> : this.props.children
    }
}

export const PageRenderer = ({ model }: { model: RenderPageModel }) => {
    const Layout = getRenderLayout(model.layout)

    const renderWidgets = (widgets: RenderWidgetModel[]): ReactNode => (widgets || []).map((widget) => {
        const Widget = getRenderWidget(widget.type)
        if (!Widget) return <RenderFailure key={widget.id} message={`Unsupported widget: ${widget.type}`} />
        const hidden = widget.config?.is_visible === false
            || widget.config?.isVisible === false
            || widget.config?.is_active === false
            || widget.config?.isActive === false
        if (hidden) return null
        const normalized = normalizeCssName(widget.type)
        const output = <Widget widget={widget} context={model.context} renderWidgets={renderWidgets} />
        const styleKey = widget.config?.componentStyle || widget.config?.component_style
        const componentStyle = styleKey ? model.context.componentStyles?.[styleKey] : null
        let renderedOutput: ReactNode = output
        if (componentStyle?.template) {
            try {
                const content = renderToStaticMarkup(output)
                const template = String(componentStyle.template).replace(/\{\{\s*passthru\s*\}\}/g, '{{{passthru}}}')
                renderedOutput = <SafeHtml html={renderMustache(template, { ...widget.config, content, passthru: content })} />
            } catch (error) {
                console.error(`[render-layer] component style ${styleKey} failed`, error)
            }
        }
        return <div key={widget.id} className={`widget-item widget-type-${normalized}`} data-widget-type={widget.type} data-widget-id={widget.id}>
            <RenderBoundary type={widget.type}>{renderedOutput}</RenderBoundary>
        </div>
    })

    if (!Layout) return <RenderFailure message={`Unsupported layout: ${model.layout}`} />
    return <div className="site-renderer cms-content" data-render-layout={model.layout}>
        <Layout model={model} renderSlot={(name) => renderWidgets(model.slots[name] || [])} />
    </div>
}

export default PageRenderer
