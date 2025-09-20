import { useCallback, useState, useEffect } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { Operation } from '../types/operations';

export interface UseAPIIntegrationResult {
    // API status
    isOnline: boolean;
    apiErrors: Record<string, Error>;
    pendingOperations: Operation[];
    
    // Configuration
    enableOptimisticUpdates: (enabled: boolean) => void;
    enableAPIIntegration: (enabled: boolean) => void;
    
    // Manual operations
    retryFailedOperations: () => Promise<void>;
    clearAPIErrors: () => void;
    
    // Offline support
    queueOfflineOperation: (operation: Operation) => void;
    syncOfflineOperations: () => Promise<void>;
    
    // Status
    getAPIStatus: () => {
        online: boolean;
        errors: number;
        pending: number;
        lastSync: string | null;
    };
}

export function useAPIIntegration(): UseAPIIntegrationResult {
    const { dispatch, subscribeToOperations, state } = useUnifiedData();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [apiErrors, setAPIErrors] = useState<Record<string, Error>>({});
    const [pendingOperations, setPendingOperations] = useState<Operation[]>([]);
    const [lastSync, setLastSync] = useState<string | null>(null);

    // Monitor online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Get state from context
    const { errors: contextErrors } = useUnifiedData();

    // Monitor API errors from operations
    useEffect(() => {
        return subscribeToOperations((operation) => {
            // Check if operation resulted in error
            const operationError = contextErrors[operation.type];
            if (operationError) {
                setAPIErrors(prev => ({
                    ...prev,
                    [operation.type]: operationError
                }));
            }
        });
    }, [subscribeToOperations, contextErrors]);

    // Auto-sync when coming back online
    useEffect(() => {
        if (isOnline && pendingOperations.length > 0) {
            syncOfflineOperations();
        }
    }, [isOnline]);

    // Configuration methods
    const enableOptimisticUpdates = useCallback((enabled: boolean) => {
        // This would configure the DataManager
    }, []);

    const enableAPIIntegration = useCallback((enabled: boolean) => {
        // This would configure the DataManager
    }, []);

    // Retry failed operations
    const retryFailedOperations = useCallback(async () => {
        const failedOperations = Object.keys(apiErrors);
        
        for (const operationType of failedOperations) {
            try {
                // Re-dispatch the operation
                // Note: We'd need to store the original operation to retry it
                
                // Clear the error if retry succeeds
                setAPIErrors(prev => {
                    const { [operationType]: _, ...rest } = prev;
                    return rest;
                });
            } catch (error) {
                console.error(`❌ Retry failed for ${operationType}:`, error);
            }
        }
    }, [apiErrors]);

    // Clear API errors
    const clearAPIErrors = useCallback(() => {
        setAPIErrors({});
        
        // Also clear errors in UnifiedDataContext
        dispatch({
            type: 'CLEAR_ERRORS',
            payload: undefined
        });
    }, [dispatch]);

    // Queue operation for offline execution
    const queueOfflineOperation = useCallback((operation: Operation) => {
        setPendingOperations(prev => [...prev, operation]);
    }, []);

    // Sync offline operations when back online
    const syncOfflineOperations = useCallback(async () => {
        if (!isOnline || pendingOperations.length === 0) return;


        const operations = [...pendingOperations];
        setPendingOperations([]);

        for (const operation of operations) {
            try {
                await dispatch(operation);
            } catch (error) {
                console.error(`❌ Failed to sync operation: ${operation.type}`, error);
                // Re-queue failed operations
                setPendingOperations(prev => [...prev, operation]);
            }
        }

        setLastSync(new Date().toISOString());
    }, [isOnline, pendingOperations, dispatch]);

    // Get API status
    const getAPIStatus = useCallback(() => ({
        online: isOnline,
        errors: Object.keys(apiErrors).length,
        pending: pendingOperations.length,
        lastSync
    }), [isOnline, apiErrors, pendingOperations, lastSync]);

    return {
        isOnline,
        apiErrors,
        pendingOperations,
        enableOptimisticUpdates,
        enableAPIIntegration,
        retryFailedOperations,
        clearAPIErrors,
        queueOfflineOperation,
        syncOfflineOperations,
        getAPIStatus
    };
}
