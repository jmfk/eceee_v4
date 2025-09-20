import { useCallback, useEffect, useRef, useState } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { Operation } from '../types/operations';

export interface PerformanceMetrics {
    operationTimes: Record<string, number[]>;
    averageOperationTime: Record<string, number>;
    slowestOperations: Array<{ type: string; time: number; timestamp: string }>;
    totalOperations: number;
    subscriptionCount: number;
    stateSize: number;
    memoryUsage?: number;
}

export interface UsePerformanceMonitorResult {
    // Metrics
    metrics: PerformanceMetrics;
    
    // Monitoring controls
    startMonitoring: () => void;
    stopMonitoring: () => void;
    resetMetrics: () => void;
    
    // Analysis
    getSlowOperations: (threshold?: number) => Array<{ type: string; time: number }>;
    getOperationStats: (operationType: string) => {
        count: number;
        averageTime: number;
        minTime: number;
        maxTime: number;
    };
    
    // Optimization suggestions
    getOptimizationSuggestions: () => string[];
    
    // Status
    isMonitoring: boolean;
    performanceScore: number; // 0-100
}

export function usePerformanceMonitor(): UsePerformanceMonitorResult {
    const { subscribeToOperations, state } = useUnifiedData();
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
        operationTimes: {},
        averageOperationTime: {},
        slowestOperations: [],
        totalOperations: 0,
        subscriptionCount: 0,
        stateSize: 0
    });

    const operationStartTimes = useRef<Map<string, number>>(new Map());

    // Monitor operation performance
    useEffect(() => {
        if (!isMonitoring) return;

        return subscribeToOperations((operation) => {
            const startTime = performance.now();
            const operationId = `${operation.type}_${Date.now()}_${Math.random()}`;
            
            operationStartTimes.current.set(operationId, startTime);

            // Use setTimeout to measure completion time
            setTimeout(() => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                setMetrics(prev => {
                    const operationType = operation.type;
                    const times = prev.operationTimes[operationType] || [];
                    const updatedTimes = [...times, duration];
                    
                    // Keep only last 100 measurements per operation type
                    if (updatedTimes.length > 100) {
                        updatedTimes.shift();
                    }

                    const averageTime = updatedTimes.reduce((sum, time) => sum + time, 0) / updatedTimes.length;

                    // Track slowest operations
                    const slowestOps = [...prev.slowestOperations];
                    if (duration > 100) { // Operations slower than 100ms
                        slowestOps.push({
                            type: operationType,
                            time: duration,
                            timestamp: new Date().toISOString()
                        });
                        
                        // Keep only last 50 slow operations
                        if (slowestOps.length > 50) {
                            slowestOps.shift();
                        }
                    }

                    return {
                        ...prev,
                        operationTimes: {
                            ...prev.operationTimes,
                            [operationType]: updatedTimes
                        },
                        averageOperationTime: {
                            ...prev.averageOperationTime,
                            [operationType]: averageTime
                        },
                        slowestOperations: slowestOps,
                        totalOperations: prev.totalOperations + 1
                    };
                });

                operationStartTimes.current.delete(operationId);
            }, 0);
        });
    }, [isMonitoring, subscribeToOperations]);

    // Monitor state size
    useEffect(() => {
        if (!isMonitoring) return;

        const updateStateMetrics = () => {
            const stateSize = JSON.stringify(state).length;
            const subscriptionCount = 0; // Would need to get from SubscriptionManager
            
            setMetrics(prev => ({
                ...prev,
                stateSize,
                subscriptionCount,
                memoryUsage: (performance as any).memory?.usedJSHeapSize
            }));
        };

        const metricsInterval = setInterval(updateStateMetrics, 5000); // Every 5 seconds

        return () => {
            clearInterval(metricsInterval);
        };
    }, [isMonitoring, state]);

    // Control methods
    const startMonitoring = useCallback(() => {
        setIsMonitoring(true);
        console.log('📊 Performance monitoring started');
    }, []);

    const stopMonitoring = useCallback(() => {
        setIsMonitoring(false);
        console.log('📊 Performance monitoring stopped');
    }, []);

    const resetMetrics = useCallback(() => {
        setMetrics({
            operationTimes: {},
            averageOperationTime: {},
            slowestOperations: [],
            totalOperations: 0,
            subscriptionCount: 0,
            stateSize: 0
        });
        console.log('🧹 Performance metrics reset');
    }, []);

    // Analysis methods
    const getSlowOperations = useCallback((threshold = 100) => {
        return Object.entries(metrics.averageOperationTime)
            .filter(([_, time]) => time > threshold)
            .map(([type, time]) => ({ type, time }))
            .sort((a, b) => b.time - a.time);
    }, [metrics.averageOperationTime]);

    const getOperationStats = useCallback((operationType: string) => {
        const times = metrics.operationTimes[operationType] || [];
        
        if (times.length === 0) {
            return { count: 0, averageTime: 0, minTime: 0, maxTime: 0 };
        }

        return {
            count: times.length,
            averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
            minTime: Math.min(...times),
            maxTime: Math.max(...times)
        };
    }, [metrics.operationTimes]);

    const getOptimizationSuggestions = useCallback((): string[] => {
        const suggestions: string[] = [];

        // Check for slow operations
        const slowOps = getSlowOperations(100);
        if (slowOps.length > 0) {
            suggestions.push(`Consider optimizing ${slowOps.length} slow operations: ${slowOps.map(op => op.type).join(', ')}`);
        }

        // Check state size
        if (metrics.stateSize > 1000000) { // 1MB
            suggestions.push('State size is large - consider implementing data pagination or cleanup');
        }

        // Check operation frequency
        if (metrics.totalOperations > 1000) {
            suggestions.push('High operation count - consider batching similar operations');
        }

        // Check for memory usage (if available)
        if (metrics.memoryUsage && metrics.memoryUsage > 50000000) { // 50MB
            suggestions.push('High memory usage detected - consider implementing cleanup strategies');
        }

        return suggestions;
    }, [metrics, getSlowOperations]);

    // Calculate performance score
    const performanceScore = useMemo(() => {
        let score = 100;

        // Deduct points for slow operations
        const slowOps = getSlowOperations(100);
        score -= Math.min(slowOps.length * 5, 30);

        // Deduct points for large state
        if (metrics.stateSize > 500000) {
            score -= Math.min((metrics.stateSize / 100000) * 5, 20);
        }

        // Deduct points for high operation count without batching
        if (metrics.totalOperations > 500) {
            score -= Math.min((metrics.totalOperations / 100) * 2, 15);
        }

        return Math.max(score, 0);
    }, [metrics, getSlowOperations]);

    return {
        // Entity validation
        validatePage,
        validateWidget,
        validateLayout,
        validateOperation: validateOperationCallback,
        
        // State validation
        validateCurrentState,
        getStateErrors,
        
        // Validation status
        isStateValid,
        hasErrors,
        hasWarnings,
        errorCount,
        warningCount,
        
        // Custom validation
        addValidationRule,
        removeValidationRule,
        
        // Utilities
        getEntityErrors: useCallback((entityType, entityId) => {
            switch (entityType) {
                case 'page':
                    const page = state.pages[entityId];
                    return page ? validatePage(page) : { 
                        isValid: false, 
                        errors: [{ field: 'id', message: 'Page not found', code: 'NOT_FOUND' }], 
                        warnings: [] 
                    };
                case 'widget':
                    const widget = state.widgets[entityId];
                    return widget ? validateWidget(widget) : { 
                        isValid: false, 
                        errors: [{ field: 'id', message: 'Widget not found', code: 'NOT_FOUND' }], 
                        warnings: [] 
                    };
                case 'layout':
                    const layout = state.layouts[entityId];
                    return layout ? validateLayout(layout) : { 
                        isValid: false, 
                        errors: [{ field: 'id', message: 'Layout not found', code: 'NOT_FOUND' }], 
                        warnings: [] 
                    };
                default:
                    return { 
                        isValid: false, 
                        errors: [{ field: 'entityType', message: 'Invalid entity type', code: 'INVALID_TYPE' }], 
                        warnings: [] 
                    };
            }
        }, [state, validatePage, validateWidget, validateLayout]),
        
        clearValidationErrors: useCallback(() => {
            console.log('🧹 Clearing validation errors');
        }, [])
    };
}
