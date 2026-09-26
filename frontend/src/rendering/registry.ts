import { RENDER_LAYOUT_COMPONENTS } from './layoutRenderers'
import { RENDER_WIDGET_COMPONENTS } from './widgetRenderers'

export const renderWidgetRegistry = Object.freeze(RENDER_WIDGET_COMPONENTS)
export const renderLayoutRegistry = Object.freeze(RENDER_LAYOUT_COMPONENTS)

export const getRenderWidget = (type: string) => renderWidgetRegistry[type] || null
export const getRenderLayout = (name: string) => renderLayoutRegistry[name] || null
export const getRenderWidgetTypes = () => Object.keys(renderWidgetRegistry)
export const getRenderLayoutTypes = () => Object.keys(renderLayoutRegistry)
