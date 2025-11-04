import { AppState, StateUpdate, StateSelector } from '../types/state';
import { Operation, ValidationResult, OperationTypes, AddWidgetPayload, UpdateWidgetConfigPayload, MoveWidgetPayload, RemoveWidgetPayload, WidgetContext } from '../types/operations';
import { SubscriptionManager } from './SubscriptionManager';
import { StateUpdateCallback, SubscriptionOptions } from '../types/subscriptions';
import { defaultEqualityFn } from '../utils/equality';
import { OperationError, ValidationError, StateError, ErrorCodes, isRetryableError } from '../utils/errors';
import { WidgetPath, isValidPath, formatPath, getTopLevelSlot, getImmediateSlot } from '../utils/widgetPath';


type WidgetTarget = { versionId?: string; objectId?: string };

/**
 * Core DataManager class responsible for state management, operations, and subscriptions
 */
export class DataManager {
    private state: AppState;
    private subscriptionManager: SubscriptionManager;
    private selectorCache = new Map<string, any>();

    constructor(initialState?: Partial<AppState>) {
        this.validateInitialState(initialState);
        // Initialize with default state structure
        this.state = {
            pages: {},
            objects: {},
            layouts: {},
            versions: {},
            themes: {},
            metadata: {
                lastUpdated: new Date().toISOString(),
                isLoading: false,
                isDirty: false,
                isObjectLoading: false,
                isObjectDirty: false,
                isThemeDirty: false,
                currentObjectId: undefined,
                currentThemeId: undefined,
                errors: [],
                warnings: [],
                widgetStates: {
                    errors: {},
                    activeEditors: []
                },
                lastViewedVersions: {} // Track last viewed version per page
            },
            ...initialState
        };
        // Initialize subscription manager
        this.subscriptionManager = new SubscriptionManager();
    }

    /**
     * Resolve the widget target (page version or object version) from payload context
     */
    private resolveWidgetTargetFromPayload(payload: WidgetContext): WidgetTarget {
        if (payload.contextType === 'page') {
            const pageId = String(payload.pageId);
            const currentVersionId = this.state.metadata.currentVersionId as any;
            if (!currentVersionId) {
                throw new StateError(
                    ErrorCodes.INVALID_CONTEXT,
                    'No current page version selected for page widget operation',
                    { pageId }
                );
            }
            const version = this.state.versions[currentVersionId];
            if (!version) {
                throw new StateError(
                    ErrorCodes.INVALID_CONTEXT,
                    `Version ${currentVersionId} not found`,
                    { currentVersionId }
                );
            }
            if (String(version.pageId) !== pageId) {
                throw new StateError(
                    ErrorCodes.INVALID_CONTEXT,
                    `Current version ${currentVersionId} does not belong to provided page ${pageId}`,
                    { currentVersionId, versionPageId: version.pageId, pageId }
                );
            }
            return { versionId: currentVersionId };
        }

        if (payload.contextType === 'object') {
            const objectId = String(payload.objectId);
            const currentObjectId = this.state.metadata.currentObjectId as any;
            if (!currentObjectId) {
                throw new StateError(
                    ErrorCodes.INVALID_CONTEXT,
                    'No current object version selected for object widget operation',
                    { objectId }
                );
            }
            return { objectId: currentObjectId } as any;
        }

        const ctxType = (payload as any)?.contextType;
        throw new StateError(
            ErrorCodes.INVALID_CONTEXT,
            `Unknown contextType for widget operation: ${ctxType}`,
            { contextType: ctxType }
        );
    }

    /**
     * Get and validate the current editing context
     */
    private getCurrentContext(): { pageId?: string; versionId?: string; objectId?: string; } {
        const { currentPageId, currentVersionId, currentObjectId } = this.state.metadata;
        
        // Prefer page context if present
        if (currentPageId && currentVersionId) {
            // Validate that the referenced page and version exist
            if (!this.state.pages[currentPageId]) {
                throw new StateError(
                    ErrorCodes.INVALID_CONTEXT,
                    `Current page ${currentPageId} not found`,
                    { currentPageId }
                );
            }

            if (!this.state.versions[currentVersionId]) {
                throw new StateError(
                    ErrorCodes.INVALID_CONTEXT,
                    `Current version ${currentVersionId} not found`,
                    { currentVersionId }
                );
            }

            // Validate that the version belongs to the current page
            const version = this.state.versions[currentVersionId];
            if (version.pageId !== currentPageId) {
                throw new StateError(
                    ErrorCodes.INVALID_CONTEXT,
                    `Version ${currentVersionId} does not belong to current page ${currentPageId}`,
                    { currentPageId, currentVersionId, versionPageId: version.pageId }
                );
            }

            return { pageId: currentPageId, versionId: currentVersionId };
        }

        // Fallback to object context
        if (currentObjectId) {
            if (!this.state.objects[currentObjectId]) {
                throw new StateError(
                    ErrorCodes.INVALID_CONTEXT,
                    `Current object ${currentObjectId} not found`,
                    { currentObjectId }
                );
            }

            return { objectId: currentObjectId };
        }

        throw new StateError(
            ErrorCodes.NO_ACTIVE_CONTEXT,
            'No active editing context. Use SWITCH_VERSION or SWITCH_OBJECT_VERSION to select a version first.',
            { currentPageId, currentVersionId, currentObjectId }
        );
    }

