import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../context/UnifiedDataContext';
import { useDevTools } from '../hooks/useDevTools';
import { DevToolsManager } from '../devtools/DevToolsManager';
import { OperationLogger } from '../devtools/OperationLogger';
import { PerformanceProfiler } from '../devtools/PerformanceProfiler';
import { OperationTypes } from '../types/operations';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <UnifiedDataProvider enableAPIIntegration={false} enableDevTools={true}>
        {children}
    </UnifiedDataProvider>
);

describe('DevTools System', () => {
    describe('DevToolsManager', () => {
        let devToolsManager: DevToolsManager;
        let mockState: any;

        beforeEach(() => {
            devToolsManager = new DevToolsManager({ enabled: true });
            mockState = {
                pages: {},
                widgets: {},
                layouts: {},
                versions: {},
                metadata: { isDirty: false, isLoading: false }
            };
        });

        it('should log operations', () => {
            const operation = {
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: 'widget1', config: { title: 'Test' } }
            };

            const operationId = devToolsManager.logOperation(
                operation,
                mockState,
                mockState,
                50 // 50ms duration
            );

            expect(operationId).toBeDefined();

            const devToolsData = devToolsManager.getDevToolsData();
            expect(devToolsData.operations).toHaveLength(1);
            expect(devToolsData.operations[0].operation.type).toBe(OperationTypes.UPDATE_WIDGET_CONFIG);
        });

        it('should create state snapshots', () => {
            const snapshotId = devToolsManager.createStateSnapshot(mockState, 'op1', 'Test snapshot');

            expect(snapshotId).toBeDefined();

            const devToolsData = devToolsManager.getDevToolsData();
            expect(devToolsData.snapshots).toHaveLength(1);
            expect(devToolsData.snapshots[0].label).toBe('Test snapshot');
        });

        it('should generate operation statistics', () => {
            // Log multiple operations
            const operations = [
                { type: OperationTypes.UPDATE_WIDGET_CONFIG, duration: 50 },
                { type: OperationTypes.UPDATE_WIDGET_CONFIG, duration: 75 },
                { type: OperationTypes.MOVE_WIDGET, duration: 25 },
            ];

            operations.forEach(op => {
                devToolsManager.logOperation(
                    { type: op.type, payload: {} },
                    mockState,
                    mockState,
                    op.duration
                );
            });

            const stats = devToolsManager.getOperationStats();

            expect(stats[OperationTypes.UPDATE_WIDGET_CONFIG]).toBeDefined();
            expect(stats[OperationTypes.UPDATE_WIDGET_CONFIG].count).toBe(2);
            expect(stats[OperationTypes.UPDATE_WIDGET_CONFIG].averageTime).toBe(62.5);
            expect(stats[OperationTypes.MOVE_WIDGET].count).toBe(1);
        });

        it('should provide performance insights', () => {
            // Log slow operation
            devToolsManager.logOperation(
                { type: OperationTypes.UPDATE_WIDGET_CONFIG, payload: {} },
                mockState,
                mockState,
                150 // Slow operation
            );

            const insights = devToolsManager.getPerformanceInsights();

            expect(insights.slowOperations).toHaveLength(1);
            expect(insights.slowOperations[0].type).toBe(OperationTypes.UPDATE_WIDGET_CONFIG);
            expect(insights.recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('OperationLogger', () => {
        let operationLogger: OperationLogger;

        beforeEach(() => {
            operationLogger = new OperationLogger();
        });

        it('should start and stop recording sessions', () => {
            const sessionId = operationLogger.startRecording('Test Session');
            expect(sessionId).toBeDefined();

            const status = operationLogger.getRecordingStatus();
            expect(status.isRecording).toBe(true);
            expect(status.currentSession?.name).toBe('Test Session');

            const session = operationLogger.stopRecording();
            expect(session).toBeDefined();
            expect(session?.status).toBe('completed');
        });

        it('should log operations during recording', () => {
            const sessionId = operationLogger.startRecording('Test Session');

            operationLogger.logOperation(
                { type: OperationTypes.UPDATE_WIDGET_CONFIG, payload: {} },
                { pages: {}, widgets: {}, layouts: {}, versions: {}, metadata: {} } as any,
                { pages: {}, widgets: {}, layouts: {}, versions: {}, metadata: {} } as any,
                50,
                true
            );

            const session = operationLogger.stopRecording();
            expect(session?.operations).toHaveLength(1);
        });

        it('should export and import sessions', () => {
            const sessionId = operationLogger.startRecording('Export Test');
            operationLogger.logOperation(
                { type: OperationTypes.UPDATE_WIDGET_CONFIG, payload: {} },
                {} as any,
                {} as any,
                50,
                true
            );
            operationLogger.stopRecording();

            const exportedData = operationLogger.exportSession(sessionId);
            expect(exportedData).toBeDefined();

            const importedSessionId = operationLogger.importSession(exportedData);
            expect(importedSessionId).toBeDefined();
        });

        it('should search operations', () => {
            const sessionId = operationLogger.startRecording('Search Test');

            // Log different types of operations
            operationLogger.logOperation(
                { type: OperationTypes.UPDATE_WIDGET_CONFIG, payload: {} },
                {} as any, {} as any, 50, true
            );
            operationLogger.logOperation(
                { type: OperationTypes.MOVE_WIDGET, payload: {} },
                {} as any, {} as any, 25, true
            );
            operationLogger.logOperation(
                { type: OperationTypes.UPDATE_WIDGET_CONFIG, payload: {} },
                {} as any, {} as any, 150, false, new Error('Test error')
            );

            operationLogger.stopRecording();

            // Search by type
            const configOps = operationLogger.searchOperations({
                type: OperationTypes.UPDATE_WIDGET_CONFIG
            });
            expect(configOps).toHaveLength(2);

            // Search by success
            const failedOps = operationLogger.searchOperations({ success: false });
            expect(failedOps).toHaveLength(1);

            // Search by duration
            const slowOps = operationLogger.searchOperations({ minDuration: 100 });
            expect(slowOps).toHaveLength(1);
        });
    });

    describe('PerformanceProfiler', () => {
        let profiler: PerformanceProfiler;
        let mockState: any;

        beforeEach(() => {
            profiler = new PerformanceProfiler({ enabled: true });
            mockState = {
                pages: {},
                widgets: {},
                layouts: {},
                versions: {},
                metadata: {}
            };
        });

        it('should profile operations', () => {
            const operation = {
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: 'widget1', config: {} }
            };

            const profileId = profiler.startProfiling(operation, mockState);
            expect(profileId).toBeDefined();

            // Simulate operation completion
            setTimeout(() => {
                const profile = profiler.endProfiling(profileId, mockState);
                expect(profile).toBeDefined();
                expect(profile?.duration).toBeGreaterThan(0);
            }, 10);
        });

        it('should generate performance reports', () => {
            // Create some profiles
            const operations = [
                { type: OperationTypes.UPDATE_WIDGET_CONFIG, duration: 50 },
                { type: OperationTypes.UPDATE_WIDGET_CONFIG, duration: 150 },
                { type: OperationTypes.MOVE_WIDGET, duration: 25 }
            ];

            operations.forEach(op => {
                const profileId = profiler.startProfiling(
                    { type: op.type, payload: {} },
                    mockState
                );

                // Simulate completion
                const profile = profiler['profiles'].get(profileId);
                if (profile) {
                    profile.endTime = profile.startTime + op.duration;
                    profile.duration = op.duration;
                }
            });

            const report = profiler.generateReport();

            expect(report.totalOperations).toBe(3);
            expect(report.slowestOperations.length).toBeGreaterThan(0);
            expect(report.recommendations.length).toBeGreaterThan(0);
            expect(report.score).toBeGreaterThan(0);
        });
    });

    describe('useDevTools Hook', () => {
        it('should provide DevTools functionality', () => {
            const { result } = renderHook(() => useDevTools(), {
                wrapper: TestWrapper
            });

            expect(result.current.isEnabled).toBe(true);
            expect(result.current.startRecording).toBeInstanceOf(Function);
            expect(result.current.getOperationStats).toBeInstanceOf(Function);
            expect(result.current.showStateInspector).toBeInstanceOf(Function);
        });

        it('should handle recording sessions', () => {
            const { result } = renderHook(() => useDevTools(), {
                wrapper: TestWrapper
            });

            act(() => {
                const sessionId = result.current.startRecording('Test Session');
                expect(sessionId).toBeDefined();
                expect(result.current.isRecording).toBe(true);
            });

            act(() => {
                const session = result.current.stopRecording();
                expect(session).toBeDefined();
                expect(result.current.isRecording).toBe(false);
            });
        });

        it('should provide state inspection', () => {
            const { result } = renderHook(() => useDevTools(), {
                wrapper: TestWrapper
            });

            const currentState = result.current.getCurrentState();
            expect(currentState).toBeDefined();
            expect(currentState.pages).toBeDefined();
            expect(currentState.widgets).toBeDefined();

            // Should not throw
            expect(() => result.current.showStateInspector()).not.toThrow();
            expect(() => result.current.showPerformanceProfiler()).not.toThrow();
        });

        it('should handle debug data export/import', () => {
            const { result } = renderHook(() => useDevTools(), {
                wrapper: TestWrapper
            });

            const exportedData = result.current.exportDebugData();
            expect(exportedData).toBeDefined();
            expect(exportedData.devTools).toBeDefined();

            expect(() => result.current.importDebugData(exportedData)).not.toThrow();
        });
    });

    describe('Browser Integration', () => {
        it('should expose DevTools to window object', () => {
            renderHook(() => useDevTools(), {
                wrapper: TestWrapper
            });

            expect((window as any).__UNIFIED_DATA_DEVTOOLS_HOOK__).toBeDefined();
            expect((window as any).__UNIFIED_DATA_DEVTOOLS_HOOK__.startRecording).toBeInstanceOf(Function);
        });
    });
});
