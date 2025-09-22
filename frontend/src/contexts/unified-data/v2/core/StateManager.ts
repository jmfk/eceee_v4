import { UnifiedState } from '../types/state';
import { Operation } from '../types/operations';

export interface StateUpdate {
    path: string;
    value: any;
}

export class StateManager {
    protected state: UnifiedState;
    private subscribers: Map<string, Set<(value: any) => void>> = new Map();
    protected operationSubscribers = new Set<(operation: Operation) => void>();

    constructor(initialState?: Partial<UnifiedState>) {
        this.state = {
            pages: {},
            widgets: {},
            layouts: {},
            versions: {},
            metadata: {
                isDirty: false,
                hasUnsavedChanges: false,
                isLoading: false,
                errors: {}
            },
            ...initialState
        };
    }

    getState(): UnifiedState {
        return this.state;
    }

    get(path: string): any {
        const parts = path.split('.');
        let current: any = this.state;
        
        for (const part of parts) {
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[part];
        }
        
        return current;
    }

    set(update: StateUpdate): void {
        const { path, value } = update;
        const parts = path.split('.');
        let current: any = this.state;
        
        // Navigate to the parent object
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }
        
        // Set the value
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;

        // Notify subscribers
        this.notifySubscribers(path, value);
    }

    batchUpdate(updates: StateUpdate[]): void {
        updates.forEach(update => this.set(update));
    }

    async dispatch(operation: Operation): Promise<void> {
        // Notify operation subscribers
        this.operationSubscribers.forEach(callback => callback(operation));
    }

    subscribe(path: string, callback: (value: any) => void): () => void {
        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, new Set());
        }
        this.subscribers.get(path)!.add(callback);

        return () => {
            const pathSubscribers = this.subscribers.get(path);
            if (pathSubscribers) {
                pathSubscribers.delete(callback);
                if (pathSubscribers.size === 0) {
                    this.subscribers.delete(path);
                }
            }
        };
    }

    subscribeToOperations(callback: (operation: Operation) => void): () => void {
        this.operationSubscribers.add(callback);
        return () => {
            this.operationSubscribers.delete(callback);
        };
    }

    private notifySubscribers(path: string, value: any): void {
        const subscribers = this.subscribers.get(path);
        if (subscribers) {
            subscribers.forEach(callback => callback(value));
        }
    }

    clear(): void {
        this.state = {
            pages: {},
            widgets: {},
            layouts: {},
            versions: {},
            metadata: {
                isDirty: false,
                hasUnsavedChanges: false,
                isLoading: false,
                errors: {}
            }
        };
        this.subscribers.clear();
        this.operationSubscribers.clear();
    }

    destroy(): void {
        this.clear();
    }
}