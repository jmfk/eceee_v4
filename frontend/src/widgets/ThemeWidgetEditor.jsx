import { ThemeWidgetRender } from '../rendering/ThemeWidgetRender'
import { findThemeWidget, themeWidgetDocument } from '../rendering/themeWidgets'
import { useWidgetTheme } from '../contexts/WidgetThemeContext'
import widgetRegistryManager from './WidgetRegistryManager'

// Editor adapter only; public rendering never imports editor state or controls.
export default function ThemeWidgetEditor({ config, widgetType, typeVersion, widgetId, context, ...props }) {
    const theme = useWidgetTheme(context?.theme || context?.pageVersionData?.effectiveTheme || context?.webpageData?.effectiveTheme)
    const release = findThemeWidget(themeWidgetDocument(theme), widgetType, typeVersion)?.release
    if (release?.kind === 'derived' && release.base_type && !release.base_type.startsWith('theme_widgets.')) {
        const Base = widgetRegistryManager.getWidgetComponent(release.base_type)
        if (Base) return <Base {...props} config={config} widgetType={widgetType} typeVersion={typeVersion}
            widgetId={widgetId} context={context} slotPolicies={release.slot_policies || {}} />
    }
    return <ThemeWidgetRender widget={{ id: widgetId, type: widgetType, typeVersion, config }}
        context={{ preview: true, themeWidgetTypes: themeWidgetDocument(theme) }} renderWidgets={() => null} />
}
