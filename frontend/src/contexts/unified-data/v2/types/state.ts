export interface UnifiedState {
    pages: Record<string, PageState>;
    widgets: Record<string, WidgetState>;
    layouts: Record<string, LayoutState>;
    versions: Record<string, VersionState>;
    metadata: MetadataState;
}

export interface PageState {
    id: string;
    title: string;
    slug: string;
    status: string;
    metadata: Record<string, any>;
    layout: string;
    version: string;
    created_at: string;
    updated_at: string;
}

export interface WidgetState {
    id: string;
    type: string;
    slotName: string;
    config: Record<string, any>;
    pageId: string;
    order: number;
}

export interface LayoutState {
    id: string;
    name: string;
    slots: Array<{
        id: string;
        name: string;
    }>;
}

export interface VersionState {
    id: string;
    pageId: string;
    number: number;
    status: string;
    metadata: Record<string, any>;
}

export interface MetadataState {
    isDirty: boolean;
    hasUnsavedChanges: boolean;
    isLoading: boolean;
    errors: Record<string, any>;
}