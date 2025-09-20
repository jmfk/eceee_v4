import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../context/UnifiedDataContext';
import { useAPIIntegration } from '../hooks/useAPIIntegration';
import { usePageOperations } from '../hooks/usePageOperations';
import { OperationTypes } from '../types/operations';

// Mock the API modules
jest.mock('../../../api', () => ({
    pagesApi: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        publish: jest.fn(),
        duplicate: jest.fn()
    },
    layoutsApi: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    },
    versionsApi: {
        create: jest.fn(),
        publish: jest.fn(),
        delete: jest.fn()
    }
}));

const TestWrapper: React.FC<{
    children: React.ReactNode;
    enableAPIIntegration?: boolean;
    enableOptimisticUpdates?: boolean;
}> = ({
    children,
    enableAPIIntegration = true,
    enableOptimisticUpdates = true
}) => (
        <UnifiedDataProvider
            enableAPIIntegration={enableAPIIntegration}
            enableOptimisticUpdates={enableOptimisticUpdates}
        >
            {children}
        </UnifiedDataProvider>
    );

describe('API Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock navigator.onLine
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: true
        });
    });

    describe('useAPIIntegration Hook', () => {
        it('should track online status', () => {
            const { result } = renderHook(() => useAPIIntegration(), {
                wrapper: TestWrapper
            });

            expect(result.current.isOnline).toBe(true);
            expect(result.current.getAPIStatus().online).toBe(true);
        });

        it('should handle offline state', () => {
            // Mock offline
            Object.defineProperty(navigator, 'onLine', {
                value: false
            });

            const { result } = renderHook(() => useAPIIntegration(), {
                wrapper: TestWrapper
            });

            expect(result.current.isOnline).toBe(false);
        });

        it('should queue offline operations', () => {
            const { result } = renderHook(() => useAPIIntegration(), {
                wrapper: TestWrapper
            });

            const operation = {
                type: OperationTypes.UPDATE_PAGE,
                payload: { pageId: 'page1', updates: { title: 'Test' } }
            };

            act(() => {
                result.current.queueOfflineOperation(operation);
            });

            expect(result.current.pendingOperations).toHaveLength(1);
            expect(result.current.getAPIStatus().pending).toBe(1);
        });

        it('should clear API errors', () => {
            const { result } = renderHook(() => useAPIIntegration(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.clearAPIErrors();
            });

            expect(result.current.getAPIStatus().errors).toBe(0);
        });
    });

    describe('Optimistic Updates', () => {
        it('should perform optimistic updates', async () => {
            const { pagesApi } = require('../../../api');
            pagesApi.create.mockResolvedValue({ id: 'real-page-id' });

            const { result } = renderHook(() => usePageOperations('new-page'), {
                wrapper: (props) => <TestWrapper {...props} enableOptimisticUpdates={true} />
            });

            await act(async () => {
                // This should update local state immediately (optimistic)
                // Then call API in background
                await result.current.updatePage({ title: 'Test Page' });
            });

            // Local state should be updated immediately
            expect(result.current.page?.title).toBe('Test Page');
        });

        it('should rollback on API failure', async () => {
            const { pagesApi } = require('../../../api');
            pagesApi.update.mockRejectedValue(new Error('API Error'));

            const initialState = {
                pages: {
                    'test-page': {
                        id: 'test-page',
                        title: 'Original Title',
                        slug: 'test-page',
                        status: 'draft',
                        metadata: {},
                        layout: 'single_column',
                        version: 'v1',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                }
            };

            const { result } = renderHook(() => usePageOperations('test-page'), {
                wrapper: (props) => (
                    <TestWrapper
                        {...props}
                        enableOptimisticUpdates={true}
                    >
                        <UnifiedDataProvider initialState={initialState}>
                            {props.children}
                        </UnifiedDataProvider>
                    </TestWrapper>
                )
            });

            await act(async () => {
                try {
                    await result.current.updatePage({ title: 'Updated Title' });
                } catch (error) {
                    // Expected to fail
                }
            });

            // Should rollback to original title
            expect(result.current.page?.title).toBe('Original Title');
        });
    });

    describe('API Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            const { pagesApi } = require('../../../api');
            pagesApi.create.mockRejectedValue(new Error('Network Error'));

            const { result: apiResult } = renderHook(() => useAPIIntegration(), {
                wrapper: TestWrapper
            });

            const { result: pageResult } = renderHook(() => usePageOperations('new-page'), {
                wrapper: TestWrapper
            });

            await act(async () => {
                try {
                    await pageResult.current.updatePage({ title: 'Test Page' });
                } catch (error) {
                    // Expected to fail
                }
            });

            // API errors should be tracked
            expect(apiResult.current.getAPIStatus().errors).toBeGreaterThan(0);
        });
    });

    describe('Offline Support', () => {
        it('should queue operations when offline', () => {
            // Mock offline
            Object.defineProperty(navigator, 'onLine', {
                value: false
            });

            const { result } = renderHook(() => useAPIIntegration(), {
                wrapper: TestWrapper
            });

            const operation = {
                type: OperationTypes.UPDATE_PAGE,
                payload: { pageId: 'page1', updates: { title: 'Offline Update' } }
            };

            act(() => {
                result.current.queueOfflineOperation(operation);
            });

            expect(result.current.pendingOperations).toHaveLength(1);
        });

        it('should sync operations when back online', async () => {
            const { result } = renderHook(() => useAPIIntegration(), {
                wrapper: TestWrapper
            });

            // Queue some operations
            act(() => {
                result.current.queueOfflineOperation({
                    type: OperationTypes.UPDATE_PAGE,
                    payload: { pageId: 'page1', updates: { title: 'Update 1' } }
                });
                result.current.queueOfflineOperation({
                    type: OperationTypes.UPDATE_PAGE,
                    payload: { pageId: 'page2', updates: { title: 'Update 2' } }
                });
            });

            expect(result.current.pendingOperations).toHaveLength(2);

            // Sync operations
            await act(async () => {
                await result.current.syncOfflineOperations();
            });

            expect(result.current.pendingOperations).toHaveLength(0);
        });
    });
});