    private validateInitialState(state?: Partial<AppState>): void {
        if (!state) return;

        try {
            // Basic state validation
            if (state.versions) {
                Object.values(state.versions).forEach(version => {
                    if (!version.id || !version.pageId) {
                        throw new StateError(
                            ErrorCodes.INVALID_INITIAL_STATE,
                            `Version missing required fields: id or pageId`,
                            { version }
                        );
                    }
                    
                    // Validate widgets in version
                    // Validate widgets in each slot
                    Object.entries(version.widgets || {}).forEach(([slotName, widgets]) => {
                        if (!Array.isArray(widgets)) {
                            throw new StateError(
                                ErrorCodes.INVALID_INITIAL_STATE,
                                `Widgets for slot ${slotName} must be an array`,
                                { slotName, widgets, versionId: version.id }
                            );
                        }
                        widgets.forEach(widget => {
                            if (!widget.id || !widget.type) {
                                throw new StateError(
                                    ErrorCodes.INVALID_INITIAL_STATE,
                                    `Widget in slot ${slotName} missing required fields: id or type`,
                                    { widget, slotName, versionId: version.id }
                                );
                            }
                        });
                    });
                });
            }

            // Validate layout-slot relationships
            if (state.layouts) {
                Object.values(state.layouts).forEach(layout => {
                    const slotIds = new Set(layout.slots.map(s => s.id));
                    if (slotIds.size !== layout.slots.length) {
                        throw new StateError(
                            ErrorCodes.INVALID_INITIAL_STATE,
                            `Layout ${layout.id} contains duplicate slot IDs`,
                            { layoutId: layout.id }
                        );
                    }
                });
            }
        } catch (error) {
            if (error instanceof StateError) {
                throw error;
            }
            throw new StateError(
                ErrorCodes.INVALID_INITIAL_STATE,
                'Invalid initial state',
                { error }
            );
        }
    }

    /**
     * Get current state
     */
    getState(): AppState {
        return this.state;
    }

    /**
     * Update state with new values
     */
    private setState(operation: Operation, update: StateUpdate): void {
        const prevState = this.state;
        
        const newState = typeof update === 'function' 
            ? { ...prevState, ...update(prevState) }
            : { ...prevState, ...update };

        const hasDataChanged = this.hasDataChanged(prevState, newState);

        this.state = newState;
        
        this.state.metadata.lastUpdated = new Date().toISOString();
        
        // Only mark as dirty if data changed AND it's not an initialization operation
        if (hasDataChanged && !operation.type.startsWith('INIT_')) {
            this.state.metadata.isDirty = true;
        }
        
        this.selectorCache.clear();
        
        // Notify subscribers immediately
        this.subscriptionManager.notifyStateUpdate(this.state, operation);
    }

    /**
     * Check if actual data has changed (not just metadata)
     */
    private hasDataChanged(prevState: AppState, newState: AppState): boolean {
        return (
            prevState.pages !== newState.pages ||
            prevState.layouts !== newState.layouts ||
            prevState.versions !== newState.versions ||
            (prevState as any).objects !== (newState as any).objects
        );
    }

    /**
     * Get memoized selector result
     */
    private getMemoizedSelector<T>(selector: StateSelector<T>): T {
        const key = selector.toString();
        
        if (!this.selectorCache.has(key)) {
            this.selectorCache.set(key, selector(this.state));
        }
        
        return this.selectorCache.get(key);
    }

