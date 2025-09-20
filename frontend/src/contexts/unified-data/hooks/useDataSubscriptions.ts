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

export function useDataSubscriptions(): UseDataSubscriptionsResult {
    const { subscribe, subscribeToOperations } = useUnifiedData();
    
    const stateSubscriptions = useRef<Map<string, {
        config: SubscriptionConfig;
        unsubscribe?: () => void;
    }>>(new Map());
    
    const operationSubscriptions = useRef<Map<string, {
        config: OperationSubscriptionConfig;
        unsubscribe?: () => void;
    }>>(new Map());

    // Create or update state subscription
    const createStateSubscription = useCallback(<T,>(config: SubscriptionConfig<T>) => {
        const existing = stateSubscriptions.current.get(config.id);
        
        // Unsubscribe existing if present
        if (existing?.unsubscribe) {
            existing.unsubscribe();
        }

        // Create new subscription if enabled
        let unsubscribe: (() => void) | undefined;
        if (config.enabled !== false) {
            unsubscribe = subscribe(
                config.selector,
                config.callback,
                config.options
            );
        }

        stateSubscriptions.current.set(config.id, {
            config,
            unsubscribe
        });
    }, [subscribe]);

    // Create or update operation subscription
    const createOperationSubscription = useCallback((config: OperationSubscriptionConfig) => {
        const existing = operationSubscriptions.current.get(config.id);
        
        // Unsubscribe existing if present
        if (existing?.unsubscribe) {
            existing.unsubscribe();
        }

        // Create new subscription if enabled
        let unsubscribe: (() => void) | undefined;
        if (config.enabled !== false) {
            unsubscribe = subscribeToOperations(
                config.callback,
                config.operationTypes
            );
        }

        operationSubscriptions.current.set(config.id, {
            config,
            unsubscribe
        });
    }, [subscribeToOperations]);

    // State subscription management
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

    // Operation subscription management
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

    // Utilities
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

    const getSubscriptionCount = useCallback(() => {
        return {
            state: stateSubscriptions.current.size,
            operations: operationSubscriptions.current.size
        };
    }, []);

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
