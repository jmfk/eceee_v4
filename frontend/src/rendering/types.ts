import type { ComponentType } from 'react'
import type { ThemeWidgetDocument } from './themeWidgets'

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
    typeVersion?: number
    config: Record<string, any>
    data?: ResolvedRenderData
    inheritedFrom?: Record<string, unknown> | null
    previewImageReferences?: DesignerPreviewImageReference[]
}

export interface DesignerPreviewImageReference {
    sourceUrl: string
    sourceOccurrence: number
    sourcePath: Array<string | number>
    sourceMatchIndex: number
}

export interface RenderContext {
    themeWidgetTypes?: ThemeWidgetDocument
    tenantId?: string
    siteId?: string | number
    siteHostnames?: string[]
    pageId?: string | number
    versionId?: string | number
    objectId?: string | number
    objectData?: Record<string, any>
    objectType?: Record<string, any>
    pathVariables?: Record<string, string>
    simulatedPath?: string
    renderRoutePrefix?: string
    componentStyles?: Record<string, Record<string, any>>
    publicForms?: {
        endpointBase: string
        pagePath: string
        result?: {
            widgetId: string
            status: 'success' | 'error'
        }
    }
    mode?: 'preview' | 'public'
    preview: boolean
}

export interface DesignerRenderOptions {
    catalog: Record<string, any>
    texts: Record<string, string>
    assets: Array<Record<string, any>>
    editableTypographyTargets?: Record<string, string[]>
    editableSpacingTargets?: Record<string, string[]>
    designGroupTargeting?: Record<string, Record<string, any>>
    activeSpacingPropertiesByTarget?: Record<string, string[]>
    previewImageReferences?: DesignerPreviewImageReference[]
    contentEditable?: boolean
    guidesEnabled?: boolean
    guideVisibility?: {
        size?: boolean
        margin?: boolean
        padding?: boolean
        gap?: boolean
    }
    layoutCanvas?: boolean
}

export interface RenderPageModel {
    layout: 'main_layout' | 'landing_page' | string
    layoutDefinition?: ThemeLayoutDefinition | null
    layoutDefinitionRequired?: boolean
    layoutBreakpoints?: Record<string, number>
    slots: Record<string, RenderWidgetModel[]>
    context: RenderContext
    themeCss?: string
    fontUrl?: string
    designer?: DesignerRenderOptions
}

export type ThemeLayoutNodeType = 'container' | 'section' | 'grid' | 'row' | 'column' | 'semantic' | 'slot'

export interface ThemeLayoutNode {
    id: string
    type: ThemeLayoutNodeType
    label?: string
    presentation_color?: string
    children: ThemeLayoutNode[]
    styles?: Record<string, Record<string, string | number>>
    class_names?: string[]
    tag?: 'div' | 'header' | 'nav' | 'main' | 'aside' | 'section' | 'footer'
    slot_key?: string
    editable_parameters?: string[]
}

export interface ThemeLayoutSlot {
    label?: string
    description?: string
    order?: number
    required?: boolean
    max_widgets?: number | null
    allowed_widget_types?: string[]
    disallowed_widget_types?: string[]
    allows_inheritance?: boolean
    allow_merge?: boolean
    inheritable_types?: string[]
    collapse_behavior?: 'never' | 'any' | 'all'
    dimensions?: Record<string, { width?: number | null, height?: number | null }>
    default_widgets?: unknown[]
}

export interface ThemeLayoutDefinition {
    id: string
    key: string
    label: string
    description?: string
    status: 'active' | 'archived'
    root: ThemeLayoutNode
    slots: Record<string, ThemeLayoutSlot>
}

export interface ThemeSpecialPage {
    id: string
    key: string
    label: string
    kind: 'error' | 'route'
    status_code?: number
    route?: string
    layout_key: string
    widgets: Record<string, unknown[]>
}

export interface ThemeLayoutDocument {
    schema_version: 1
    default_layout_key: string
    items: ThemeLayoutDefinition[]
    special_pages?: ThemeSpecialPage[]
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
    action: 'render' | 'selectTarget' | 'clearTarget' | 'highlightTarget' | 'previewSelectionLevel' | 'readTargetStyles' | 'updateText' | 'formatText'
    model?: RenderPageModel
    targetId?: string
    targetInstanceId?: string
    widgetId?: string
    selectionLevel?: 'slot' | 'widget' | 'element'
    selectedTargets?: Array<{
        targetId: string
        targetInstanceId?: string
        widgetId?: string
        selectionLevel: 'slot' | 'widget' | 'element'
    }>
    text?: string
    command?: string
    value?: string
    active?: boolean
}
