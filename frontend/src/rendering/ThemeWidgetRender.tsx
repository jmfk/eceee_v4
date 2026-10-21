import { renderMustache } from '../utils/mustacheRenderer'
import { RenderFailure, SafeHtml } from './primitives'
import { findThemeWidget, themeWidgetData, sanitizeThemeWidgetHtml } from './themeWidgets'
import type { WidgetRenderProps } from './types'

export const ThemeWidgetRender = ({ widget, context }: WidgetRenderProps) => {
    const definition = findThemeWidget(context.themeWidgetTypes, widget.type, widget.typeVersion)
    if (!definition) return <RenderFailure message={`Missing widget revision: ${widget.type} v${widget.typeVersion ?? '?'}`} />
    const { item, release } = definition
    return <div data-theme-widget={`${item.id}:${release.version}`}>
        <style>{release.compiled_css}</style>
        <SafeHtml html={sanitizeThemeWidgetHtml(renderMustache(release.template, themeWidgetData(release, widget.config)))} />
    </div>
}
