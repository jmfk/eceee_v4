import { PageData, WidgetData, LayoutData, VersionData, AppState } from '../types/state';

/**
 * Data normalization utilities for loading backend data into UnifiedDataContext
 */

/**
 * Normalize page data from API response
 */
export function normalizePageData(apiPageData: any): PageData {
    return {
        id: apiPageData.id?.toString() || '',
        title: apiPageData.title || '',
        slug: apiPageData.slug || '',
        metadata: {
            description: apiPageData.description || '',
            keywords: apiPageData.keywords || [],
            author: apiPageData.author || '',
            ...apiPageData.metadata
        },
        layout: apiPageData.layout || apiPageData.codeLayout || '',
        version: apiPageData.currentVersion?.toString() || '',
        status: apiPageData.status || 'draft',
        created_at: apiPageData.created_at || new Date().toISOString(),
        updated_at: apiPageData.updated_at || new Date().toISOString()
    };
}

/**
 * Normalize widget data from API response or PageEditor format
 */
export function normalizeWidgetData(apiWidgetData: any, pageId?: string): WidgetData {
    return {
        id: apiWidgetData.id?.toString() || '',
        type: apiWidgetData.type || apiWidgetData.widgetType || '',
        slot: apiWidgetData.slot || apiWidgetData.slotName || '',
        slotName: apiWidgetData.slotName || apiWidgetData.slot || '',
        config: apiWidgetData.config || {},
        content: apiWidgetData.content,
        order: apiWidgetData.order || 0,
        parent_id: apiWidgetData.parent_id?.toString(),
        pageId: pageId || apiWidgetData.pageId?.toString(),
        name: apiWidgetData.name,
        widgetType: apiWidgetData.widgetType ? { name: apiWidgetData.widgetType } : undefined,
        widget_type: apiWidgetData.widget_type,
        created_at: apiWidgetData.created_at || new Date().toISOString(),
        updated_at: apiWidgetData.updated_at || new Date().toISOString()
    };
}

/**
 * Normalize widgets from PageEditor's slot-based format
 */
export function normalizeSlotWidgets(slotWidgets: Record<string, any[]>, pageId: string): Record<string, WidgetData> {
    const normalizedWidgets: Record<string, WidgetData> = {};

    Object.entries(slotWidgets).forEach(([slotName, widgets]) => {
        widgets.forEach((widget, index) => {
            const normalizedWidget = normalizeWidgetData({
                ...widget,
                slot: slotName,
                slotName: slotName,
                order: index
            }, pageId);
            
            normalizedWidgets[normalizedWidget.id] = normalizedWidget;
        });
    });

    return normalizedWidgets;
}

/**
 * Normalize layout data from API response
 */
export function normalizeLayoutData(apiLayoutData: any): LayoutData {
    return {
        id: apiLayoutData.id?.toString() || '',
        name: apiLayoutData.name || '',
        slots: apiLayoutData.slots?.map((slot: any) => ({
            id: slot.id?.toString() || '',
            name: slot.name || '',
            allowedWidgets: slot.allowedWidgets || [],
            metadata: slot.metadata || {}
        })) || [],
        theme: apiLayoutData.theme,
        metadata: apiLayoutData.metadata || {},
        created_at: apiLayoutData.created_at || new Date().toISOString(),
        updated_at: apiLayoutData.updated_at || new Date().toISOString()
    };
}

/**
 * Normalize version data from API response
 */
export function normalizeVersionData(apiVersionData: any): VersionData {
    return {
        id: apiVersionData.id?.toString() || '',
        page_id: apiVersionData.page_id?.toString() || apiVersionData.pageId?.toString() || '',
        number: apiVersionData.number || apiVersionData.versionNumber || 1,
        data: {
            layout: apiVersionData.layout || apiVersionData.codeLayout || '',
            widgets: apiVersionData.widgets || {},
            metadata: apiVersionData.metadata || {}
        },
        created_at: apiVersionData.created_at || new Date().toISOString(),
        created_by: apiVersionData.created_by || apiVersionData.author || 'unknown',
        status: apiVersionData.status || 'draft'
    };
}

/**
 * Create a complete AppState from API data
 */
export function createAppStateFromAPI(
    pageData: any,
    versionData: any,
    layoutData?: any
): Partial<AppState> {
    const normalizedPage = normalizePageData(pageData);
    const normalizedVersion = normalizeVersionData(versionData);
    const normalizedWidgets = normalizeSlotWidgets(versionData.widgets || {}, normalizedPage.id);
    const normalizedLayout = layoutData ? normalizeLayoutData(layoutData) : undefined;

    return {
        pages: {
            [normalizedPage.id]: normalizedPage
        },
        widgets: normalizedWidgets,
        layouts: normalizedLayout ? {
            [normalizedLayout.id]: normalizedLayout
        } : {},
        versions: {
            [normalizedVersion.id]: normalizedVersion
        },
        metadata: {
            lastUpdated: new Date().toISOString(),
            isLoading: false,
            isDirty: false,
            errors: {},
            widgetStates: {
                unsavedChanges: {},
                errors: {},
                activeEditors: []
            }
        }
    };
}

/**
 * Convert UnifiedDataContext widgets back to PageEditor slot format
 */
export function denormalizeWidgetsToSlots(widgets: Record<string, WidgetData>): Record<string, any[]> {
    const slotWidgets: Record<string, any[]> = {};

    Object.values(widgets).forEach(widget => {
        const slotName = widget.slot || widget.slotName || 'main';
        
        if (!slotWidgets[slotName]) {
            slotWidgets[slotName] = [];
        }

        slotWidgets[slotName].push({
            id: widget.id,
            type: widget.type,
            config: widget.config,
            content: widget.content,
            order: widget.order,
            slotName: slotName
        });
    });

    // Sort widgets by order within each slot
    Object.keys(slotWidgets).forEach(slotName => {
        slotWidgets[slotName].sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    return slotWidgets;
}

/**
 * Merge external data changes into existing state
 */
export function mergeExternalChanges(
    currentState: AppState,
    externalData: Partial<AppState>
): AppState {
    return {
        ...currentState,
        ...externalData,
        metadata: {
            ...currentState.metadata,
            ...externalData.metadata,
            lastUpdated: new Date().toISOString()
        }
    };
}
