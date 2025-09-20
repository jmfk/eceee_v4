import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../context/UnifiedDataContext';
import { useWidgetOperations } from '../hooks/useWidgetOperations';
import { OperationTypes } from '../types/operations';

const TestWrapper: React.FC<{ children: React.ReactNode; initialState?: any }> = ({
    children,
    initialState
}) => (
    <UnifiedDataProvider initialState={initialState}>
        {children}
    </UnifiedDataProvider>
);

describe('useWidgetOperations', () => {
    const widgetId = 'test-widget-123';

    describe('Widget State', () => {
        it('should return null widget when not found', () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            expect(result.current.widget).toBeNull();
            expect(result.current.hasUnsavedChanges).toBe(false);
            expect(result.current.hasErrors).toBe(false);
        });

        it('should return widget when it exists', () => {
            const initialState = {
                widgets: {
                    [widgetId]: {
                        id: widgetId,
                        type: 'core_widgets.ContentWidget',
                        slot: 'main',
                        config: { content: 'Test content' },
                        order: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                }
            };

            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            expect(result.current.widget).toBeDefined();
            expect(result.current.widget?.config.content).toBe('Test content');
        });

        it('should track unsaved changes', () => {
            const initialState = {
                metadata: {
                    widgetStates: {
                        unsavedChanges: {
                            [widgetId]: true
                        },
                        errors: {},
                        activeEditors: []
                    }
                }
            };

            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            expect(result.current.hasUnsavedChanges).toBe(true);
        });
    });

    describe('Operations', () => {
        it('should update widget config', async () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            const newConfig = { title: 'Updated Title', content: 'Updated content' };

            await act(async () => {
                await result.current.updateConfig(newConfig);
            });

            // Should trigger isDirty
            expect(result.current.hasUnsavedChanges).toBe(true);
        });

        it('should move widget', async () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.moveWidget('sidebar', 2);
            });

            // Should trigger isDirty
            expect(result.current.hasUnsavedChanges).toBe(true);
        });

        it('should save widget', async () => {
            const initialState = {
                metadata: {
                    widgetStates: {
                        unsavedChanges: {
                            [widgetId]: true
                        },
                        errors: {},
                        activeEditors: []
                    }
                }
            };

            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            expect(result.current.hasUnsavedChanges).toBe(true);

            await act(async () => {
                await result.current.saveWidget();
            });

            expect(result.current.hasUnsavedChanges).toBe(false);
        });

        it('should delete widget', async () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.deleteWidget();
            });

            // Deletion should trigger operations
            expect(result.current.hasUnsavedChanges).toBe(false);
        });
    });

    describe('Validation', () => {
        it('should validate widget', async () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            await act(async () => {
                const isValid = await result.current.validate();
                expect(typeof isValid).toBe('boolean');
            });
        });
    });

    describe('Reset Functionality', () => {
        it('should reset widget to original state', async () => {
            const initialWidget = {
                id: widgetId,
                type: 'core_widgets.ContentWidget',
                slot: 'main',
                config: { content: 'Original content' },
                order: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const initialState = {
                widgets: {
                    [widgetId]: initialWidget
                }
            };

            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            // Make changes
            await act(async () => {
                await result.current.updateConfig({ content: 'Modified content' });
            });

            // Reset
            await act(async () => {
                await result.current.reset();
            });

            // Should have reset to original config
            expect(result.current.widget?.config.content).toBe('Original content');
        });
    });

    describe('Error Handling', () => {
        it('should handle operation errors gracefully', async () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            // Mock console.error to avoid test output noise
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            await act(async () => {
                try {
                    await result.current.updateConfig(null as any); // Invalid config
                } catch (error) {
                    // Expected to throw
                }
            });

            consoleErrorSpy.mockRestore();
        });
    });
});
