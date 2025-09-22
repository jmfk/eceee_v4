import React from 'react';
import { render, renderHook, act, screen } from '@testing-library/react';
import { UnifiedDataProvider, useUnifiedData } from '../v2/context/UnifiedDataContext';
import { useWidgetOperations } from '../v2/hooks/useWidgetOperations';
import { useBatchOperations } from '../v2/hooks/useBatchOperations';
import { OperationTypes } from '../v2/types/operations';
import { UnifiedState } from '../v2/types/state';

// Test component that uses UnifiedDataContext
const TestComponent: React.FC = () => {
    const { getState, dispatch } = useUnifiedData();
    const widgetOps = useWidgetOperations('test-widget');

    const isDirty = getState().metadata.isDirty;
    const hasUnsavedChanges = getState().metadata.hasUnsavedChanges;

    const setIsDirty = (value: boolean) => {
        dispatch({
            type: OperationTypes.SET_METADATA,
            payload: { isDirty: value }
        });
    };

    return (
        <div>
            <div data-testid="is-dirty">{isDirty.toString()}</div>
            <div data-testid="has-unsaved">{hasUnsavedChanges.toString()}</div>
            <button
                data-testid="update-widget"
                onClick={() => widgetOps.updateConfig({ title: 'Updated' })}
            >
                Update Widget
            </button>
            <button
                data-testid="save-widget"
                onClick={() => widgetOps.saveWidget()}
            >
                Save Widget
            </button>
            <button
                data-testid="set-dirty"
                onClick={() => setIsDirty(true)}
            >
                Set Dirty
            </button>
        </div>
    );
};

describe('UnifiedDataContext v2 Integration', () => {
    describe('Complete Widget Workflow', () => {
        it('should handle full widget editing workflow', async () => {
            render(
                <UnifiedDataProvider initialState={{}}>
                    <TestComponent />
                </UnifiedDataProvider>
            );

            // Initial state
            expect(screen.getByTestId('is-dirty')).toHaveTextContent('false');
            expect(screen.getByTestId('has-unsaved')).toHaveTextContent('false');

            // Update widget config
            await act(async () => {
                screen.getByTestId('update-widget').click();
            });

            // Should be dirty after update
            expect(screen.getByTestId('is-dirty')).toHaveTextContent('true');
            expect(screen.getByTestId('has-unsaved')).toHaveTextContent('true');

            // Save widget
            await act(async () => {
                screen.getByTestId('save-widget').click();
            });

            // Should be clean after save
            expect(screen.getByTestId('is-dirty')).toHaveTextContent('false');
            expect(screen.getByTestId('has-unsaved')).toHaveTextContent('false');
        });

        it('should handle manual dirty state setting', async () => {
            render(
                <UnifiedDataProvider initialState={{}}>
                    <TestComponent />
                </UnifiedDataProvider>
            );

            expect(screen.getByTestId('is-dirty')).toHaveTextContent('false');

            await act(async () => {
                screen.getByTestId('set-dirty').click();
            });

            expect(screen.getByTestId('is-dirty')).toHaveTextContent('true');
        });
    });

    describe('Multiple Widget Management', () => {
        it('should handle multiple widgets correctly', async () => {
            const { result } = renderHook(() => {
                const { getState } = useUnifiedData();
                const widget1 = useWidgetOperations('widget1');
                const widget2 = useWidgetOperations('widget2');
                return { getState, widget1, widget2 };
            }, {
                wrapper: ({ children }) => (
                    <UnifiedDataProvider initialState={{}}>{children}</UnifiedDataProvider>
                )
            });

            // Update first widget
            await act(async () => {
                await result.current.widget1.updateConfig({ title: 'Widget 1' });
            });

            expect(result.current.getState().metadata.isDirty).toBe(true);

            // Update second widget
            await act(async () => {
                await result.current.widget2.updateConfig({ title: 'Widget 2' });
            });

            expect(result.current.getState().metadata.isDirty).toBe(true);

            // Save first widget
            await act(async () => {
                await result.current.widget1.saveWidget();
            });

            expect(result.current.getState().metadata.isDirty).toBe(true); // Still dirty (widget2 unsaved)

            // Save second widget
            await act(async () => {
                await result.current.widget2.saveWidget();
            });

            expect(result.current.getState().metadata.isDirty).toBe(false); // Now clean
        });
    });

    describe('Batch Operations Integration', () => {
        it('should integrate batch operations with context', async () => {
            const { result } = renderHook(() => {
                const { getState } = useUnifiedData();
                const batch = useBatchOperations();
                return { getState, batch };
            }, {
                wrapper: ({ children }) => (
                    <UnifiedDataProvider initialState={{}}>{children}</UnifiedDataProvider>
                )
            });

            await act(async () => {
                // Add operations to batch
                result.current.batch.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget1', config: { title: 'Widget 1' } }
                });
                result.current.batch.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: 'widget2', config: { title: 'Widget 2' } }
                });

                // Execute batch
                await result.current.batch.executeBatch();
            });

            expect(result.current.getState().metadata.isDirty).toBe(true);
            expect(result.current.batch.getStats().completedOperations).toBe(2);
            expect(result.current.batch.getStats().failedOperations).toBe(0);
        });
    });

    describe('Provider with Initial State', () => {
        it('should initialize with provided state', () => {
            const initialState: Partial<UnifiedState> = {
                widgets: {
                    'existing-widget': {
                        id: 'existing-widget',
                        type: 'core_widgets.ContentWidget',
                        slotName: 'main',
                        config: { content: 'Existing content' },
                        pageId: 'test-page',
                        order: 0
                    }
                },
                metadata: {
                    isDirty: true,
                    hasUnsavedChanges: true,
                    isLoading: false,
                    errors: {}
                }
            };

            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: ({ children }) => (
                    <UnifiedDataProvider initialState={initialState}>
                        {children}
                    </UnifiedDataProvider>
                )
            });

            expect(result.current.getState().metadata.isDirty).toBe(true);
            expect(result.current.getState().metadata.hasUnsavedChanges).toBe(true);
            expect(result.current.getState().widgets['existing-widget']).toBeDefined();
        });
    });

    describe('Error Boundaries', () => {
        it('should handle provider errors gracefully', () => {
            const onError = jest.fn();
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: ({ children }) => (
                    <UnifiedDataProvider
                        initialState={{}}
                        options={{ onError }}
                    >
                        {children}
                    </UnifiedDataProvider>
                )
            });

            act(() => {
                try {
                    result.current.dispatch({
                        type: 'INVALID_OPERATION' as any,
                        payload: {}
                    });
                } catch (error) {
                    // Expected to throw
                }
            });

            expect(onError).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Performance', () => {
        it('should handle many operations efficiently', async () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: ({ children }) => (
                    <UnifiedDataProvider initialState={{}}>{children}</UnifiedDataProvider>
                )
            });

            const startTime = performance.now();

            await act(async () => {
                const operations = Array.from({ length: 100 }, (_, i) => ({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { widgetId: `widget${i}`, config: { title: `Widget ${i}` } }
                }));

                await result.current.dispatch({
                    type: OperationTypes.BATCH,
                    payload: operations
                });
            });

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (adjust threshold as needed)
            expect(duration).toBeLessThan(1000); // 1 second
            expect(result.current.getState().metadata.isDirty).toBe(true);
        });
    });
});