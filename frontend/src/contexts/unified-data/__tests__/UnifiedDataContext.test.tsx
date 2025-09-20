import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider, useUnifiedData } from '../context/UnifiedDataContext';
import { OperationTypes } from '../types/operations';

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <UnifiedDataProvider>
        {children}
    </UnifiedDataProvider>
);

describe('UnifiedDataContext', () => {
    describe('Provider', () => {
        it('should provide context to children', () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapper
            });

            expect(result.current).toBeDefined();
            expect(result.current.state).toBeDefined();
            expect(result.current.dispatch).toBeInstanceOf(Function);
            expect(result.current.isDirty).toBe(false);
            expect(result.current.hasUnsavedChanges).toBe(false);
        });

        it('should throw error when used outside provider', () => {
            const { result } = renderHook(() => useUnifiedData());

            expect(result.error).toEqual(
                Error('useUnifiedData must be used within UnifiedDataProvider')
            );
        });
    });

    describe('State Management', () => {
        it('should update isDirty when widget operations occur', async () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapper
            });

            expect(result.current.isDirty).toBe(false);

            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: {
                        id: 'test-widget',
                        config: { title: 'Test Widget' }
                    }
                });
            });

            expect(result.current.isDirty).toBe(true);
            expect(result.current.hasUnsavedChanges).toBe(true);
        });

        it('should reset isDirty when widgets are saved', async () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapper
            });

            // Make a change
            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: {
                        id: 'test-widget',
                        config: { title: 'Test Widget' }
                    }
                });
            });

            expect(result.current.isDirty).toBe(true);

            // Mark as saved
            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.MARK_WIDGET_SAVED,
                    payload: { widgetId: 'test-widget' }
                });
            });

            expect(result.current.isDirty).toBe(false);
            expect(result.current.hasUnsavedChanges).toBe(false);
        });

        it('should handle manual dirty state setting', async () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapper
            });

            await act(async () => {
                result.current.setIsDirty(true);
            });

            expect(result.current.isDirty).toBe(true);

            await act(async () => {
                result.current.setIsDirty(false);
            });

            expect(result.current.isDirty).toBe(false);
        });
    });

    describe('Operations', () => {
        it('should handle widget CRUD operations', async () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapper
            });

            const widgetId = 'test-widget-crud';

            // Add widget
            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.ADD_WIDGET,
                    payload: {
                        pageId: 'test-page',
                        slotId: 'main',
                        widgetType: 'core_widgets.ContentWidget',
                        config: { content: 'Hello' },
                        widgetId
                    }
                });
            });

            expect(result.current.state.widgets[widgetId]).toBeDefined();
            expect(result.current.isDirty).toBe(true);

            // Update widget
            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: {
                        id: widgetId,
                        config: { content: 'Updated Hello' }
                    }
                });
            });

            expect(result.current.state.widgets[widgetId].config.content).toBe('Updated Hello');

            // Remove widget
            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.REMOVE_WIDGET,
                    payload: { id: widgetId }
                });
            });

            expect(result.current.state.widgets[widgetId]).toBeUndefined();
            expect(result.current.isDirty).toBe(false);
        });

        it('should handle batch operations', async () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.batchDispatch([
                    {
                        type: OperationTypes.UPDATE_WIDGET_CONFIG,
                        payload: { id: 'widget1', config: { title: 'Widget 1' } }
                    },
                    {
                        type: OperationTypes.UPDATE_WIDGET_CONFIG,
                        payload: { id: 'widget2', config: { title: 'Widget 2' } }
                    }
                ]);
            });

            expect(result.current.isDirty).toBe(true);
            expect(result.current.hasUnsavedChanges).toBe(true);
        });
    });

    describe('Subscriptions', () => {
        it('should provide working useSelector', async () => {
            const { result } = renderHook(() => {
                const { useSelector, dispatch } = useUnifiedData();
                const isDirty = useSelector(state => state.metadata.isDirty);
                return { isDirty, dispatch };
            }, {
                wrapper: TestWrapper
            });

            expect(result.current.isDirty).toBe(false);

            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: {
                        id: 'test-widget',
                        config: { title: 'Test' }
                    }
                });
            });

            expect(result.current.isDirty).toBe(true);
        });

        it('should handle operation subscriptions', async () => {
            const operationCallback = jest.fn();

            const { result } = renderHook(() => {
                const { subscribeToOperations, dispatch } = useUnifiedData();

                React.useEffect(() => {
                    return subscribeToOperations(operationCallback, ['UPDATE_WIDGET_CONFIG']);
                }, [subscribeToOperations]);

                return { dispatch };
            }, {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: {
                        id: 'test-widget',
                        config: { title: 'Test' }
                    }
                });
            });

            expect(operationCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'UPDATE_WIDGET_CONFIG'
                })
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle operation errors', async () => {
            const onError = jest.fn();
            const TestWrapperWithError: React.FC<{ children: React.ReactNode }> = ({ children }) => (
                <UnifiedDataProvider onError={onError}>
                    {children}
                </UnifiedDataProvider>
            );

            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapperWithError
            });

            await act(async () => {
                try {
                    await result.current.dispatch({
                        type: 'INVALID_OPERATION' as any,
                        payload: {}
                    });
                } catch (error) {
                    // Expected to throw
                }
            });

            expect(onError).toHaveBeenCalled();
        });
    });

    describe('Utility Methods', () => {
        it('should reset state', async () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapper
            });

            // Make some changes
            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: {
                        id: 'test-widget',
                        config: { title: 'Test' }
                    }
                });
            });

            expect(result.current.isDirty).toBe(true);

            // Reset
            await act(async () => {
                result.current.reset();
            });

            expect(result.current.isDirty).toBe(false);
            expect(result.current.hasUnsavedChanges).toBe(false);
        });

        it('should clear errors', async () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapper
            });

            await act(async () => {
                result.current.clearErrors();
            });

            expect(result.current.state.metadata.errors).toEqual({});
        });
    });
});
