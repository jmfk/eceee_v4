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
            widgets: {},
            layouts: {},
            versions: {},
            content: {},
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
     * Validate initial state
     */
    private validateInitialState(state?: Partial<AppState>): void {
        if (!state) return;

        try {
            // Basic state validation
            if (state.widgets) {
                Object.values(state.widgets).forEach(widget => {
                    if (!widget.id || !widget.type) {
                        throw new StateError(
                            ErrorCodes.INVALID_INITIAL_STATE,
                            `Widget missing required fields: id or type`,
                            { widget }
                        );
                    }
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
            prevState.widgets !== newState.widgets ||
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
                    if (!operation.payload?.id || !operation.payload?.config) {  

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
                case OperationTypes.INIT_WIDGET:
                    // Initialize widget without side effects (no dirty state change)
                    this.setState(operation, state => ({
                        widgets: {
                            ...state.widgets,
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
                    }));
                    break;

                case OperationTypes.ADD_WIDGET:
                    this.setState(operation, state => ({
                        widgets: {
                            ...state.widgets,
                            [operation.payload.id]: {
                                id: operation.payload.id,
                                type: operation.payload.type,
                                config: operation.payload.config || {},
                                slot: operation.payload.slot || 'main',
                                order: operation.payload.order || 0,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }
                        },
                        metadata: {
                            ...state.metadata,
                            isDirty: true
                        }
                    }));
                    break;

                case OperationTypes.UPDATE_WIDGET_CONFIG:
                    this.setState(operation, state => {
                        const widget = state.widgets[operation.payload.id];
                        if (!widget) {
                            throw new Error(`Widget ${operation.payload.id} not found. state: ${state}`);
                        }
                        return {
                            widgets: {
                                ...state.widgets,
                                [operation.payload.id]: {
                                    ...widget,
                                    config: {
                                        ...widget.config,
                                        ...operation.payload.config
                                    },
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

                case OperationTypes.MOVE_WIDGET:
                    this.setState(operation, state => {
                        const widget = state.widgets[operation.payload.id];
                        if (!widget) return state;

                        return {
                            widgets: {
                                ...state.widgets,
                                [operation.payload.id]: {
                                    ...widget,
                                    slot: operation.payload.slot,
                                    order: operation.payload.order
                                }
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