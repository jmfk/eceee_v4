import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { StateSelector } from '../types/state';
import { Operation } from '../types/operations';
import { StateUpdateCallback, SubscriptionOptions } from '../types/subscriptions';

export interface SubscriptionConfig<T = any> {
    id: string;
    selector: StateSelector<T>;
    callback: StateUpdateCallback<T>;
    options?: SubscriptionOptions;
    enabled?: boolean;
}

export interface OperationSubscriptionConfig {
    id: string;
    callback: (operation: Operation) => void;
    operationTypes?: string | string[];
    enabled?: boolean;
}

export interface UseDataSubscriptionsResult {
    // State subscriptions
    addSubscription: <T>(config: SubscriptionConfig<T>) => void;
    removeSubscription: (subscriptionId: string) => void;
    toggleSubscription: (subscriptionId: string) => void;
    updateSubscription: <T>(subscriptionId: string, updates: Partial<SubscriptionConfig<T>>) => void;
    
    // Operation subscriptions
    addOperationSubscription: (config: OperationSubscriptionConfig) => void;
    removeOperationSubscription: (subscriptionId: string) => void;
    toggleOperationSubscription: (subscriptionId: string) => void;
    
    // Utilities
    clearAllSubscriptions: () => void;
    getActiveSubscriptions: () => string[];
    getSubscriptionCount: () => { state: number; operations: number };
    pauseAll: () => void;
    resumeAll: () => void;
}

interface SubscriptionEntry<T = any> {
    config: SubscriptionConfig<T>;
    unsubscribe?: () => void;
}

interface OperationSubscriptionEntry {
    config: OperationSubscriptionConfig;
    unsubscribe?: () => void;
}

