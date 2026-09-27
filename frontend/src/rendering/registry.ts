import { RENDER_LAYOUT_COMPONENTS } from './layoutRenderers'
import { DESIGNER_RENDER_WIDGET_COMPONENTS, RENDER_WIDGET_COMPONENTS } from './widgetRenderers'

export const renderWidgetRegistry = Object.freeze(RENDER_WIDGET_COMPONENTS)
export const renderLayoutRegistry = Object.freeze(RENDER_LAYOUT_COMPONENTS)

export const getRenderWidget = (type: string, designer = false) => renderWidgetRegistry[type]
    || (designer ? DESIGNER_RENDER_WIDGET_COMPONENTS[type] : null)
    || null
export const getRenderLayout = (name: string) => renderLayoutRegistry[name] || null
export const getRenderWidgetTypes = () => Object.keys(renderWidgetRegistry)
export const getRenderLayoutTypes = () => Object.keys(renderLayoutRegistry)
