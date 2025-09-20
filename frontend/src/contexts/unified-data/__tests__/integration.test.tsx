import React from 'react';
import { render, renderHook, act, screen } from '@testing-library/react';
import { UnifiedDataProvider, useUnifiedData } from '../context/UnifiedDataContext';
import { useWidgetOperations } from '../hooks/useWidgetOperations';
import { useBatchOperations } from '../hooks/useBatchOperations';
import { OperationTypes } from '../types/operations';

// Test component that uses UnifiedDataContext
const TestComponent: React.FC = () => {
    const { isDirty, hasUnsavedChanges, setIsDirty } = useUnifiedData();
    const widgetOps = useWidgetOperations('test-widget');

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

describe('UnifiedDataContext Integration', () => {
    describe('Complete Widget Workflow', () => {
        it('should handle full widget editing workflow', async () => {
            render(
                <UnifiedDataProvider>
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
                <UnifiedDataProvider>
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
                const context = useUnifiedData();
                const widget1 = useWidgetOperations('widget1');
                const widget2 = useWidgetOperations('widget2');
                return { context, widget1, widget2 };
            }, {
                wrapper: ({ children }) => (
                    <UnifiedDataProvider>{children}</UnifiedDataProvider>
                )
            });

            // Update first widget
            await act(async () => {
                await result.current.widget1.updateConfig({ title: 'Widget 1' });
            });

            expect(result.current.context.isDirty).toBe(true);

            // Update second widget
            await act(async () => {
                await result.current.widget2.updateConfig({ title: 'Widget 2' });
            });

            expect(result.current.context.isDirty).toBe(true);

            // Save first widget
            await act(async () => {
                await result.current.widget1.saveWidget();
            });

            expect(result.current.context.isDirty).toBe(true); // Still dirty (widget2 unsaved)

            // Save second widget
            await act(async () => {
                await result.current.widget2.saveWidget();
            });

            expect(result.current.context.isDirty).toBe(false); // Now clean
        });
    });

    describe('Batch Operations Integration', () => {
        it('should integrate batch operations with context', async () => {
            const { result } = renderHook(() => {
                const context = useUnifiedData();
                const batch = useBatchOperations();
                return { context, batch };
            }, {
                wrapper: ({ children }) => (
                    <UnifiedDataProvider>{children}</UnifiedDataProvider>
                )
            });

            await act(async () => {
                // Add operations to batch
                result.current.batch.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget1', config: { title: 'Widget 1' } }
                });
                result.current.batch.addOperation({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: 'widget2', config: { title: 'Widget 2' } }
                });

                // Execute batch
                await result.current.batch.executeBatch();
            });

            expect(result.current.context.isDirty).toBe(true);
            expect(result.current.batch.completedCount).toBe(2);
            expect(result.current.batch.errorCount).toBe(0);
        });
    });

    describe('Provider with Initial State', () => {
        it('should initialize with provided state', () => {
            const initialState = {
                widgets: {
                    'existing-widget': {
                        id: 'existing-widget',
                        type: 'core_widgets.ContentWidget',
                        slot: 'main',
                        config: { content: 'Existing content' },
                        order: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                },
                metadata: {
                    isDirty: true,
                    widgetStates: {
                        unsavedChanges: {
                            'existing-widget': true
                        },
                        errors: {},
                        activeEditors: []
                    }
                }
            };

            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: ({ children }) => (
                    <UnifiedDataProvider initialState={initialState}>
                        {children}
                    </UnifiedDataProvider>
                )
            });

            expect(result.current.isDirty).toBe(true);
            expect(result.current.hasUnsavedChanges).toBe(true);
            expect(result.current.state.widgets['existing-widget']).toBeDefined();
        });
    });

    describe('Error Boundaries', () => {
        it('should handle provider errors gracefully', () => {
            const onError = jest.fn();
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: ({ children }) => (
                    <UnifiedDataProvider onError={onError}>
                        {children}
                    </UnifiedDataProvider>
                )
            });

            act(async () => {
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
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Performance', () => {
        it('should handle many operations efficiently', async () => {
            const { result } = renderHook(() => useUnifiedData(), {
                wrapper: ({ children }) => (
                    <UnifiedDataProvider>{children}</UnifiedDataProvider>
                )
            });

            const startTime = performance.now();

            await act(async () => {
                const operations = Array.from({ length: 100 }, (_, i) => ({
                    type: OperationTypes.UPDATE_WIDGET_CONFIG,
                    payload: { id: `widget${i}`, config: { title: `Widget ${i}` } }
                }));

                await result.current.batchDispatch(operations);
            });

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (adjust threshold as needed)
            expect(duration).toBeLessThan(1000); // 1 second
            expect(result.current.isDirty).toBe(true);
        });
    });
});
