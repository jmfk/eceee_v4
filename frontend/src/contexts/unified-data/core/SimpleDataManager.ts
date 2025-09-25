import { AppState, StateUpdate, StateSelector } from '../types/state';
import { Operation, ValidationResult, OperationTypes, AddWidgetPayload, UpdateWidgetConfigPayload, MoveWidgetPayload, RemoveWidgetPayload } from '../types/operations';
import { SubscriptionManager } from './SubscriptionManager';
import { StateUpdateCallback, SubscriptionOptions } from '../types/subscriptions';
import { defaultEqualityFn } from '../utils/equality';
import { ValidationError, StateError, ErrorCodes } from '../utils/errors';

export class DataManager {
    private state: AppState;
    private subscriptionManager: SubscriptionManager;
    private selectorCache = new Map<string, any>();

    constructor(initialState?: Partial<AppState>) {
        this.validateInitialState(initialState);

        this.state = {
            pages: {},
            objects: {},
            layouts: {},
            versions: {},
            objectVersions: {},
            themes: {},
            metadata: {
                lastUpdated: new Date().toISOString(),
                isLoading: false,
                isDirty: false,
                isObjectLoading: false,
                isObjectDirty: false,
                errors: [],
                warnings: [],
                widgetStates: {
                    errors: {},
                    activeEditors: []
                }
            },
            ...initialState
        } as any;

        this.subscriptionManager = new SubscriptionManager();
    }

    private validateInitialState(state?: Partial<AppState>): void {
        if (!state) return;
        // ... (keep existing validation)
    }

    getState(): AppState {
        return this.state;
    }

    private setState(operation: Operation, update: StateUpdate): void {
        const prevState = this.state;
        
        const newState = typeof update === 'function' 
            ? { ...prevState, ...update(prevState) }
            : { ...prevState, ...update };

        const hasDataChanged = this.hasDataChanged(prevState, newState);

        this.state = newState;
        
        this.state.metadata.lastUpdated = new Date().toISOString();
        
        if (hasDataChanged && !this.state.metadata.isDirty) {
            this.state.metadata.isDirty = true;
        }
        
        this.selectorCache.clear();
        
        // Notify subscribers immediately
        this.subscriptionManager.notifyStateUpdate(this.state, operation);
    }

    private hasDataChanged(prevState: AppState, newState: AppState): boolean {
        return (
            prevState.pages !== newState.pages ||
            prevState.layouts !== newState.layouts ||
            prevState.versions !== newState.versions ||
            (prevState as any).objects !== (newState as any).objects ||
            (prevState as any).objectVersions !== (newState as any).objectVersions
        );
    }

