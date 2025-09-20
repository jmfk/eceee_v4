import { useCallback, useEffect, useRef, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { DevToolsManager, DevToolsConfig } from '../devtools/DevToolsManager';
import { OperationLogger, ReplaySession } from '../devtools/OperationLogger';
import { Operation } from '../types/operations';
import { AppState } from '../types/state';

export interface UseDevToolsResult {
    // DevTools state
    isEnabled: boolean;
    isRecording: boolean;
    isReplaying: boolean;
    
    // Recording controls
    startRecording: (sessionName?: string) => string;
    stopRecording: () => ReplaySession | null;
    
    // Replay controls
    replaySession: (sessionId: string, speed?: number) => Promise<void>;
    
    // State inspection
    getCurrentState: () => AppState;
    getStateHistory: () => any[];
    timeTravel: (snapshotId: string) => void;
    
    // Operation analysis
    getOperationLogs: () => any[];
    getOperationStats: () => Record<string, any>;
    getPerformanceInsights: () => any;
    searchOperations: (criteria: any) => any[];
    
    // Session management
    getSessions: () => ReplaySession[];
    deleteSession: (sessionId: string) => void;
    exportSession: (sessionId: string) => string;
    importSession: (sessionData: string) => string;
    
    // DevTools controls
    enableDevTools: (enabled: boolean) => void;
    updateConfig: (config: Partial<DevToolsConfig>) => void;
    clearDebugData: () => void;
    
    // Visual debugging
    highlightOperation: (operationId: string) => void;
    showStateInspector: () => void;
    showPerformanceProfiler: () => void;
    
    // Export/Import
    exportDebugData: () => any;
    importDebugData: (data: any) => void;
}

export function useDevTools(): UseDevToolsResult {
    const { state, subscribeToOperations } = useUnifiedData();
    const [isEnabled, setIsEnabled] = useState(process.env.NODE_ENV === 'development');
    const [isRecording, setIsRecording] = useState(false);
    const [isReplaying, setIsReplaying] = useState(false);

    // Create DevTools managers
    const devToolsManagerRef = useRef<DevToolsManager>();
    const operationLoggerRef = useRef<OperationLogger>();

    if (!devToolsManagerRef.current) {
        devToolsManagerRef.current = new DevToolsManager({
            enabled: isEnabled,
            captureStackTraces: true,
            enableTimeTravel: true,
            enablePerformanceProfiling: true
        });
    }

    if (!operationLoggerRef.current) {
        operationLoggerRef.current = new OperationLogger();
    }

    const devToolsManager = devToolsManagerRef.current;
    const operationLogger = operationLoggerRef.current;

    // Monitor operations and log them
    useEffect(() => {
        if (!isEnabled) return;

        return subscribeToOperations((operation) => {
            const startTime = performance.now();
            const stateBefore = state;

            // Log operation start
            setTimeout(() => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                const stateAfter = state; // Current state after operation

                // Log to DevTools manager
                devToolsManager.logOperation(
                    operation,
                    stateBefore,
                    stateAfter,
                    duration
                );

                // Log to operation logger if recording
                if (isRecording) {
                    operationLogger.logOperation(
                        operation,
                        stateBefore,
                        stateAfter,
                        duration,
                        true // Assume success for now
                    );
                }
            }, 0);
        });
    }, [isEnabled, isRecording, subscribeToOperations, state, devToolsManager, operationLogger]);

    // Recording controls
    const startRecording = useCallback((sessionName?: string): string => {
        const sessionId = operationLogger.startRecording(sessionName);
        setIsRecording(true);
        return sessionId;
    }, [operationLogger]);

    const stopRecording = useCallback((): ReplaySession | null => {
        const session = operationLogger.stopRecording();
        setIsRecording(false);
        return session;
    }, [operationLogger]);

    // Replay controls
    const replaySession = useCallback(async (sessionId: string, speed: number = 1): Promise<void> => {
        setIsReplaying(true);
        try {
            await operationLogger.replaySession(sessionId, async (loggedOp, index) => {
                console.log(`🔄 Replaying: ${loggedOp.operation.type} (${index + 1})`);
                // Here you could re-dispatch the operation to see the effect
            }, speed);
        } finally {
            setIsReplaying(false);
        }
    }, [operationLogger]);

    // State inspection
    const getCurrentState = useCallback((): AppState => {
        return state;
    }, [state]);

    const getStateHistory = useCallback(() => {
        return devToolsManager.getDevToolsData().snapshots;
    }, [devToolsManager]);

    const timeTravel = useCallback((snapshotId: string) => {
        devToolsManager.timeTravel(snapshotId);
    }, [devToolsManager]);

    // Operation analysis
    const getOperationLogs = useCallback(() => {
        return devToolsManager.getDevToolsData().operations;
    }, [devToolsManager]);

    const getOperationStats = useCallback(() => {
        return devToolsManager.getOperationStats();
    }, [devToolsManager]);

    const getPerformanceInsights = useCallback(() => {
        return devToolsManager.getPerformanceInsights();
    }, [devToolsManager]);

    const searchOperations = useCallback((criteria: any) => {
        return operationLogger.searchOperations(criteria);
    }, [operationLogger]);

    // Session management
    const getSessions = useCallback((): ReplaySession[] => {
        return operationLogger.getSessions();
    }, [operationLogger]);

    const deleteSession = useCallback((sessionId: string) => {
        operationLogger.deleteSession(sessionId);
    }, [operationLogger]);

    const exportSession = useCallback((sessionId: string): string => {
        return operationLogger.exportSession(sessionId);
    }, [operationLogger]);

    const importSession = useCallback((sessionData: string): string => {
        return operationLogger.importSession(sessionData);
    }, [operationLogger]);

    // DevTools controls
    const enableDevTools = useCallback((enabled: boolean) => {
        setIsEnabled(enabled);
    }, []);

    const updateConfig = useCallback((config: Partial<DevToolsConfig>) => {
        // Update DevTools manager config
        devToolsManager.config = { ...devToolsManager.config, ...config };
    }, [devToolsManager]);

    const clearDebugData = useCallback(() => {
        devToolsManager.clearDebugData();
        operationLogger.clearAllSessions();
    }, [devToolsManager, operationLogger]);

    // Visual debugging
    const highlightOperation = useCallback((operationId: string) => {
        console.log(`🎯 Highlighting operation: ${operationId}`);
        // This could trigger visual highlighting in the UI
    }, []);

    const showStateInspector = useCallback(() => {
        console.log('🔍 State Inspector:', state);
        console.table(Object.keys(state).map(key => ({
            Entity: key,
            Count: Object.keys(state[key as keyof AppState] || {}).length,
            Size: JSON.stringify(state[key as keyof AppState]).length
        })));
    }, [state]);

    const showPerformanceProfiler = useCallback(() => {
        const stats = getOperationStats();
        console.log('📊 Performance Profile:');
        console.table(stats);
        
        const insights = getPerformanceInsights();
        console.log('💡 Performance Insights:', insights);
    }, [getOperationStats, getPerformanceInsights]);

    // Export/Import
    const exportDebugData = useCallback(() => {
        return {
            devTools: devToolsManager.exportDebugData(),
            sessions: operationLogger.getSessions(),
            exportedAt: new Date().toISOString()
        };
    }, [devToolsManager, operationLogger]);

    const importDebugData = useCallback((data: any) => {
        if (data.devTools) {
            devToolsManager.importDebugData(data.devTools);
        }
        if (data.sessions) {
            data.sessions.forEach((session: ReplaySession) => {
                operationLogger.importSession(JSON.stringify({ session }));
            });
        }
    }, [devToolsManager, operationLogger]);

    // Expose to window for browser console access
    useEffect(() => {
        if (isEnabled && typeof window !== 'undefined') {
            (window as any).__UNIFIED_DATA_DEVTOOLS_HOOK__ = {
                startRecording,
                stopRecording,
                replaySession,
                getOperationStats,
                showStateInspector,
                showPerformanceProfiler,
                exportDebugData,
                clearDebugData,
                getCurrentState,
                searchOperations
            };
        }

        return () => {
            if (typeof window !== 'undefined') {
                delete (window as any).__UNIFIED_DATA_DEVTOOLS_HOOK__;
            }
        };
    }, [isEnabled, startRecording, stopRecording, replaySession, getOperationStats, showStateInspector, showPerformanceProfiler, exportDebugData, clearDebugData, getCurrentState, searchOperations]);

    return {
        // State
        isEnabled,
        isRecording,
        isReplaying,
        
        // Recording
        startRecording,
        stopRecording,
        
        // Replay
        replaySession,
        
        // State inspection
        getCurrentState,
        getStateHistory,
        timeTravel,
        
        // Operation analysis
        getOperationLogs,
        getOperationStats,
        getPerformanceInsights,
        searchOperations,
        
        // Session management
        getSessions,
        deleteSession,
        exportSession,
        importSession,
        
        // Controls
        enableDevTools,
        updateConfig,
        clearDebugData,
        
        // Visual debugging
        highlightOperation,
        showStateInspector,
        showPerformanceProfiler,
        
        // Export/Import
        exportDebugData,
        importDebugData
    };
}
