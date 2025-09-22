import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider, useUnifiedData } from '../v2/context/UnifiedDataContext';
import { OperationTypes } from '../v2/types/operations';

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <UnifiedDataProvider initialState={{}}>
        {children}
    </UnifiedDataProvider>
);

describe('UnifiedDataContext v2', () => {
    describe('Provider', () => {
        it('should provide context to children', () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapper
            });

            expect(result.current).toBeDefined();
            expect(result.current.state).toBeDefined();
            expect(result.current.dispatch).toBeInstanceOf(Function);
            expect(result.current.getState().metadata.isDirty).toBe(false);
            expect(result.current.getState().metadata.hasUnsavedChanges).toBe(false);
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

            expect(result.current.getState().metadata.isDirty).toBe(false);

            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: {
                        widgetId: 'test-widget',
                        config: { title: 'Test Widget' }
                    }
                });
            });

            expect(result.current.getState().metadata.isDirty).toBe(true);
            expect(result.current.getState().metadata.hasUnsavedChanges).toBe(true);
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
                        widgetId: 'test-widget',
                        config: { title: 'Test Widget' }
                    }
                });
            });

            expect(result.current.getState().metadata.isDirty).toBe(true);

            // Mark as saved
            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.MARK_WIDGET_SAVED,
                    payload: { widgetId: 'test-widget' }
                });
            });

            expect(result.current.getState().metadata.isDirty).toBe(false);
            expect(result.current.getState().metadata.hasUnsavedChanges).toBe(false);
        });

        it('should handle manual dirty state setting', async () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.SET_METADATA,
                    payload: { isDirty: true }
                });
            });

            expect(result.current.getState().metadata.isDirty).toBe(true);

            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.SET_METADATA,
                    payload: { isDirty: false }
                });
            });

            expect(result.current.getState().metadata.isDirty).toBe(false);
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
                        slotName: 'main',
                        widgetType: 'core_widgets.ContentWidget',
                        config: { content: 'Hello' },
                        widgetId
                    }
                });
            });

            expect(result.current.getState().widgets[widgetId]).toBeDefined();
            expect(result.current.getState().metadata.isDirty).toBe(true);

            // Update widget
            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: {
                        widgetId,
                        config: { content: 'Updated Hello' }
                    }
                });
            });

            expect(result.current.getState().widgets[widgetId].config.content).toBe('Updated Hello');

            // Remove widget
            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.REMOVE_WIDGET,
                    payload: { widgetId }
                });
            });

            expect(result.current.getState().widgets[widgetId]).toBeUndefined();
            expect(result.current.getState().metadata.isDirty).toBe(false);
        });

        it('should handle batch operations', async () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.batchDispatch([
                    {
                        type: OperationTypes.UPDATE_WIDGET_CONFIG,
                        payload: { widgetId: 'widget1', config: { title: 'Widget 1' } }
                    },
                    {
                        type: OperationTypes.UPDATE_WIDGET_CONFIG,
                        payload: { widgetId: 'widget2', config: { title: 'Widget 2' } }
                    }
                ]);
            });

            expect(result.current.getState().metadata.isDirty).toBe(true);
            expect(result.current.getState().metadata.hasUnsavedChanges).toBe(true);
        });
    });

    describe('Subscriptions', () => {
        it('should handle state subscriptions', async () => {
            const stateCallback = vi.fn();

            const { result } = renderHook(() => {
                const { subscribe, dispatch } = useUnifiedData();

                React.useEffect(() => {
                    return subscribe(
                        state => state.metadata.isDirty,
                        stateCallback
                    );
                }, [subscribe]);

                return { dispatch };
            }, {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: {
                        widgetId: 'test-widget',
                        config: { title: 'Test' }
                    }
                });
            });

            expect(stateCallback).toHaveBeenCalledWith(true, false);
        });

        it('should handle operation subscriptions', async () => {
            const operationCallback = vi.fn();

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
                        widgetId: 'test-widget',
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
            const onError = vi.fn();
            const TestWrapperWithError: React.FC<{ children: React.ReactNode }> = ({ children }) => (
                <UnifiedDataProvider initialState={{}} onError={onError}>
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
                        widgetId: 'test-widget',
                        config: { title: 'Test' }
                    }
                });
            });

            expect(result.current.getState().metadata.isDirty).toBe(true);

            // Reset
            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.RESET_STATE,
                    payload: undefined
                });
            });

            expect(result.current.getState().metadata.isDirty).toBe(false);
            expect(result.current.getState().metadata.hasUnsavedChanges).toBe(false);
        });

        it('should clear errors', async () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.dispatch({
                    type: OperationTypes.SET_METADATA,
                    payload: { errors: {} }
                });
            });

            expect(result.current.getState().metadata.errors).toEqual({});
        });
    });
});