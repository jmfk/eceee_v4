import { Operation } from '../types/operations';
import { AppState } from '../types/state';

/**
 * DevTools Manager for UnifiedDataContext
 * Provides debugging, logging, and inspection capabilities
 */

export interface OperationLog {
    id: string;
    operation: Operation;
    timestamp: string;
    duration?: number;
    success: boolean;
    error?: Error;
    stateBefore: AppState;
    stateAfter?: AppState;
    stackTrace?: string;
}

export interface StateSnapshot {
    id: string;
    timestamp: string;
    state: AppState;
    operationId?: string;
    label?: string;
}

export interface DevToolsConfig {
    enabled: boolean;
    maxOperationLogs: number;
    maxStateSnapshots: number;
    captureStackTraces: boolean;
    enableTimeTravel: boolean;
    enablePerformanceProfiling: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class DevToolsManager {
    private config: DevToolsConfig;
    private operationLogs: OperationLog[] = [];
    private stateSnapshots: StateSnapshot[] = [];
    private currentStateIndex: number = -1;
    private listeners: Set<(event: DevToolsEvent) => void> = new Set();

    constructor(config: Partial<DevToolsConfig> = {}) {
        this.config = {
            enabled: process.env.NODE_ENV === 'development',
            maxOperationLogs: 1000,
            maxStateSnapshots: 100,
            captureStackTraces: true,
            enableTimeTravel: true,
            enablePerformanceProfiling: true,
            logLevel: 'debug',
            ...config
        };

        // Expose to window for browser DevTools
        if (typeof window !== 'undefined' && this.config.enabled) {
            (window as any).__UNIFIED_DATA_DEVTOOLS__ = this;
        }
    }

    /**
     * Log an operation
     */
    logOperation(
        operation: Operation, 
        stateBefore: AppState, 
        stateAfter?: AppState, 
        duration?: number,
        error?: Error
    ): string {
        if (!this.config.enabled) return '';

        const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const log: OperationLog = {
            id: operationId,
            operation,
            timestamp: new Date().toISOString(),
            duration,
            success: !error,
            error,
            stateBefore,
            stateAfter,
            stackTrace: this.config.captureStackTraces ? new Error().stack : undefined
        };

        this.operationLogs.push(log);

        // Maintain max logs
        if (this.operationLogs.length > this.config.maxOperationLogs) {
            this.operationLogs.shift();
        }

        // Create state snapshot if state changed
        if (stateAfter && stateAfter !== stateBefore) {
            this.createStateSnapshot(stateAfter, operationId);
        }

        // Emit event
        this.emitEvent({
            type: 'operation-logged',
            data: log
        });

        // Console logging based on level
        this.logToConsole(log);

        return operationId;
    }

    /**
     * Create a state snapshot
     */
    createStateSnapshot(state: AppState, operationId?: string, label?: string): string {
        if (!this.config.enabled) return '';

        const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const snapshot: StateSnapshot = {
            id: snapshotId,
            timestamp: new Date().toISOString(),
            state: JSON.parse(JSON.stringify(state)), // Deep clone
            operationId,
            label
        };

        this.stateSnapshots.push(snapshot);
        this.currentStateIndex = this.stateSnapshots.length - 1;

        // Maintain max snapshots
        if (this.stateSnapshots.length > this.config.maxStateSnapshots) {
            this.stateSnapshots.shift();
            this.currentStateIndex--;
        }

        this.emitEvent({
            type: 'snapshot-created',
            data: snapshot
        });

        return snapshotId;
    }

    /**
     * Time travel to specific state
     */
    timeTravel(snapshotId: string): StateSnapshot | null {
        if (!this.config.enableTimeTravel) return null;

        const snapshot = this.stateSnapshots.find(s => s.id === snapshotId);
        if (!snapshot) return null;

        const index = this.stateSnapshots.indexOf(snapshot);
        this.currentStateIndex = index;

        this.emitEvent({
            type: 'time-travel',
            data: { snapshot, index }
        });

        return snapshot;
    }

    /**
     * Replay operations from a specific point
     */
    replayOperations(fromOperationId?: string): OperationLog[] {
        const startIndex = fromOperationId 
            ? this.operationLogs.findIndex(log => log.id === fromOperationId)
            : 0;

        if (startIndex === -1) return [];

        const operationsToReplay = this.operationLogs.slice(startIndex);
        
        this.emitEvent({
            type: 'operations-replayed',
            data: { operations: operationsToReplay, fromIndex: startIndex }
        });

        return operationsToReplay;
    }

    /**
     * Get operation statistics
     */
    getOperationStats(): Record<string, {
        count: number;
        averageTime: number;
        successRate: number;
        errors: number;
    }> {
        const stats: Record<string, any> = {};

        this.operationLogs.forEach(log => {
            const type = log.operation.type;
            if (!stats[type]) {
                stats[type] = {
                    count: 0,
                    totalTime: 0,
                    successes: 0,
                    errors: 0
                };
            }

            stats[type].count++;
            if (log.duration) stats[type].totalTime += log.duration;
            if (log.success) stats[type].successes++;
            if (log.error) stats[type].errors++;
        });

        // Calculate derived metrics
        Object.keys(stats).forEach(type => {
            const stat = stats[type];
            stat.averageTime = stat.totalTime / stat.count;
            stat.successRate = (stat.successes / stat.count) * 100;
            delete stat.totalTime;
            delete stat.successes;
        });

        return stats;
    }

    /**
     * Get performance insights
     */
    getPerformanceInsights(): {
        slowOperations: Array<{ type: string; averageTime: number }>;
        errorProneOperations: Array<{ type: string; errorRate: number }>;
        recommendations: string[];
    } {
        const stats = this.getOperationStats();
        
        const slowOperations = Object.entries(stats)
            .filter(([_, stat]) => stat.averageTime > 100)
            .map(([type, stat]) => ({ type, averageTime: stat.averageTime }))
            .sort((a, b) => b.averageTime - a.averageTime);

        const errorProneOperations = Object.entries(stats)
            .filter(([_, stat]) => stat.successRate < 95)
            .map(([type, stat]) => ({ type, errorRate: 100 - stat.successRate }))
            .sort((a, b) => b.errorRate - a.errorRate);

        const recommendations: string[] = [];

        if (slowOperations.length > 0) {
            recommendations.push(`Consider optimizing slow operations: ${slowOperations.slice(0, 3).map(op => op.type).join(', ')}`);
        }

        if (errorProneOperations.length > 0) {
            recommendations.push(`Review error-prone operations: ${errorProneOperations.slice(0, 3).map(op => op.type).join(', ')}`);
        }

        if (this.operationLogs.length > 500) {
            recommendations.push('High operation count - consider implementing operation batching');
        }

        const stateSize = JSON.stringify(this.stateSnapshots[this.currentStateIndex]?.state || {}).length;
        if (stateSize > 1000000) {
            recommendations.push('Large state size - consider implementing data cleanup or pagination');
        }

        return {
            slowOperations,
            errorProneOperations,
            recommendations
        };
    }

    /**
     * Export debugging data
     */
    exportDebugData(): {
        operations: OperationLog[];
        snapshots: StateSnapshot[];
        stats: Record<string, any>;
        insights: any;
        config: DevToolsConfig;
    } {
        return {
            operations: this.operationLogs,
            snapshots: this.stateSnapshots,
            stats: this.getOperationStats(),
            insights: this.getPerformanceInsights(),
            config: this.config
        };
    }

    /**
     * Import debugging data
     */
    importDebugData(data: any): void {
        if (data.operations) this.operationLogs = data.operations;
        if (data.snapshots) this.stateSnapshots = data.snapshots;
        if (data.config) this.config = { ...this.config, ...data.config };
        
        this.emitEvent({
            type: 'debug-data-imported',
            data: { importedOperations: data.operations?.length || 0 }
        });
    }

    /**
     * Clear all debugging data
     */
    clearDebugData(): void {
        this.operationLogs = [];
        this.stateSnapshots = [];
        this.currentStateIndex = -1;
        
        this.emitEvent({
            type: 'debug-data-cleared',
            data: {}
        });
    }

    /**
     * Subscribe to DevTools events
     */
    subscribe(listener: (event: DevToolsEvent) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Emit DevTools event
     */
    private emitEvent(event: DevToolsEvent): void {
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('DevTools listener error:', error);
            }
        });
    }

    /**
     * Log to console based on configuration
     */
    private logToConsole(log: OperationLog): void {
        if (!this.config.enabled) return;

        const { operation, duration, success, error } = log;
        const emoji = success ? '✅' : '❌';
        const timeStr = duration ? ` (${duration.toFixed(2)}ms)` : '';
        
        switch (this.config.logLevel) {
            case 'debug':
                console.groupCollapsed(`${emoji} ${operation.type}${timeStr}`);
                console.log('Operation:', operation);
                console.log('Duration:', duration);
                if (error) console.error('Error:', error);
                console.groupEnd();
                break;
                
            case 'info':
                console.log(`${emoji} ${operation.type}${timeStr}`);
                break;
                
            case 'warn':
                if (!success) {
                    console.warn(`${emoji} ${operation.type} failed${timeStr}`, error);
                }
                break;
                
            case 'error':
                if (error) {
                    console.error(`${emoji} ${operation.type} failed${timeStr}`, error);
                }
                break;
        }
    }

    /**
     * Get all data for DevTools
     */
    getDevToolsData(): {
        operations: OperationLog[];
        snapshots: StateSnapshot[];
        currentSnapshot: StateSnapshot | null;
        stats: Record<string, any>;
        insights: any;
    } {
        return {
            operations: this.operationLogs,
            snapshots: this.stateSnapshots,
            currentSnapshot: this.stateSnapshots[this.currentStateIndex] || null,
            stats: this.getOperationStats(),
            insights: this.getPerformanceInsights()
        };
    }
}

export interface DevToolsEvent {
    type: 'operation-logged' | 'snapshot-created' | 'time-travel' | 'operations-replayed' | 'debug-data-imported' | 'debug-data-cleared';
    data: any;
}
