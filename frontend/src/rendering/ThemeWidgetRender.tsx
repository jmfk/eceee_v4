import { renderMustache } from '../utils/mustacheRenderer'
import { RenderFailure, SafeHtml } from './primitives'
import { findThemeWidget, themeWidgetData, sanitizeThemeWidgetHtml } from './themeWidgets'
import { resolveThemeWidget } from './themeWidgets'
import { getRenderWidget } from './registry'
import type { WidgetRenderProps } from './types'

export const ThemeWidgetRender = ({ widget, context, renderWidgets }: WidgetRenderProps) => {
    const definition = findThemeWidget(context.themeWidgetTypes, widget.type, widget.typeVersion)
    if (!definition) return <RenderFailure message={`Missing widget revision: ${widget.type} v${widget.typeVersion ?? '?'}`} />
    const { item, release } = definition
    const base = resolveThemeWidget(context.themeWidgetTypes, release)
    if (!base) return <RenderFailure message={`Missing base revision: ${release.base_type} v${release.base_version}`} />
    if (release.kind === 'derived' && release.base_type && !release.base_type.startsWith('theme_widgets.')) {
        const Base = getRenderWidget(release.base_type, Boolean(context.preview))
        if (!Base) return <RenderFailure message={`Missing base widget: ${release.base_type}`} />
        return <Base widget={{ ...widget, type: release.base_type, config: { ...release.defaults, ...widget.config } }} context={context}
            renderWidgets={renderWidgets} />
    }
    const cssIdentity = release.kind === 'derived' ? `${release.base_type?.slice('theme_widgets.'.length)}:${release.base_version}` : `${item.id}:${release.version}`
    return <div data-theme-widget={cssIdentity} data-derived-widget={release.kind === 'derived' ? `${item.id}:${release.version}` : undefined}>
        <style>{base.compiled_css}</style>
        <SafeHtml html={sanitizeThemeWidgetHtml(renderMustache(base.template || '', themeWidgetData(base, widget.config)))} />
    </div>
}
