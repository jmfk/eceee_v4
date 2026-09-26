import type { ComponentType } from 'react'

export type RenderStatus = 'ready' | 'loading' | 'empty' | 'error'

export interface ResolvedRenderData {
    status: RenderStatus
    items?: unknown[]
    item?: unknown
    error?: string
    [key: string]: unknown
}

export interface RenderWidgetModel {
    id: string
    type: string
    config: Record<string, any>
    data?: ResolvedRenderData
    inheritedFrom?: Record<string, unknown> | null
}

export interface RenderContext {
    tenantId?: string
    siteId?: string | number
    siteHostnames?: string[]
    pageId?: string | number
    versionId?: string | number
    pathVariables?: Record<string, string>
    simulatedPath?: string
    renderRoutePrefix?: string
    componentStyles?: Record<string, Record<string, any>>
    preview: true
}

export interface DesignerRenderOptions {
    catalog: Record<string, any>
    texts: Record<string, string>
    assets: Array<Record<string, any>>
    contentEditable?: boolean
    guidesEnabled?: boolean
}

export interface RenderPageModel {
    layout: 'main_layout' | 'landing_page' | string
    slots: Record<string, RenderWidgetModel[]>
    context: RenderContext
    themeCss?: string
    fontUrl?: string
    designer?: DesignerRenderOptions
}

export interface WidgetRenderProps {
    widget: RenderWidgetModel
    context: RenderContext
    renderWidgets: (widgets: RenderWidgetModel[]) => React.ReactNode
}

export type WidgetRenderComponent = ComponentType<WidgetRenderProps>

export interface LayoutRenderProps {
    model: RenderPageModel
    renderSlot: (name: string) => React.ReactNode
}

export type LayoutRenderComponent = ComponentType<LayoutRenderProps>

export interface RenderFrameMessage {
    source: 'eceee-render-host'
    action: 'render' | 'selectTarget' | 'readTargetStyles'
    model?: RenderPageModel
    targetId?: string
}
