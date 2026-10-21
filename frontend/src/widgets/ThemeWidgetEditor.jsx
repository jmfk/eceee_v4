import { ThemeWidgetRender } from '../rendering/ThemeWidgetRender'
import { themeWidgetDocument } from '../rendering/themeWidgets'
import { useWidgetTheme } from '../contexts/WidgetThemeContext'

// Editor adapter only; public rendering never imports editor state or controls.
export default function ThemeWidgetEditor({ config, widgetType, typeVersion, widgetId, context }) {
    const theme = useWidgetTheme(context?.theme || context?.pageVersionData?.effectiveTheme || context?.webpageData?.effectiveTheme)
    return <ThemeWidgetRender widget={{ id: widgetId, type: widgetType, typeVersion, config }}
        context={{ preview: true, themeWidgetTypes: themeWidgetDocument(theme) }} renderWidgets={() => null} />
}
