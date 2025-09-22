import { UnifiedState } from '../types/state';

export function normalizePageData(pageData: any) {
    return {
        id: pageData.id,
        title: pageData.title,
        slug: pageData.slug,
        status: pageData.status,
        metadata: pageData.metadata || {},
        currentVersionId: pageData.current_version_id,
        layoutId: pageData.layout_id,
        ...pageData
    };
}

export function normalizeVersionData(versionData: any) {
    return {
        id: versionData.id,
        pageId: versionData.page_id,
        number: versionData.number,
        status: versionData.status,
        metadata: versionData.metadata || {},
        ...versionData
    };
}

export function normalizeLayoutData(layoutData: any) {
    return {
        id: layoutData.id,
        name: layoutData.name,
        slots: layoutData.slots || [],
        config: layoutData.config || {},
        metadata: layoutData.metadata || {},
        ...layoutData
    };
}

export function normalizeSlotWidgets(
    slotWidgets: Record<string, any[]>,
    pageId: string
): Record<string, any> {
    const normalizedWidgets: Record<string, any> = {};

    Object.entries(slotWidgets).forEach(([slotName, widgets]) => {
        widgets.forEach((widget, index) => {
            const widgetId = `${pageId}_${slotName}_${index}`;
            normalizedWidgets[widgetId] = {
                id: widgetId,
                pageId,
                slotName,
                order: index,
                type: widget.type,
                config: widget.config || {},
                metadata: widget.metadata || {},
                ...widget
            };
        });
    });

    return normalizedWidgets;
}

export function denormalizeWidgetsToSlots(
    widgets: Record<string, any>
): Record<string, any[]> {
    const slotWidgets: Record<string, any[]> = {};

    Object.values(widgets).forEach(widget => {
        const { slotName } = widget;
        if (!slotWidgets[slotName]) {
            slotWidgets[slotName] = [];
        }
        slotWidgets[slotName].push({
            type: widget.type,
            config: widget.config,
            metadata: widget.metadata,
            ...widget
        });
    });

    // Sort widgets by order within each slot
    Object.keys(slotWidgets).forEach(slotName => {
        slotWidgets[slotName].sort((a, b) => a.order - b.order);
    });

    return slotWidgets;
}

export function createAppStateFromAPI(
    pageData: any,
    versionData: any,
    layoutData?: any
): Partial<UnifiedState> {
    const normalizedPage = normalizePageData(pageData);
    const normalizedVersion = normalizeVersionData(versionData);
    const normalizedWidgets = normalizeSlotWidgets(versionData.widgets || {}, normalizedPage.id);
    const normalizedLayout = layoutData ? normalizeLayoutData(layoutData) : undefined;

    return {
        pages: {
            [normalizedPage.id]: normalizedPage
        },
        versions: {
            [normalizedVersion.id]: normalizedVersion
        },
        widgets: normalizedWidgets,
        layouts: normalizedLayout ? {
            [normalizedLayout.id]: normalizedLayout
        } : {},
        metadata: {
            isLoading: false,
            errors: {},
            isDirty: false
        }
    };
}
