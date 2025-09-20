import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../context/UnifiedDataContext';
import { useBatchOperations } from '../hooks/useBatchOperations';
import { OperationTypes } from '../types/operations';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <UnifiedDataProvider>
        {children}
    </UnifiedDataProvider>
);

describe('useBatchOperations', () => {
    describe('Batch Management', () => {
        it('should start with empty operations', () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            expect(result.current.operations).toEqual([]);
            expect(result.current.totalCount).toBe(0);
            expect(result.current.completedCount).toBe(0);
            expect(result.current.errorCount).toBe(0);
            expect(result.current.canExecute).toBe(false);
            expect(result.current.progress).toBe(0);
        });

        it('should add operations to batch', () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            const operation = {
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: 'widget1', config: { title: 'Test' } }
            };

            act(() => {
                const operationId = result.current.addOperation(operation);
                expect(operationId).toBeDefined();
                expect(result.current.totalCount).toBe(1);
                expect(result.current.canExecute).toBe(true);
            });
        });

        it('should remove operations from batch', () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            const operation = {
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: { id: 'widget1', config: { title: 'Test' } }
            };

            act(() => {
                const operationId = result.current.addOperation(operation);
                expect(result.current.totalCount).toBe(1);

                result.current.removeOperation(operationId);
                expect(result.current.totalCount).toBe(0);
            });
        });

        it('should clear all operations', () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget1', config: {} }
                });
                result.current.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget2', config: {} }
                });

                expect(result.current.totalCount).toBe(2);

                result.current.clearOperations();
                expect(result.current.totalCount).toBe(0);
            });
        });
    });

    describe('Batch Execution', () => {
        it('should execute all operations in batch', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget1', config: { title: 'Widget 1' } }
                });
                result.current.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget2', config: { title: 'Widget 2' } }
                });
            });

            await act(async () => {
                const results = await result.current.executeBatch();

                expect(results).toHaveLength(2);
                expect(results.every(r => r.status === 'success')).toBe(true);
                expect(result.current.completedCount).toBe(2);
                expect(result.current.errorCount).toBe(0);
            });
        });

        it('should handle operation failures in batch', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget1', config: { title: 'Valid Widget' } }
                });
                result.current.addOperation({
                    type: 'INVALID_OPERATION' as any,
                    payload: {}
                });
            });

            await act(async () => {
                const results = await result.current.executeBatch();

                expect(results).toHaveLength(2);
                expect(results[0].status).toBe('success');
                expect(results[1].status).toBe('error');
                expect(result.current.errorCount).toBe(1);
            });
        });

        it('should execute individual operations', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            let operationId: string;

            act(() => {
                operationId = result.current.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget1', config: { title: 'Test' } }
                });
            });

            await act(async () => {
                await result.current.executeOperation(operationId);

                const operation = result.current.getOperation(operationId);
                expect(operation?.status).toBe('success');
            });
        });
    });

    describe('Progress Tracking', () => {
        it('should calculate progress correctly', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget1', config: {} }
                });
                result.current.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget2', config: {} }
                });
                result.current.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget3', config: {} }
                });
            });

            expect(result.current.progress).toBe(0);

            await act(async () => {
                const operations = result.current.operations;

                // Execute first operation
                await result.current.executeOperation(operations[0].id);
                expect(result.current.progress).toBeCloseTo(33.33, 1);

                // Execute second operation
                await result.current.executeOperation(operations[1].id);
                expect(result.current.progress).toBeCloseTo(66.67, 1);

                // Execute third operation
                await result.current.executeOperation(operations[2].id);
                expect(result.current.progress).toBe(100);
            });
        });
    });

    describe('Utility Functions', () => {
        it('should get successful operations', async () => {
            const { result } = renderHook(() => useBatchOperations(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget1', config: {} }
                });
                result.current.addOperation({
                    type: 'INVALID_OPERATION' as any,
                    payload: {}
                });
            });

            await act(async () => {
                await result.current.executeBatch();
            });

            const successfulOps = result.current.getSuccessfulOperations();
            const failedOps = result.current.getFailedOperations();

            expect(successfulOps).toHaveLength(1);
            expect(failedOps).toHaveLength(1);
            expect(successfulOps[0].status).toBe('success');
            expect(failedOps[0].status).toBe('error');
        });
    });
});
