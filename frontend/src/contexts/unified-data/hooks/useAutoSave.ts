import { useCallback, useEffect, useRef, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { AutoSaveManager, AutoSaveConfig, AutoSaveState } from '../features/autoSave';
import { Operation } from '../types/operations';

export interface UseAutoSaveResult {
    // Auto-save state
    isAutoSaving: boolean;
    lastSaveTime: string | null;
    nextSaveTime: string | null;
    saveCount: number;
    errorCount: number;
    lastError: Error | null;
    
    // Configuration
    config: AutoSaveConfig;
    updateConfig: (newConfig: Partial<AutoSaveConfig>) => void;
    
    // Manual controls
    forceSave: () => Promise<void>;
    startAutoSave: () => void;
    stopAutoSave: () => void;
    
    // Status
    isEnabled: boolean;
    getStatus: () => {
        enabled: boolean;
        active: boolean;
        nextSave: string | null;
        stats: {
            saves: number;
            errors: number;
            lastSave: string | null;
        };
    };
}

export function useAutoSave(
    initialConfig: Partial<AutoSaveConfig> = {}
): UseAutoSaveResult {
    const { subscribeToOperations, batchDispatch } = useUnifiedData();
    const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>({
        isAutoSaving: false,
        lastSaveTime: null,
        nextSaveTime: null,
        saveCount: 0,
        errorCount: 0,
        lastError: null
    });

    // Create auto-save manager
    const autoSaveManagerRef = useRef<AutoSaveManager>();
    if (!autoSaveManagerRef.current) {
        autoSaveManagerRef.current = new AutoSaveManager(
            {
                enabled: true,
                interval: 30000, // 30 seconds
                maxRetries: 3,
                retryDelay: 5000,
                saveOnlyIfDirty: true,
                batchSimilarOperations: true,
                debounceDelay: 2000,
                ...initialConfig
            },
            {
                onSave: async (operations: Operation[]) => {
                    try {
                        await batchDispatch(operations);
                    } catch (error) {
                        console.error('❌ Auto-save: Batch save failed', error);
                        throw error;
                    }
                },
                onError: (error: Error) => {
                    console.error('❌ Auto-save error:', error);
                    setAutoSaveState(prev => ({
                        ...prev,
                        lastError: error,
                        errorCount: prev.errorCount + 1
                    }));
                }
            }
        );
    }
    const autoSaveManager = autoSaveManagerRef.current;

    // Update state when auto-save manager state changes
    useEffect(() => {
        const updateState = () => {
            setAutoSaveState(autoSaveManager.getState());
        };

        // Update state periodically
        const stateUpdateInterval = setInterval(updateState, 1000);

        return () => {
            clearInterval(stateUpdateInterval);
        };
    }, [autoSaveManager]);

    // Subscribe to operations and queue them for auto-save
    useEffect(() => {
        return subscribeToOperations((operation) => {
            // Queue operations that should trigger auto-save
            const autoSaveOperations = [
                'UPDATE_WIDGET_CONFIG',
                'MOVE_WIDGET',
                'UPDATE_PAGE',
                'UPDATE_PAGE_METADATA',
                'ADD_WIDGET',
                'REMOVE_WIDGET'
            ];

            if (autoSaveOperations.includes(operation.type)) {
                autoSaveManager.queueOperation(operation);
            }
        });
    }, [subscribeToOperations, autoSaveManager]);

    // Configuration methods
    const updateConfig = useCallback((newConfig: Partial<AutoSaveConfig>) => {
        autoSaveManager.updateConfig(newConfig);
        setAutoSaveState(autoSaveManager.getState());
    }, [autoSaveManager]);

    // Manual controls
    const forceSave = useCallback(async () => {
        await autoSaveManager.forceSave();
        setAutoSaveState(autoSaveManager.getState());
    }, [autoSaveManager]);

    const startAutoSave = useCallback(() => {
        autoSaveManager.startAutoSave();
        setAutoSaveState(autoSaveManager.getState());
    }, [autoSaveManager]);

    const stopAutoSave = useCallback(() => {
        autoSaveManager.stopAutoSave();
        setAutoSaveState(autoSaveManager.getState());
    }, [autoSaveManager]);

    // Status methods
    const getStatus = useCallback(() => ({
        enabled: autoSaveManager.getConfig().enabled,
        active: autoSaveState.isAutoSaving,
        nextSave: autoSaveState.nextSaveTime,
        stats: {
            saves: autoSaveState.saveCount,
            errors: autoSaveState.errorCount,
            lastSave: autoSaveState.lastSaveTime
        }
    }), [autoSaveManager, autoSaveState]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            autoSaveManager.destroy();
        };
    }, [autoSaveManager]);

    return {
        // State
        isAutoSaving: autoSaveState.isAutoSaving,
        lastSaveTime: autoSaveState.lastSaveTime,
        nextSaveTime: autoSaveState.nextSaveTime,
        saveCount: autoSaveState.saveCount,
        errorCount: autoSaveState.errorCount,
        lastError: autoSaveState.lastError,
        
        // Configuration
        config: autoSaveManager.getConfig(),
        updateConfig,
        
        // Controls
        forceSave,
        startAutoSave,
        stopAutoSave,
        
        // Status
        isEnabled: autoSaveManager.getConfig().enabled,
        getStatus
    };
}
