import { AppState, StateUpdate, StateSelector } from '../types/state';
import { Operation, ValidationResult, OperationTypes } from '../types/operations';
import { SubscriptionManager, StateUpdateCallback, SubscriptionOptions } from '../types/subscriptions';
import { defaultEqualityFn } from '../utils/equality';
import { OperationError, ValidationError, StateError, ErrorCodes, isRetryableError } from '../utils/errors';

interface PrioritizedOperation extends Operation {
    priority?: 'high' | 'normal' | 'low';
    timeoutId?: NodeJS.Timeout;
}

interface DebouncedOperation {
    operation: Operation;
    timeoutId: NodeJS.Timeout;
    resolve: (value: void | PromiseLike<void>) => void;
    reject: (reason?: any) => void;
}

/**
 * Core DataManager class responsible for state management, operations, and subscriptions
 */
export class DataManager {
    private state: AppState;
    private subscriptionManager: SubscriptionManager;
    private operationQueue: PrioritizedOperation[] = [];
    private isProcessing: boolean = false;
    private selectorCache = new Map<string, any>();
    private debouncedOperations = new Map<string, DebouncedOperation>();
    private batchedNotifications = new Set<string>();
    private batchTimeout: NodeJS.Timeout | null = null;

    constructor(initialState?: Partial<AppState>) {
        this.validateInitialState(initialState);

        // Initialize with default state structure
        this.state = {
            pages: {},
            widgets: {},
            layouts: {},
            versions: {},
            metadata: {
                lastUpdated: new Date().toISOString(),
                isLoading: false,
                errors: {},
                widgetStates: {
                    unsavedChanges: {},
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
            // Validate widget-page relationships
            if (state.widgets && state.pages) {
                Object.values(state.widgets).forEach(widget => {
                    if (widget.pageId && !state.pages?.[widget.pageId]) {
                        throw new StateError(
                            ErrorCodes.INVALID_INITIAL_STATE,
                            `Widget ${widget.id} references non-existent page ${widget.pageId}`,
                            { widgetId: widget.id, pageId: widget.pageId }
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
    private setState(update: StateUpdate): void {
        const prevState = this.state;
        
        // Handle function updates
        const newState = typeof update === 'function' 
            ? { ...prevState, ...update(prevState) }
            : { ...prevState, ...update };

        this.state = newState;
        
        // Update metadata
        this.state.metadata.lastUpdated = new Date().toISOString();
        
        // Clear selector cache
        this.selectorCache.clear();
        
        // Schedule notification
        this.scheduleStateNotification();
    }

    /**
     * Schedule batched state notifications
     */
    private scheduleStateNotification(): void {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        this.batchTimeout = setTimeout(() => {
            this.processBatchedNotifications();
        }, 0);
    }

    /**
     * Process batched notifications
     */
    private processBatchedNotifications(): void {
        this.batchTimeout = null;
        this.subscriptionManager.notifyStateUpdate(this.state);
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
            if (!operation.type || !Object.values(OperationTypes).includes(operation.type)) {
                throw new ValidationError(operation, 
                    `Invalid operation type: ${operation.type}`,
                    { type: operation.type }
                );
            }

            // Payload validation based on operation type
            switch (operation.type) {
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
    private async processOperation(operation: Operation): Promise<void> {
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

            // Add validation result to operation metadata
            operation.metadata = {
                ...operation.metadata,
                timestamp: Date.now(),
                validation
            };

            // Process based on operation type
            switch (operation.type) {
                case OperationTypes.UPDATE_WIDGET_CONFIG:
                    this.setState(state => ({
                        widgets: {
                            ...state.widgets,
                            [operation.payload.id]: {
                                ...state.widgets[operation.payload.id],
                                config: {
                                    ...state.widgets[operation.payload.id].config,
                                    ...operation.payload.config
                                }
                            }
                        },
                        metadata: {
                            ...state.metadata,
                            widgetStates: {
                                ...state.metadata.widgetStates,
                                unsavedChanges: {
                                    ...state.metadata.widgetStates.unsavedChanges,
                                    [operation.payload.id]: true
                                }
                            }
                        }
                    }));
                    break;

                case OperationTypes.MOVE_WIDGET:
                    this.setState(state => {
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

                case OperationTypes.BATCH:
                    if (Array.isArray(operation.payload)) {
                        for (const op of operation.payload) {
                            await this.processOperation(op);
                        }
                    }
                    break;
            }

            // Notify operation subscribers
            this.subscriptionManager.notifyOperation(operation);
            
        } catch (error) {
            // Rollback on failure
            this.state = previousState;
            
            // Update error state
            this.setState(state => ({
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
     * Process operation with retry logic
     */
    private async executeOperation(
        operation: Operation,
        retries = 3,
        delay = 1000
    ): Promise<void> {
        try {
            await this.processOperation(operation);
        } catch (error) {
            if (retries > 0 && isRetryableError(error)) {
                await new Promise(resolve => setTimeout(resolve, delay));
                await this.executeOperation(operation, retries - 1, delay * 2);
            } else {
                throw error;
            }
        }
    }

    /**
     * Process operation queue with priority handling
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.operationQueue.length === 0) return;

        this.isProcessing = true;
        
        try {
            // Sort by priority
            this.operationQueue.sort((a, b) => {
                const priorityMap = { high: 0, normal: 1, low: 2 };
                return priorityMap[a.priority || 'normal'] - priorityMap[b.priority || 'normal'];
            });

            while (this.operationQueue.length > 0) {
                const operation = this.operationQueue.shift()!;
                await this.executeOperation(operation);
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Dispatch an operation with optional debouncing
     */
    async dispatch(
        operation: Operation,
        options: { 
            priority?: 'high' | 'normal' | 'low';
            debounce?: number;
        } = {}
    ): Promise<void> {
        const { priority = 'normal', debounce } = options;

        if (debounce) {
            return this.debounceOperation(operation, debounce);
        }

        // Queue the operation with priority
        this.operationQueue.push({ ...operation, priority });
        
        // Process queue
        await this.processQueue();
    }

    /**
     * Debounce an operation
     */
    private debounceOperation(operation: Operation, delay: number): Promise<void> {
        const key = `${operation.type}_${operation.payload?.id}`;
        
        // Clear existing debounced operation
        if (this.debouncedOperations.has(key)) {
            const existing = this.debouncedOperations.get(key)!;
            clearTimeout(existing.timeoutId);
            existing.reject(new Error('Operation superseded'));
            this.debouncedOperations.delete(key);
        }

        return new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(async () => {
                try {
                    await this.processOperation(operation);
                    this.debouncedOperations.delete(key);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }, delay);

            this.debouncedOperations.set(key, {
                operation,
                timeoutId,
                resolve,
                reject
            });
        });
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
            (state) => this.getMemoizedSelector(() => selector(state)),
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
        this.debouncedOperations.forEach(({ timeoutId }) => clearTimeout(timeoutId));
        this.debouncedOperations.clear();
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
    }
}