    /**
     * Validate an operation before processing
     */
    private validateOperation(operation: Operation): ValidationResult {
        try {
            // Basic validation
            if (!operation.type || !Object.values(OperationTypes).includes(operation.type as any)) {
                throw new ValidationError(operation, 
                    `Invalid operation type: ${operation.type}`,
                    { type: operation.type }
                );
            }

            // Payload validation based on operation type
            switch (operation.type) {
                case OperationTypes.ADD_WIDGET:
                    if (!operation.payload?.id || !operation.payload?.type) {
                        throw new ValidationError(operation,
                            'Widget ID and type are required',
                            { payload: operation.payload }
                        );
                    }
                    // Context requirements for widget ops
                    if (!operation.payload?.contextType || !['page', 'object'].includes(operation.payload.contextType)) {
                        throw new ValidationError(operation,
                            'contextType is required for widget operations and must be "page" or "object"',
                            { payload: operation.payload }
                        );
                    }
                    if (operation.payload.contextType === 'page' && !operation.payload?.pageId) {
                        throw new ValidationError(operation,
                            'pageId is required when contextType is "page"',
                            { payload: operation.payload }
                        );
                    }
                    break;

                case OperationTypes.UPDATE_WIDGET_CONFIG:
                    if (!operation.payload?.id || !operation.payload?.slotName) {  
                        throw new ValidationError(operation,
                            'Widget ID and slotName are required',
                            { payload: operation.payload }
                        );
                    }
                    // Either config or widgetUpdates must be provided
                    if (!operation.payload?.config && !operation.payload?.widgetUpdates) {
                        throw new ValidationError(operation,
                            'Either config or widgetUpdates must be provided',
                            { payload: operation.payload }
                        );
                    }
                    if (!operation.payload?.contextType || !['page', 'object'].includes(operation.payload.contextType)) {
                        throw new ValidationError(operation,
                            'contextType is required for widget operations and must be "page" or "object"',
                            { payload: operation.payload }
                        );
                    }
                    if (operation.payload.contextType === 'page' && !operation.payload?.pageId) {
                        throw new ValidationError(operation,
                            'pageId is required when contextType is "page"',
                            { payload: operation.payload }
                        );
                    }
                    break;
                
                case OperationTypes.MOVE_WIDGET:
                    if (!operation.payload?.contextType || !['page', 'object'].includes(operation.payload.contextType)) {
                        throw new ValidationError(operation,
                            'contextType is required for widget operations and must be "page" or "object"',
                            { payload: operation.payload }
                        );
                    }
                    if (operation.payload.contextType === 'page' && !operation.payload?.pageId) {
                        throw new ValidationError(operation,
                            'pageId is required when contextType is "page"',
                            { payload: operation.payload }
                        );
                    }
                    break;

                case OperationTypes.REMOVE_WIDGET:
                    if (!operation.payload?.id) {
                        throw new ValidationError(operation,
                            'Widget ID is required',
                            { payload: operation.payload }
                        );
                    }
                    if (!operation.payload?.contextType || !['page', 'object'].includes(operation.payload.contextType)) {
                        throw new ValidationError(operation,
                            'contextType is required for widget operations and must be "page" or "object"',
                            { payload: operation.payload }
                        );
                    }
                    if (operation.payload.contextType === 'page' && !operation.payload?.pageId) {
                        throw new ValidationError(operation,
                            'pageId is required when contextType is "page"',
                            { payload: operation.payload }
                        );
                    }
                    // if (operation.payload.contextType === 'object') {
                    //     throw new ValidationError(operation,
                    //         'objectId is required when contextType is "object"',
                    //         { payload: operation.payload }
                    //     );
                    // }
                    break;

                case OperationTypes.UPDATE_WEBPAGE_DATA:
                    if (!operation.payload?.id || !operation.payload?.updates) {
                        throw new ValidationError(operation,
                            'Page ID and updates are required',
                            { payload: operation.payload }
                        );
                    }
                    break;

                case OperationTypes.UPDATE_PAGE_VERSION_DATA:
                    if (!operation.payload?.id || !operation.payload?.updates) {
                        throw new ValidationError(operation,
                            'Version ID and updates are required',
                            { payload: operation.payload }
                        );
                    }
                    break;

                case OperationTypes.UPDATE_OBJECT:
                    if (!operation.payload?.id || !operation.payload?.updates) {
                        throw new ValidationError(operation,
                            'Object ID and updates are required',
                            { payload: operation.payload }
                        );
                    }
                    break;

                case OperationTypes.UPDATE_OBJECT_VERSION:
                    if (!operation.payload?.id || !operation.payload?.updates) {
                        throw new ValidationError(operation,
                            'Object Version ID and updates are required',
                            { payload: operation.payload }
                        );
                    }
                    break;
            }

            return { isValid: true };
        } catch (error) {
            if (error instanceof ValidationError) {
                return {
                    isValid: false,
                    errors: [{
                        field: error.code,
                        message: error.message,
                        code: error.code
                    }]
                };
            }
            
            return {
                isValid: false,
                errors: [{
                    field: 'unknown',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    code: ErrorCodes.INVALID_OPERATION
                }]
            };
        }
    }

    /**
     * Update a widget at the specified path (supports infinite nesting)
     * 
     * @param widgets - The top-level widgets object
     * @param path - Widget path [slot, widgetId, slot, widgetId, ..., targetId]
     * @param updater - Function to update the target widget
     * @returns Updated widgets object
     */
    private updateWidgetAtPath(
        widgets: Record<string, any[]>,
        path: WidgetPath,
        updater: (widget: any) => any
    ): Record<string, any[]> {
        if (!isValidPath(path) || path.length < 2) {
            throw new Error(`Invalid widget path: ${formatPath(path)}`);
        }

        const topSlot = path[0];
        const slotWidgets = widgets[topSlot] || [];
        
        // If path only has 2 elements [slot, widgetId], it's a top-level widget
        if (path.length === 2) {
            const widgetId = path[1];
            const widgetIndex = slotWidgets.findIndex((w: any) => w.id === widgetId);
            
            if (widgetIndex === -1) {
                throw new Error(`Widget ${widgetId} not found in slot ${topSlot}`);
            }
            
            const updatedWidgets = [...slotWidgets];
            updatedWidgets[widgetIndex] = updater(updatedWidgets[widgetIndex]);
            
            return {
                ...widgets,
                [topSlot]: updatedWidgets
            };
        }
        
        // Nested widget - recursively traverse and update
        const updatedSlot = this.updateNestedWidgetInSlot(slotWidgets, path.slice(1), updater);
        
        return {
            ...widgets,
            [topSlot]: updatedSlot
        };
    }

    /**
     * Recursively update a nested widget within a slot
     * 
     * @param slotWidgets - Array of widgets in current slot
     * @param pathSegment - Remaining path [widgetId, slot, widgetId, ..., targetId]
     * @param updater - Function to update the target widget
     * @returns Updated slot widgets array
     */
    private updateNestedWidgetInSlot(
        slotWidgets: any[],
        pathSegment: string[],
        updater: (widget: any) => any
    ): any[] {
        if (pathSegment.length < 1) {
            throw new Error('Invalid path segment');
        }

        const currentWidgetId = pathSegment[0];
        const widgetIndex = slotWidgets.findIndex((w: any) => w.id === currentWidgetId);
        
        if (widgetIndex === -1) {
            throw new Error(`Widget ${currentWidgetId} not found in path: ${pathSegment.join(' → ')}`);
        }
        
        const widget = slotWidgets[widgetIndex];
        
        // If this is the target widget (no more path segments), update it
        if (pathSegment.length === 1) {
            const updatedWidgets = [...slotWidgets];
            updatedWidgets[widgetIndex] = updater(widget);
            return updatedWidgets;
        }
        
        // More path segments - descend into widget's slots
        if (pathSegment.length < 3) {
            throw new Error(`Invalid path: expected slot name after widget ${currentWidgetId}`);
        }
        
        const nestedSlotName = pathSegment[1];
        const nestedSlots = widget.config?.slots || {};
        const nestedSlotWidgets = nestedSlots[nestedSlotName] || [];
        
        // Recursively update in the nested slot
        const updatedNestedSlot = this.updateNestedWidgetInSlot(
            nestedSlotWidgets,
            pathSegment.slice(2),
            updater
        );
        
        // Update the container widget with the updated nested slot
        const updatedWidgets = [...slotWidgets];
        updatedWidgets[widgetIndex] = {
            ...widget,
            config: {
                ...widget.config,
                slots: {
                    ...nestedSlots,
                    [nestedSlotName]: updatedNestedSlot
                }
            }
        };
        
        return updatedWidgets;
    }

