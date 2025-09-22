import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../v2/context/UnifiedDataContext';
import { useBatchOperations } from '../v2/hooks/useBatchOperations';
import { OperationTypes } from '../v2/types/operations';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <UnifiedDataProvider
        initialState={{}}
        options={{
            enableBatchOperations: true
        }}
    >
        {children}
    </UnifiedDataProvider>
);

describe('useBatchOperations v2', () => {
    describe('Batch Management', () => {
        it('should start with empty operations', () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            expect(result.current.getBatchState().operations).toEqual([]);
            expect(result.current.getBatchState().totalOperations).toBe(0);
            expect(result.current.getBatchState().completedOperations).toBe(0);
            expect(result.current.getBatchState().failedOperations).toBe(0);
            expect(result.current.getBatchState().canExecute).toBe(false);
            expect(result.current.getBatchState().progress).toBe(0);
        });

        it('should add operations to batch', () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            const operation = {
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId: 'widget1', config: { title: 'Test' } }
            };

            act(() => {
                const operationId = result.current.add(operation);
                expect(operationId).toBeDefined();
                expect(result.current.getBatchState().totalOperations).toBe(1);
                expect(result.current.getBatchState().canExecute).toBe(true);
            });
        });

        it('should remove operations from batch', () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            const operation = {
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { widgetId: 'widget1', config: { title: 'Test' } }
            };

            act(() => {
                const operationId = result.current.add(operation);
                expect(result.current.getBatchState().totalOperations).toBe(1);

                result.current.remove(operationId);
                expect(result.current.getBatchState().totalOperations).toBe(0);
            });
        });

        it('should clear all operations', () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget1', config: {} }
                });
                result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget2', config: {} }
                });

                expect(result.current.getBatchState().totalOperations).toBe(2);

                result.current.clear();
                expect(result.current.getBatchState().totalOperations).toBe(0);
            });
        });
    });

    describe('Batch Execution', () => {
        it('should execute all operations in batch', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget1', config: { title: 'Widget 1' } }
                });
                result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget2', config: { title: 'Widget 2' } }
                });
            });

            await act(async () => {
                const results = await result.current.execute();

                expect(results).toHaveLength(2);
                expect(results.every(r => r.status === 'success')).toBe(true);
                expect(result.current.getBatchState().completedOperations).toBe(2);
                expect(result.current.getBatchState().failedOperations).toBe(0);
            });
        });

        it('should handle operation failures in batch', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget1', config: { title: 'Valid Widget' } }
                });
                result.current.add({
                    type: 'INVALID_OPERATION' as any,
                    payload: {}
                });
            });

            await act(async () => {
                const results = await result.current.execute();

                expect(results).toHaveLength(2);
                expect(results[0].status).toBe('success');
                expect(results[1].status).toBe('error');
                expect(result.current.getBatchState().failedOperations).toBe(1);
            });
        });

        it('should execute individual operations', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            let operationId: string;

            act(() => {
                operationId = result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget1', config: { title: 'Test' } }
                });
            });

            await act(async () => {
                await result.current.executeOne(operationId);

                const operation = result.current.getOperation(operationId);
                expect(operation?.status).toBe('success');
            });
        });

        it('should handle operation validation', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget1', config: { title: 'Valid Widget' } }
                });
            });

            await act(async () => {
                const validationResult = await result.current.validate();
                expect(validationResult.isValid).toBe(true);
                expect(validationResult.errors).toHaveLength(0);
            });
        });
    });

    describe('Progress Tracking', () => {
        it('should calculate progress correctly', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget1', config: {} }
                });
                result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget2', config: {} }
                });
                result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget3', config: {} }
                });
            });

            expect(result.current.getBatchState().progress).toBe(0);

            await act(async () => {
                const operations = result.current.getBatchState().operations;

                // Execute first operation
                await result.current.executeOne(operations[0].id);
                expect(result.current.getBatchState().progress).toBeCloseTo(33.33, 1);

                // Execute second operation
                await result.current.executeOne(operations[1].id);
                expect(result.current.getBatchState().progress).toBeCloseTo(66.67, 1);

                // Execute third operation
                await result.current.executeOne(operations[2].id);
                expect(result.current.getBatchState().progress).toBe(100);
            });
        });

        it('should track operation timing', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget1', config: {} }
                });
            });

            await act(async () => {
                await result.current.execute();
                const stats = result.current.getBatchState().stats;
                expect(stats.totalTime).toBeGreaterThan(0);
                expect(stats.averageTime).toBeGreaterThan(0);
            });
        });
    });

    describe('Utility Functions', () => {
        it('should get successful operations', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget1', config: {} }
                });
                result.current.add({
                    type: 'INVALID_OPERATION' as any,
                    payload: {}
                });
            });

            await act(async () => {
                await result.current.execute();
            });

            const successfulOps = result.current.getSuccessfulOperations();
            const failedOps = result.current.getFailedOperations();

            expect(successfulOps).toHaveLength(1);
            expect(failedOps).toHaveLength(1);
            expect(successfulOps[0].status).toBe('success');
            expect(failedOps[0].status).toBe('error');
        });

        it('should provide operation metadata', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.add({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget1', config: {} }
                });
            });

            await act(async () => {
                await result.current.execute();
            });

            const operation = result.current.getBatchState().operations[0];
            expect(operation.metadata).toBeDefined();
            expect(operation.metadata.startTime).toBeDefined();
            expect(operation.metadata.endTime).toBeDefined();
            expect(operation.metadata.duration).toBeGreaterThan(0);
        });
    });
});