export enum OperationTypes {
    // Widget operations
    UPDATE_WIDGET_CONFIG = 'UPDATE_WIDGET_CONFIG',
    ADD_WIDGET = 'ADD_WIDGET',
    REMOVE_WIDGET = 'REMOVE_WIDGET',
    MOVE_WIDGET = 'MOVE_WIDGET',
    MARK_WIDGET_SAVED = 'MARK_WIDGET_SAVED',

    // Metadata operations
    SET_LOADING = 'SET_LOADING',
    SET_ERROR = 'SET_ERROR',
    CLEAR_ERRORS = 'CLEAR_ERRORS',
    SET_METADATA = 'SET_METADATA',

    // Batch operations
    BATCH = 'BATCH',
    RESET_STATE = 'RESET_STATE'
}

export interface Operation {
    type: OperationTypes;
    payload: any;
}

export interface WidgetOperation extends Operation {
    payload: {
        widgetId: string;
        config?: Record<string, any>;
        slotName?: string;
        order?: number;
        pageId?: string;
        widgetType?: string;
    };
}

export interface MetadataOperation extends Operation {
    payload: {
        loading?: boolean;
        error?: {
            code: string;
            message: string;
        };
        isDirty?: boolean;
        hasUnsavedChanges?: boolean;
    };
}

export interface BatchOperation extends Operation {
    payload: Operation[];
}