    /**
     * Process a single operation with rollback support
     */
    private processOperation(operation: Operation): void {
        const previousState = { ...this.state };
        try {
            const validation = this.validateOperation(operation);
            if (!validation.isValid) {
                throw new ValidationError(
                    operation,
                    `Invalid operation: ${validation.errors?.[0]?.message}`,
                    validation.errors
                );
            }

            // Add validation result and timestamp to operation metadata
            operation.metadata = {
                ...operation.metadata,
                timestamp: Date.now(),
                validation
            };
                
            // Process based on operation type
            switch (operation.type) {
                case OperationTypes.INIT_VERSION:
                    // Initialize version data without side effects
                    this.setState(operation, state => {
                        const { id, data } = operation.payload;
                        if (!id || !data) {
                            throw new ValidationError(operation,
                                'ID and data are required for INIT_VERSION',
                                { payload: operation.payload }
                            );
                        }

                        // Validate version data has required fields
                        if (!data.versionNumber || !data.pageId) {
                            throw new ValidationError(operation,
                                'Version data must include versionNumber and pageId',
                                { payload: operation.payload }
                            );
                        }

                        // Ensure pageId exists in pages collection
                        if (!state.pages[data.pageId]) {
                            throw new ValidationError(operation,
                                `Referenced page ${data.pageId} does not exist`,
                                { payload: operation.payload }
                            );
                        }

                        return {
                            versions: {
                                ...state.versions,
                                [id]: {
                                    ...data,
                                    id: id, // Ensure ID is set
                                    pageId: data.pageId, // Ensure pageId is set
                                    updatedAt: data.updatedAt || new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                currentVersionId: id,
                                currentPageId: data.pageId, // Set current page ID to match version
                                isDirty: false // Reset dirty state when initializing version
                            }
                        };
                    });
                    break;

                case OperationTypes.INIT_PAGE:
                    // Initialize page data without side effects
                    this.setState(operation, state => {
                        const { id, data } = operation.payload;
                        if (!id || !data) {
                            throw new ValidationError(operation,
                                'ID and data are required for INIT_PAGE',
                                { payload: operation.payload }
                            );
                        }

                        return {
                            pages: {
                                ...state.pages,
                                [id]: {
                                    ...data,
                                    id: id, // Ensure ID is set
                                    updatedAt: data.updatedAt || new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                currentPageId: id,
                                isDirty: false // Reset dirty state when initializing version
                            }                            
                        };
                    });
                    break;

                case OperationTypes.ADD_WIDGET:
                    this.setState(operation, state => {
                        const payload = operation.payload as AddWidgetPayload;
                        const target = this.resolveWidgetTargetFromPayload(payload);

                        // Create new widget (no sort_order - array position is the order)
                        const newWidget = {
                            id: payload.id,
                            type: payload.type,
                            config: payload.config || {}
                        };

                        if (operation.payload.contextType === "page") {
                            const versionId = target.versionId as string;
                            const version = state.versions[versionId];
                            const slotName = payload.slot || 'main';
                            const slotWidgets = version.widgets[slotName] || [];
                            
                            // Insert at the specified position (order), or append to end
                            const insertPosition = payload.order !== undefined && payload.order !== null 
                                ? payload.order 
                                : slotWidgets.length;
                            
                            const updatedSlotWidgets = [...slotWidgets];
                            updatedSlotWidgets.splice(insertPosition, 0, newWidget);
                            return {
                                versions: {
                                    ...state.versions,
                                    [versionId]: {
                                        ...version,
                                        widgets: {
                                            ...version.widgets,
                                            [slotName]: updatedSlotWidgets
                                        }
                                    }
                                },
                                metadata: { ...state.metadata, isDirty: true }
                            };
                        } else if (operation.payload.contextType === "object") {
                            const objectId = (target as any).objectId as string;
                            const objValue = (state as any).objects[objectId];
                            const slotName = payload.slot || 'main';
                            const slotWidgets = (objValue.widgets?.[slotName] || []);
                            
                            // Insert at the specified position (order), or append to end
                            const insertPosition = payload.order !== undefined && payload.order !== null 
                                ? payload.order 
                                : slotWidgets.length;
                            
                            const updatedSlotWidgets = [...slotWidgets];
                            updatedSlotWidgets.splice(insertPosition, 0, newWidget);
                            return {
                                objects: {
                                    ...(state as any).objects,
                                    [objectId]: {
                                        ...objValue,
                                        widgets: {
                                            ...(objValue.widgets || {}),
                                            [slotName]: updatedSlotWidgets
                                        }
                                    }
                                },
                                metadata: { ...state.metadata, isDirty: true }
                            } as any;
                        }

                        return state;
                    });
                    break;

                case OperationTypes.UPDATE_WIDGET_CONFIG:
                    this.setState(operation, state => {
                        const payload = operation.payload as UpdateWidgetConfigPayload;
                        const target = this.resolveWidgetTargetFromPayload(payload);
                        const widgetId = payload.id;
                        const now = new Date().toISOString();
                        const slotName = payload.slotName || ''; // Legacy fallback

                        // Guard against nested config objects
                        if (payload.config) {
                            payload.config = this.validateAndCleanConfig(payload.config, 'UPDATE_WIDGET_CONFIG');
                        }

                        if (target.versionId) {
                            const version = state.versions[target.versionId];
                            
                            // NEW: Path-based approach (supports infinite nesting)
                            if (payload.widgetPath && isValidPath(payload.widgetPath)) {
                                const updatedWidgets = this.updateWidgetAtPath(
                                    version.widgets,
                                    payload.widgetPath,
                                    (widget) => ({
                                        ...widget,
                                        ...(payload.config && { config: { ...widget.config, ...payload.config } }),
                                        ...(payload.widgetUpdates || {}),
                                        updatedAt: now
                                    })
                                );
                                
                                return {
                                    versions: {
                                        ...state.versions,
                                        [target.versionId]: {
                                            ...version,
                                            widgets: updatedWidgets
                                        }
                                    },
                                    metadata: { ...state.metadata, isDirty: true }
                                };
                            }
                            
                            // LEGACY: Single-level parent/child approach (deprecated)
                            if (payload.parentWidgetId) {
                                // Find and update nested widget within parent widget's config
                                const parentSlot = payload.parentSlotName || slotName;
                                const parentWidgets = version.widgets[parentSlot] || [];
                                const parentIndex = parentWidgets.findIndex(w => w.id === payload.parentWidgetId);
                                
                                if (parentIndex === -1) {
                                    throw new Error(`Parent widget ${payload.parentWidgetId} not found in slot ${parentSlot} of version ${target.versionId}`);
                                }
                                
                                const parentWidget = parentWidgets[parentIndex];
                                const nestedSlots = parentWidget.config?.slots || {};
                                const nestedWidgets = nestedSlots[slotName] || [];
                                const nestedIndex = nestedWidgets.findIndex((w: any) => w.id === widgetId);
                                
                                if (nestedIndex === -1) {
                                    throw new Error(`Nested widget ${widgetId} not found in parent ${payload.parentWidgetId} slot ${slotName}`);
                                }
                                
                                // Update the nested widget
                                const updatedNestedWidgets = [...nestedWidgets];
                                const existingNestedWidget = updatedNestedWidgets[nestedIndex];
                                updatedNestedWidgets[nestedIndex] = {
                                    ...existingNestedWidget,
                                    ...(payload.config && { config: { ...existingNestedWidget.config, ...payload.config } }),
                                    ...(payload.widgetUpdates || {}),
                                    updatedAt: now
                                };
                                
                                // Update parent widget's config with updated nested widgets
                                const updatedParentWidget = {
                                    ...parentWidget,
                                    config: {
                                        ...parentWidget.config,
                                        slots: {
                                            ...nestedSlots,
                                            [slotName]: updatedNestedWidgets
                                        }
                                    },
                                    updatedAt: now
                                };
                                
                                // Update parent in top-level slots
                                const updatedParentWidgets = [...parentWidgets];
                                updatedParentWidgets[parentIndex] = updatedParentWidget;
                                
                                return {
                                    versions: {
                                        ...state.versions,
                                        [target.versionId]: {
                                            ...version,
                                            widgets: {
                                                ...version.widgets,
                                                [parentSlot]: updatedParentWidgets
                                            }
                                        }
                                    },
                                    metadata: { ...state.metadata, isDirty: true }
                                };
                            }
                            
                            // Not nested - handle as top-level widget
                            const slotWidgets = version.widgets[slotName] || [];
                            const widgetIndex = slotWidgets.findIndex(w => w.id === widgetId);
                            if (widgetIndex === -1) {
                                throw new Error(`Widget ${widgetId} not found in slot ${slotName} of version ${target.versionId}`);
                            }
                            const updatedWidgets = [...slotWidgets];
                            const existingWidget = updatedWidgets[widgetIndex];
                            const widgetUpdate: any = {
                                ...existingWidget,
                                ...(payload.widgetUpdates || {}),
                                updatedAt: now
                            };
                            if (payload.config !== undefined) {
                                widgetUpdate.config = { ...existingWidget.config, ...payload.config };
                            }
                            updatedWidgets[widgetIndex] = widgetUpdate;
                            return {
                                versions: {
                                    ...state.versions,
                                    [target.versionId]: {
                                        ...version,
                                        widgets: {
                                            ...version.widgets,
                                            [slotName]: updatedWidgets
                                        }
                                    }
                                },
                                metadata: { ...state.metadata, isDirty: true }
                            };
                        }

                        if ((target as any).objectId) {
                            const objectId = (target as any).objectId as string;
                            const objValue = (state as any).objects[objectId];
                            const slotWidgets = (objValue.widgets?.[slotName] || []);
                            const widgetIndex = slotWidgets.findIndex((w: any) => w.id === widgetId);
                            if (widgetIndex === -1) {
                                throw new Error(`Widget ${widgetId} not found in slot ${slotName} of object version ${objectId}`);
                            }
                            const updatedWidgets = [...slotWidgets];
                            const existingObjectWidget = updatedWidgets[widgetIndex];
                            updatedWidgets[widgetIndex] = {
                                ...existingObjectWidget,
                                config: { ...existingObjectWidget.config, ...payload.config }, // Merge config instead of replacing
                                updatedAt: now
                            };
                            return {
                                objects: {
                                    ...(state as any).objects,
                                    [objectId]: {
                                        ...objValue,
                                        widgets: {
                                            ...(objValue.widgets || {}),
                                            [slotName]: updatedWidgets
                                        }
                                    }
                                },
                                metadata: { ...state.metadata, isDirty: true }
                            } as any;
                        }

                        return state;
                    });
                    break;

                case OperationTypes.MOVE_WIDGET:
                    this.setState(operation, state => {
                        const payload = operation.payload as MoveWidgetPayload;
                        const target = this.resolveWidgetTargetFromPayload(payload);
                        const widgets = payload.widgets;
                        const now = new Date().toISOString();


                        if (payload.contextType === "page" && target.versionId) {
                            const version = state.versions[target.versionId];
                            return {
                                versions: {
                                    ...state.versions,
                                    [target.versionId]: {
                                        ...version,
                                        widgets: widgets
                                    }
                                },
                                metadata: { ...state.metadata, isDirty: true }
                            };
                        }

                        if (payload.contextType === "object") {
                            const objectId = (target as any).objectId as string;
                            const objValue = (state as any).objects[objectId];
                            return {
                                objects: {
                                    ...(state as any).objects,
                                    [objectId]: {
                                        ...objValue,
                                        widgets: widgets
                                    }
                                },
                                metadata: { ...state.metadata, isDirty: true }
                            } as any;
                        }

                        return state;
                    });
                    break;

                case OperationTypes.REMOVE_WIDGET:
                    this.setState(operation, state => {
                        const payload = operation.payload as RemoveWidgetPayload;
                        const target = this.resolveWidgetTargetFromPayload(payload);
                        const widgetId = payload.id;

                        if (target.versionId) {
                            const version = state.versions[target.versionId];
                            const widgetsBySlot = { ...version.widgets };
                            Object.keys(widgetsBySlot).forEach(slotName => {
                                const arr = widgetsBySlot[slotName] || [];
                                const filtered = arr.filter(w => w.id !== widgetId)
                                    .map((w, idx) => ({ ...w, order: idx }));
                                widgetsBySlot[slotName] = filtered;
                            });
                            return {
                                versions: {
                                    ...state.versions,
                                    [target.versionId]: { ...version, widgets: widgetsBySlot }
                                },
                                metadata: { ...state.metadata, isDirty: true }
                            };
                        }

                        if ((target as any).objectId) {
                            const objectId = (target as any).objectId as string;
                            const objValue = (state as any).objects[objectId];
                            const widgetsBySlot = { ...(objValue.widgets || {}) } as any;
                            Object.keys(widgetsBySlot).forEach(slotName => {
                                const arr = widgetsBySlot[slotName] || [];
                                const filtered = arr.filter((w: any) => w.id !== widgetId)
                                    .map((w: any, idx: number) => ({ ...w, order: idx }));
                                widgetsBySlot[slotName] = filtered;
                            });
                            return {
                                objects: {
                                    ...(state as any).objects,
                                    [objectId]: { ...objValue, widgets: widgetsBySlot }
                                },
                                metadata: { ...state.metadata, isDirty: true }
                            } as any;
                        }

                        return state;
                    });
                    break;

                case OperationTypes.UPDATE_WEBPAGE_DATA:
                    this.setState(operation, state => {
                        const pageId = operation.payload.id;
                        if (!pageId) return state;

                        return {
                            pages: {
                                ...state.pages,
                                [pageId]: {
                                    ...(state.pages[pageId] || {}),
                                    ...operation.payload.updates,
                                    updatedAt: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.UPDATE_PAGE_VERSION_DATA:
                    this.setState(operation, state => {
                        const versionId = operation.payload.id;
                        if (!versionId) return state;

                        return {
                            versions: {
                                ...state.versions,
                                [versionId]: {
                                    ...(state.versions[versionId] || {}),
                                    ...operation.payload.updates,
                                    updatedAt: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.UPDATE_OBJECT:
                    this.setState(operation, state => {
                        const objectId = (operation.payload as any).id;
                        if (!objectId) return state;
                        return {
                            objects: {
                                ...(state as any).objects,
                                [objectId]: {
                                    ...((state as any).objects?.[objectId] || {}),
                                    ...(operation.payload as any).updates,
                                    updatedAt: new Date().toISOString()
                                }
                            }
                        } as any;
                    });
                    break;

                case OperationTypes.UPDATE_OBJECT_VERSION:
                    this.setState(operation, state => {
                        const objectId = (operation.payload as any).id;
                        if (!objectId) return state;
                        return {
                            objects: {
                                ...(state as any).objects,
                                [objectId]: {
                                    ...((state as any).objects?.[objectId] || {}),
                                    ...(operation.payload as any).updates,
                                    updatedAt: new Date().toISOString()
                                }
                            },
                            metadata: { ...state.metadata, isDirty: true }
                        } as any;
                    });
                    break;

                // Object context operations
                case OperationTypes.INIT_OBJECT:
                    this.setState(operation, state => {
                        const { id, data } = operation.payload as any;
                        if (!id || !data) {
                            throw new ValidationError(operation,
                                'ID and data are required for INIT_OBJECT',
                                { payload: operation.payload }
                            );
                        }
                        return {
                            objects: {
                                ...(state as any).objects,
                                [id]: { ...data, id, updatedAt: data.updatedAt || new Date().toISOString() }
                            },
                            metadata: {
                                ...state.metadata,
                                currentObjectId: id,
                                isDirty: false
                            }
                        } as any;
                    });
                    break;

                case OperationTypes.SWITCH_OBJECT_VERSION:
                    this.setState(operation, state => {
                        const { objectId, versionId } = operation.payload as any;
                        const objects = (state as any).objectVersions?.[versionId];
                        if (!objects) {
                            throw new Error(`Object version ${versionId} not found`);
                        }
                        if (objects.objectId !== objectId) {
                            throw new Error(`Object version ${versionId} does not belong to object ${objectId}`);
                        }
                        return {
                            metadata: {
                                ...state.metadata,
                                currentObjectId: objectId,
                                isDirty: false
                            }
                        } as any;
                    });
                    break;

                // Theme operations
                case OperationTypes.INIT_THEME:
                    this.setState(operation, state => {
                        const { id, data } = operation.payload;
                        if (!id || !data) {
                            throw new ValidationError(operation,
                                'ID and data are required for INIT_THEME',
                                { payload: operation.payload }
                            );
                        }

                        return {
                            themes: {
                                ...state.themes,
                                [id]: {
                                    ...data,
                                    id: id,
                                    updatedAt: data.updatedAt || new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                currentThemeId: id,
                                isThemeDirty: false
                            }
                        };
                    });
                    break;

                case OperationTypes.SWITCH_THEME:
                    this.setState(operation, state => {
                        const { id } = operation.payload;
                        if (!state.themes[id]) {
                            throw new ValidationError(operation,
                                `Theme ${id} not found`,
                                { payload: operation.payload }
                            );
                        }

                        return {
                            metadata: {
                                ...state.metadata,
                                currentThemeId: id,
                                isThemeDirty: false
                            }
                        };
                    });
                    break;

                case OperationTypes.UPDATE_THEME:
                    this.setState(operation, state => {
                        const { id, updates } = operation.payload;
                        const currentThemeId = id || state.metadata.currentThemeId;
                        
                        if (!currentThemeId) {
                            throw new ValidationError(operation,
                                'No theme ID provided and no current theme set',
                                { payload: operation.payload }
                            );
                        }

                        const theme = state.themes[currentThemeId];
                        if (!theme) {
                            throw new ValidationError(operation,
                                `Theme ${currentThemeId} not found`,
                                { payload: operation.payload }
                            );
                        }

                        return {
                            themes: {
                                ...state.themes,
                                [currentThemeId]: {
                                    ...theme,
                                    ...updates,
                                    updatedAt: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isThemeDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.UPDATE_THEME_FIELD:
                    this.setState(operation, state => {
                        const { id, field, value } = operation.payload;
                        const currentThemeId = id || state.metadata.currentThemeId;
                        
                        if (!currentThemeId) {
                            throw new ValidationError(operation,
                                'No theme ID provided and no current theme set',
                                { payload: operation.payload }
                            );
                        }

                        const theme = state.themes[currentThemeId];
                        if (!theme) {
                            throw new ValidationError(operation,
                                `Theme ${currentThemeId} not found`,
                                { payload: operation.payload }
                            );
                        }

                        return {
                            themes: {
                                ...state.themes,
                                [currentThemeId]: {
                                    ...theme,
                                    [field]: value,
                                    updatedAt: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isThemeDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.SET_THEME_DIRTY:
                    this.setState(operation, state => ({
                        metadata: {
                            ...state.metadata,
                            isThemeDirty: operation.payload.isDirty
                        }
                    }));
                    break;

                // Metadata operations
                case OperationTypes.SET_DIRTY:
                    this.setState(operation, state => ({
                        metadata: {
                            ...state.metadata,
                            isDirty: operation.payload.isDirty
                        }
                    }));
                    break;

                case OperationTypes.SET_LOADING:
                    this.setState(operation, state => ({
                        metadata: {
                            ...state.metadata,
                            isLoading: operation.payload.isLoading
                        }
                    }));
                    break;

                case OperationTypes.SET_OBJECT_LOADING:
                    this.setState(operation, state => ({
                        metadata: {
                            ...state.metadata,
                            isObjectLoading: operation.payload.isLoading
                        }
                    }));
                    break;


                case OperationTypes.MARK_WIDGET_DIRTY:
                    // Widget dirty state is now handled by global isDirty
                    this.setState(operation, state => ({
                        metadata: {
                            ...state.metadata,
                            isDirty: true
                        }
                    }));
                    break;


                case OperationTypes.MARK_WIDGET_SAVED:
                    this.setState(operation, state => ({
                        metadata: {
                            ...state.metadata,
                            widgetStates: {
                                ...state.metadata.widgetStates,
                                errors: {
                                    ...state.metadata.widgetStates.errors,
                                    [operation.payload.widgetId]: undefined
                                }
                            }
                        }
                    }));
                    break;

                case OperationTypes.SET_WIDGET_ERROR:
                    this.setState(operation, state => ({
                        metadata: {
                            ...state.metadata,
                            widgetStates: {
                                ...state.metadata.widgetStates,
                                errors: {
                                    ...state.metadata.widgetStates.errors,
                                    [operation.payload.widgetId]: operation.payload.error
                                }
                            }
                        }
                    }));
                    break;

                case OperationTypes.ADD_ERROR:
                    this.setState(operation, state => ({
                        metadata: {
                            ...state.metadata,
                            errors: [
                                ...state.metadata.errors,
                                {
                                    message: operation.payload.message,
                                    category: operation.payload.category || 'general',
                                    timestamp: Date.now()
                                }
                            ]
                        }
                    }));
                    break;

                case OperationTypes.ADD_WARNING:
                    this.setState(operation, state => ({
                        metadata: {
                            ...state.metadata,
                            warnings: [
                                ...state.metadata.warnings,
                                {
                                    message: operation.payload.message,
                                    category: operation.payload.category || 'general',
                                    timestamp: Date.now()
                                }
                            ]
                        }
                    }));
                    break;

                case OperationTypes.CLEAR_ERRORS:
                    this.setState(operation, state => ({
                        metadata: {
                            ...state.metadata,
                            errors: operation.payload.category
                                ? state.metadata.errors.filter(error => error.category !== operation.payload.category)
                                : []
                        }
                    }));
                    break;

                case OperationTypes.CLEAR_WARNINGS:
                    this.setState(operation, state => ({
                        metadata: {
                            ...state.metadata,
                            warnings: operation.payload.category
                                ? state.metadata.warnings.filter(warning => warning.category !== operation.payload.category)
                                : []
                        }
                    }));
                    break;

                case OperationTypes.SWITCH_VERSION:
                    this.setState(operation, state => {
                        const { versionId, pageId } = operation.payload;
                        // Validate version exists and belongs to page
                        const version = state.versions[versionId];
                        if (!version) {
                            throw new Error(`Version ${versionId} not found`);
                        }
                        if (version.pageId !== pageId) {
                            throw new Error(`Version ${versionId} does not belong to page ${pageId}`);
                        }
                        
                        return {
                            metadata: {
                                ...state.metadata,
                                currentPageId: pageId,
                                currentVersionId: versionId,
                                isDirty: false,  // Reset dirty state when switching versions
                                // Track this version as the last viewed for this page (persists across tab switches)
                                lastViewedVersions: {
                                    ...state.metadata.lastViewedVersions,
                                    [pageId]: versionId
                                }
                            }
                        };
                    });
                    break;

                case OperationTypes.RESET_STATE:
                    this.setState(operation, state => ({
                        metadata: {
                            ...state.metadata,
                            isDirty: false,
                            errors: [],
                            warnings: [],
                            widgetStates: {
                                errors: {},
                                activeEditors: []
                            }
                        }
                    }));
                    break;
            }

            // Notify operation subscribers
            this.subscriptionManager.notifyOperation(operation);
            
        } catch (error) {
            // Rollback on failure
            this.state = previousState;
            
            // Update error state
            this.setState(operation, state => ({
                metadata: {
                    ...state.metadata,
                    errors: {
                        ...state.metadata.errors,
                        [operation.type]: error
                    }
                }
            }));
            
            throw error;
        }
    }

    /**
     * Dispatch an operation
     */
    dispatch(operation: Operation): void {
        try {
            this.processOperation(operation);
        } catch (error) {
            // Update error state
            this.setState(operation, state => ({
                metadata: {
                    ...state.metadata,
                    errors: {
                        ...state.metadata.errors,
                        [operation.type]: error
                    }
                }
            }));
            throw error;
        }
    }

    /**
     * Subscribe to state changes with memoization
     */
    subscribe<T>(
        selector: StateSelector<T>,
        callback: StateUpdateCallback<T>,
        options: SubscriptionOptions = {}
    ) {
        return this.subscriptionManager.subscribe(
            (state) => this.getMemoizedSelector(selector),
            callback,
            {
                equalityFn: defaultEqualityFn,
                ...options
            }
        );
    }

    /**
     * Subscribe to operations
     */
    subscribeToOperations(
        callback: (operation: Operation) => void,
        operationTypes?: string | string[]
    ) {
        return this.subscriptionManager.subscribeToOperations(
            callback,
            operationTypes
        );
    }

    /**
     * Clear all subscriptions and caches
     */
    clear(): void {
        this.subscriptionManager.clearAllSubscriptions();
        this.selectorCache.clear();
    }

    /**
     * Validates and cleans config objects to prevent nesting issues
     * @param config - The config object to validate
     * @param operationName - Name of the operation for logging
     * @returns Clean config object
     */
    private validateAndCleanConfig(config: any, operationName: string): any {
        if (!config || typeof config !== 'object') {
            return config;
        }

        // Recursively remove extra levels of config nesting
        let cleanConfig = config;
        let nestingLevel = 0;
        const maxNestingLevels = 5; // Prevent infinite loops

        while (cleanConfig?.config && nestingLevel < maxNestingLevels) {
            console.warn(`[${operationName}] Removing config nesting level ${nestingLevel + 1}`);
            console.warn('Before cleanup:', cleanConfig);
            cleanConfig = cleanConfig.config;
            nestingLevel++;
        }

        if (nestingLevel > 0) {
            console.warn(`[${operationName}] Cleaned ${nestingLevel} levels of config nesting`);
            console.warn('After cleanup:', cleanConfig);
        }

        // Additional check for widget properties that shouldn't be in config
        if (cleanConfig && typeof cleanConfig === 'object') {
            const widgetProperties = ['id', 'name', 'type', 'widgetType', 'order', 'createdAt', 'updatedAt', 'slotName'];
            const foundWidgetProps = widgetProperties.filter(prop => cleanConfig.hasOwnProperty(prop));
            
            if (foundWidgetProps.length > 2) { // Allow some overlap but not full widget
                console.warn(`[${operationName}] Config contains widget properties: ${foundWidgetProps.join(', ')}`);
                console.warn('This suggests entire widget was passed as config');
                
                // If it has a config property, extract it
                if (cleanConfig.config) {
                    console.warn(`[${operationName}] Extracting inner config from widget-like object`);
                    cleanConfig = cleanConfig.config;
                } else {
                    // Remove widget properties from config
                    const purifiedConfig = { ...cleanConfig };
                    widgetProperties.forEach(prop => {
                        delete purifiedConfig[prop];
                    });
                    console.warn(`[${operationName}] Removed widget properties from config`);
                    cleanConfig = purifiedConfig;
                }
            }
        }

        return cleanConfig;
    }
}