export function useDataSubscriptions(): UseDataSubscriptionsResult {
    const { subscribe, subscribeToOperations } = useUnifiedData();
    
    const stateSubscriptions = useRef<Map<string, SubscriptionEntry>>(new Map());
    const operationSubscriptions = useRef<Map<string, OperationSubscriptionEntry>>(new Map());

    // Create or update state subscription with improved error handling and performance
    const createStateSubscription = useCallback(<T,>(config: SubscriptionConfig<T>) => {
        try {
            const existing = stateSubscriptions.current.get(config.id);
            
            // Unsubscribe existing if present
            if (existing?.unsubscribe) {
                existing.unsubscribe();
            }

            // Create new subscription if enabled
            let unsubscribe: (() => void) | undefined;
            if (config.enabled !== false) {
                // Wrap callback to prevent unnecessary re-renders
                const wrappedCallback: StateUpdateCallback<T> = (newValue, prevValue) => {
                    if (JSON.stringify(newValue) !== JSON.stringify(prevValue)) {
                        config.callback(newValue, prevValue);
                    }
                };

                unsubscribe = subscribe(
                    config.selector,
                    wrappedCallback,
                    {
                        ...config.options,
                        debounceMs: config.options?.debounceMs ?? 100 // Default debounce
                    }
                );
            }

            stateSubscriptions.current.set(config.id, {
                config,
                unsubscribe
            });
        } catch (error) {
            console.error(`❌ Failed to create state subscription ${config.id}:`, error);
            throw error;
        }
    }, [subscribe]);

    // Create or update operation subscription with improved error handling
    const createOperationSubscription = useCallback((config: OperationSubscriptionConfig) => {
        try {
            const existing = operationSubscriptions.current.get(config.id);
            
            // Unsubscribe existing if present
            if (existing?.unsubscribe) {
                existing.unsubscribe();
            }

            // Create new subscription if enabled
            let unsubscribe: (() => void) | undefined;
            if (config.enabled !== false) {
                // Wrap callback to handle errors
                const wrappedCallback = (operation: Operation) => {
                    try {
                        config.callback(operation);
                    } catch (error) {
                        console.error(`❌ Operation subscription ${config.id} callback failed:`, error);
                    }
                };

                unsubscribe = subscribeToOperations(
                    wrappedCallback,
                    config.operationTypes
                );
            }

            operationSubscriptions.current.set(config.id, {
                config,
                unsubscribe
            });
        } catch (error) {
            console.error(`❌ Failed to create operation subscription ${config.id}:`, error);
            throw error;
        }
    }, [subscribeToOperations]);

    // State subscription management with improved type safety
    const addSubscription = useCallback(<T,>(config: SubscriptionConfig<T>) => {
        createStateSubscription(config);
    }, [createStateSubscription]);

    const removeSubscription = useCallback((subscriptionId: string) => {
        const existing = stateSubscriptions.current.get(subscriptionId);
        if (existing?.unsubscribe) {
            existing.unsubscribe();
        }
        stateSubscriptions.current.delete(subscriptionId);
    }, []);

    const toggleSubscription = useCallback((subscriptionId: string) => {
        const existing = stateSubscriptions.current.get(subscriptionId);
        if (existing) {
            const newConfig = {
                ...existing.config,
                enabled: !existing.config.enabled
            };
            createStateSubscription(newConfig);
        }
    }, [createStateSubscription]);

    const updateSubscription = useCallback(<T,>(
        subscriptionId: string, 
        updates: Partial<SubscriptionConfig<T>>
    ) => {
        const existing = stateSubscriptions.current.get(subscriptionId);
        if (existing) {
            const newConfig = {
                ...existing.config,
                ...updates,
                id: subscriptionId // Preserve ID
            } as SubscriptionConfig<T>;
            createStateSubscription(newConfig);
        }
    }, [createStateSubscription]);

    // Operation subscription management with improved error handling
    const addOperationSubscription = useCallback((config: OperationSubscriptionConfig) => {
        createOperationSubscription(config);
    }, [createOperationSubscription]);

    const removeOperationSubscription = useCallback((subscriptionId: string) => {
        const existing = operationSubscriptions.current.get(subscriptionId);
        if (existing?.unsubscribe) {
            existing.unsubscribe();
        }
        operationSubscriptions.current.delete(subscriptionId);
    }, []);

    const toggleOperationSubscription = useCallback((subscriptionId: string) => {
        const existing = operationSubscriptions.current.get(subscriptionId);
        if (existing) {
            const newConfig = {
                ...existing.config,
                enabled: !existing.config.enabled
            };
            createOperationSubscription(newConfig);
        }
    }, [createOperationSubscription]);

    // Utilities with improved performance
    const clearAllSubscriptions = useCallback(() => {
        // Clear state subscriptions
        for (const { unsubscribe } of stateSubscriptions.current.values()) {
            if (unsubscribe) unsubscribe();
        }
        stateSubscriptions.current.clear();

        // Clear operation subscriptions
        for (const { unsubscribe } of operationSubscriptions.current.values()) {
            if (unsubscribe) unsubscribe();
        }
        operationSubscriptions.current.clear();
    }, []);

    const getActiveSubscriptions = useCallback((): string[] => {
        const activeState = Array.from(stateSubscriptions.current.entries())
            .filter(([, { config }]) => config.enabled !== false)
            .map(([id]) => id);

        const activeOperations = Array.from(operationSubscriptions.current.entries())
            .filter(([, { config }]) => config.enabled !== false)
            .map(([id]) => id);

        return [...activeState, ...activeOperations];
    }, []);

    const getSubscriptionCount = useCallback(() => ({
        state: stateSubscriptions.current.size,
        operations: operationSubscriptions.current.size
    }), []);

    const pauseAll = useCallback(() => {
        // Pause all state subscriptions
        for (const [id, { config }] of stateSubscriptions.current.entries()) {
            if (config.enabled !== false) {
                updateSubscription(id, { enabled: false });
            }
        }

        // Pause all operation subscriptions
        for (const [id, { config }] of operationSubscriptions.current.entries()) {
            if (config.enabled !== false) {
                const newConfig = { ...config, enabled: false };
                createOperationSubscription(newConfig);
            }
        }
    }, [updateSubscription, createOperationSubscription]);

    const resumeAll = useCallback(() => {
        // Resume all state subscriptions
        for (const [id, { config }] of stateSubscriptions.current.entries()) {
            if (config.enabled === false) {
                updateSubscription(id, { enabled: true });
            }
        }

        // Resume all operation subscriptions
        for (const [id, { config }] of operationSubscriptions.current.entries()) {
            if (config.enabled === false) {
                const newConfig = { ...config, enabled: true };
                createOperationSubscription(newConfig);
            }
        }
    }, [updateSubscription, createOperationSubscription]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearAllSubscriptions();
        };
    }, [clearAllSubscriptions]);

    return useMemo(() => ({
        addSubscription,
        removeSubscription,
        toggleSubscription,
        updateSubscription,
        addOperationSubscription,
        removeOperationSubscription,
        toggleOperationSubscription,
        clearAllSubscriptions,
        getActiveSubscriptions,
        getSubscriptionCount,
        pauseAll,
        resumeAll
    }), [
        addSubscription,
        removeSubscription,
        toggleSubscription,
        updateSubscription,
        addOperationSubscription,
        removeOperationSubscription,
        toggleOperationSubscription,
        clearAllSubscriptions,
        getActiveSubscriptions,
        getSubscriptionCount,
        pauseAll,
        resumeAll
    ]);
}
