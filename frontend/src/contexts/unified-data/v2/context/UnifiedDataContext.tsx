import React, { createContext, useContext, useRef, useEffect } from 'react';
import { StateManager, StateUpdate } from '../core/StateManager';
import { PathString } from '../types/paths';

interface UnifiedDataContextValue {
    // Core operations
    get: (path: PathString) => any;
    set: (update: StateUpdate) => void;
    batchUpdate: (updates: StateUpdate[]) => void;
    dispatch: (operation: any) => Promise<void>;
    getState: () => any;

    // Subscriptions
    subscribe: StateManager['subscribe'];
    subscribeToOperations: (callback: (operation: any) => void, operationTypes?: string[]) => () => void;
}

const UnifiedDataContext = createContext<UnifiedDataContextValue | null>(null);

interface UnifiedDataProviderProps {
    children: React.ReactNode;
    initialState?: Record<PathString, any>;
}

export function UnifiedDataProvider({ children, initialState }: UnifiedDataProviderProps) {
    // Create StateManager instance
    const managerRef = useRef<StateManager | null>(null);
    if (!managerRef.current) {
        managerRef.current = new StateManager();

        // Initialize with any provided state
        if (initialState) {
            Object.entries(initialState).forEach(([path, value]) => {
                managerRef.current!.set({ path: path as PathString, value });
            });
        }
    }
    const manager = managerRef.current;

    // Clean up on unmount
    useEffect(() => {
        return () => {
            manager.destroy();
        };
    }, [manager]);

    const contextValue: UnifiedDataContextValue = {
        get: (path) => manager.get(path),
        set: (update) => manager.set(update),
        batchUpdate: (updates) => manager.batchUpdate(updates),
        dispatch: (operation) => manager.dispatch(operation),
        getState: () => manager.getState(),
        subscribe: (path, callback, options) => manager.subscribe(path, callback, options),
        subscribeToOperations: (callback, operationTypes) => manager.subscribeToOperations(callback, operationTypes)
    };

    return (
        <UnifiedDataContext.Provider value={contextValue}>
            {children}
        </UnifiedDataContext.Provider>
    );
}

export function useUnifiedData(): UnifiedDataContextValue {
    const context = useContext(UnifiedDataContext);
    if (!context) {
        throw new Error('useUnifiedData must be used within UnifiedDataProvider');
    }
    return context;
}