    private validateOperation(operation: Operation): ValidationResult {
        if (!operation.type || !Object.values(OperationTypes).includes(operation.type as any)) {
            throw new ValidationError(operation, 
                `Invalid operation type: ${operation.type}`,
                { type: operation.type }
            );
        }

        // Basic payload validation
        switch (operation.type) {
            case OperationTypes.ADD_WIDGET:
                if (!operation.payload?.id || !(operation.payload as any)?.type) {
                    throw new ValidationError(operation,
                        'Widget ID and type are required',
                        { payload: operation.payload }
                    );
                }
                if (!(operation.payload as any)?.contextType || !['page', 'object'].includes((operation.payload as any).contextType)) {
                    throw new ValidationError(operation,
                        'contextType is required for widget operations and must be "page" or "object"',
                        { payload: operation.payload }
                    );
                }
                if ((operation.payload as any).contextType === 'page' && !(operation.payload as any)?.pageId) {
                    throw new ValidationError(operation,
                        'pageId is required when contextType is "page"',
                        { payload: operation.payload }
                    );
                }
                if ((operation.payload as any).contextType === 'object' && !(operation.payload as any)?.objectId) {
                    throw new ValidationError(operation,
                        'objectId is required when contextType is "object"',
                        { payload: operation.payload }
                    );
                }
                break;

            case OperationTypes.UPDATE_WIDGET_CONFIG:
                if (!operation.payload?.id || !(operation.payload as any)?.config) {
                    throw new ValidationError(operation,
                        'Widget ID and config are required',
                        { payload: operation.payload }
                    );
                }
                if (!(operation.payload as any)?.contextType || !['page', 'object'].includes((operation.payload as any).contextType)) {
                    throw new ValidationError(operation,
                        'contextType is required for widget operations and must be "page" or "object"',
                        { payload: operation.payload }
                    );
                }
                if ((operation.payload as any).contextType === 'page' && !(operation.payload as any)?.pageId) {
                    throw new ValidationError(operation,
                        'pageId is required when contextType is "page"',
                        { payload: operation.payload }
                    );
                }
                if ((operation.payload as any).contextType === 'object' && !(operation.payload as any)?.objectId) {
                    throw new ValidationError(operation,
                        'objectId is required when contextType is "object"',
                        { payload: operation.payload }
                    );
                }
                break;
            
            case OperationTypes.MOVE_WIDGET:
                if (!operation.payload?.id || !(operation.payload as any)?.slot) {
                    throw new ValidationError(operation,
                        'Widget ID and slot are required',
                        { payload: operation.payload }
                    );
                }
                if (!(operation.payload as any)?.contextType || !['page', 'object'].includes((operation.payload as any).contextType)) {
                    throw new ValidationError(operation,
                        'contextType is required for widget operations and must be "page" or "object"',
                        { payload: operation.payload }
                    );
                }
                if ((operation.payload as any).contextType === 'page' && !(operation.payload as any)?.pageId) {
                    throw new ValidationError(operation,
                        'pageId is required when contextType is "page"',
                        { payload: operation.payload }
                    );
                }
                if ((operation.payload as any).contextType === 'object' && !(operation.payload as any)?.objectId) {
                    throw new ValidationError(operation,
                        'objectId is required when contextType is "object"',
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
                if (!(operation.payload as any)?.contextType || !['page', 'object'].includes((operation.payload as any).contextType)) {
                    throw new ValidationError(operation,
                        'contextType is required for widget operations and must be "page" or "object"',
                        { payload: operation.payload }
                    );
                }
                if ((operation.payload as any).contextType === 'page' && !(operation.payload as any)?.pageId) {
                    throw new ValidationError(operation,
                        'pageId is required when contextType is "page"',
                        { payload: operation.payload }
                    );
                }
                if ((operation.payload as any).contextType === 'object' && !(operation.payload as any)?.objectId) {
                    throw new ValidationError(operation,
                        'objectId is required when contextType is "object"',
                        { payload: operation.payload }
                    );
                }
                break;
        }

        return { isValid: true };
    }

    dispatch(operation: Operation): void {
        const validation = this.validateOperation(operation);
        if (!validation.isValid) {
            throw new ValidationError(
                operation,
                `Invalid operation: ${validation.errors?.[0]?.message}`,
                validation.errors
            );
        }

        operation.metadata = {
            ...operation.metadata,
            timestamp: Date.now(),
            validation
        };

        switch (operation.type) {
            case OperationTypes.SET_LOADING:
                this.setState(operation, state => ({
                    metadata: {
                        ...state.metadata,
                        isLoading: operation.payload.isLoading
                    }
                }));
                break;

            case OperationTypes.SET_DIRTY:
                this.setState(operation, state => ({
                    metadata: {
                        ...state.metadata,
                        isDirty: operation.payload.isDirty
                    }
                }));
                break;

            // ... other operation handlers (keep existing ones but make them synchronous)
            
            default:
                throw new Error(`Unsupported operation type: ${operation.type}`);
        }

        this.subscriptionManager.notifyOperation(operation);
    }

    subscribe<T>(
        selector: StateSelector<T>,
        callback: StateUpdateCallback<T>,
        options: SubscriptionOptions = {}
    ) {
        return this.subscriptionManager.subscribe(
            selector,
            callback,
            {
                equalityFn: defaultEqualityFn,
                ...options
            }
        );
    }

    subscribeToOperations(
        callback: (operation: Operation) => void,
        operationTypes?: string | string[]
    ) {
        return this.subscriptionManager.subscribeToOperations(
            callback,
            operationTypes
        );
    }

    clear(): void {
        this.subscriptionManager.clearAllSubscriptions();
        this.selectorCache.clear();
    }
}
