import { AppState, StateUpdate, StateSelector } from '../types/state';
import { Operation, ValidationResult, OperationTypes } from '../types/operations';
import { SubscriptionManager } from './SubscriptionManager';
import { StateUpdateCallback, SubscriptionOptions } from '../types/subscriptions';
import { defaultEqualityFn } from '../utils/equality';
import { OperationError, ValidationError, StateError, ErrorCodes, isRetryableError } from '../utils/errors';

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
            layouts: {},
            versions: {},
            themes: {},
            metadata: {
                lastUpdated: new Date().toISOString(),
                isLoading: false,
                isDirty: false,
                errors: [],
                warnings: [],
                widgetStates: {
                    errors: {},
                    activeEditors: []
                }
            },
            ...initialState
        };
        // Initialize subscription manager
        this.subscriptionManager = new SubscriptionManager();
    }

    /**
     * Get and validate the current editing context
     */
    private getCurrentContext(): { pageId: string; versionId: string } {
        const { currentPageId, currentVersionId } = this.state.metadata;
        
        if (!currentPageId || !currentVersionId) {
            throw new StateError(
                ErrorCodes.NO_ACTIVE_CONTEXT,
                'No active editing context. Use SWITCH_VERSION to select a version first.',
                { currentPageId, currentVersionId }
            );
        }

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
            prevState.versions !== newState.versions
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
                case OperationTypes.INIT_WIDGET:
                case OperationTypes.ADD_WIDGET:
                    if (!operation.payload?.id || !operation.payload?.type) {
                        throw new ValidationError(operation,
                            'Widget ID and type are required',
                            { payload: operation.payload }
                        );
                    }
                    break;

                case OperationTypes.UPDATE_WIDGET_CONFIG:
                    if (!operation.payload?.id || !operation.payload?.slotName|| !operation.payload?.config) {  

                        throw new ValidationError(operation,
                            'Widget ID and config are required',
                            { payload: operation.payload }
                        );
                    }
                    break;
                
                case OperationTypes.MOVE_WIDGET:
                    if (!operation.payload?.id || !operation.payload?.slot) {
                        throw new ValidationError(operation,
                            'Widget ID and slot are required',
                            { payload: operation.payload }
                        );
                    }
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
                                    updated_at: data.updated_at || new Date().toISOString()
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
                                    updated_at: data.updated_at || new Date().toISOString()
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
                        const { versionId } = this.getCurrentContext();
                        const version = state.versions[versionId];
                        
                        return {
                            versions: {
                                ...state.versions,
                                [versionId]: {
                                    ...version,
                                    widgets: {
                                        ...version.widgets,
                                        [operation.payload.id]: {
                                            id: operation.payload.id,
                                            type: operation.payload.type,
                                            config: operation.payload.config || {},
                                            slot: operation.payload.slot || 'main',
                                            order: operation.payload.order || 0,
                                            created_at: new Date().toISOString(),
                                            updated_at: new Date().toISOString()
                                        }
                                    }
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.UPDATE_WIDGET_CONFIG:
                    this.setState(operation, state => {
                        const { versionId } = this.getCurrentContext();
                        const version = state.versions[versionId];
                        const slotName = operation.payload.slotName;
                        const widgetId = operation.payload.id;
                        // Get widgets array for the slot
                        const slotWidgets = version.widgets[slotName] || [];
                        
                        // Find widget in the slot
                        const widgetIndex = slotWidgets.findIndex(w => w.id === widgetId);
                        if (widgetIndex === -1) {
                            throw new Error(`Widget ${widgetId} not found in slot ${slotName} of version ${versionId}`);
                        }
                        
                        // Update widget config
                        const updatedWidgets = [...slotWidgets];
                        updatedWidgets[widgetIndex] = {
                            ...updatedWidgets[widgetIndex],
                            config: {
                                ...updatedWidgets[widgetIndex].config,
                                ...operation.payload.config
                            },
                            updated_at: new Date().toISOString()
                        };
                        
                        return {
                            versions: {
                                ...state.versions,
                                [versionId]: {
                                    ...version,
                                    widgets: {
                                        ...version.widgets,
                                        [slotName]: updatedWidgets
                                    }
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
                    break;

                case OperationTypes.MOVE_WIDGET:
                    this.setState(operation, state => {
                        const { versionId } = this.getCurrentContext();
                        const version = state.versions[versionId];
                        const widget = version.widgets[operation.payload.id];
                        
                        if (!widget) {
                            throw new Error(`Widget ${operation.payload.id} not found in version ${versionId}`);
                        }

                        return {
                            versions: {
                                ...state.versions,
                                [versionId]: {
                                    ...version,
                                    widgets: {
                                        ...version.widgets,
                                        [operation.payload.id]: {
                                            ...widget,
                                            slot: operation.payload.slot,
                                            order: operation.payload.order,
                                            updated_at: new Date().toISOString()
                                        }
                                    }
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
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
                                    updated_at: new Date().toISOString()
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
                                    updated_at: new Date().toISOString()
                                }
                            },
                            metadata: {
                                ...state.metadata,
                                isDirty: true
                            }
                        };
                    });
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
                                isDirty: false  // Reset dirty state when switching versions
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
}