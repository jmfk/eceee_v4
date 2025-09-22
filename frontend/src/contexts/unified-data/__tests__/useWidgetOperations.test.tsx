import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../v2/context/UnifiedDataContext';
import { useWidgetOperations } from '../v2/hooks/useWidgetOperations';
import { OperationTypes } from '../v2/types/operations';
import { UnifiedState } from '../v2/types/state';

const TestWrapper: React.FC<{ children: React.ReactNode; initialState?: Partial<UnifiedState> }> = ({
    children,
    initialState
}) => (
    <UnifiedDataProvider initialState={initialState}>
        {children}
    </UnifiedDataProvider>
);

describe('useWidgetOperations v2', () => {
    const widgetId = 'test-widget-123';

    describe('Widget State', () => {
        it('should return null widget when not found', () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            expect(result.current.getWidgetState().exists).toBe(false);
            expect(result.current.getWidgetState().hasUnsavedChanges).toBe(false);
            expect(result.current.getWidgetState().hasErrors).toBe(false);
        });

        it('should return widget when it exists', () => {
            const initialState: Partial<UnifiedState> = {
                widgets: {
                    [widgetId]: {
                        id: widgetId,
                        type: 'core_widgets.ContentWidget',
                        slotName: 'main',
                        config: { content: 'Test content' },
                        pageId: 'test-page',
                        order: 0
                    }
                }
            };

            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            expect(result.current.getWidgetState().exists).toBe(true);
            expect(result.current.getWidgetState().config.content).toBe('Test content');
        });

        it('should track widget state', () => {
            const initialState: Partial<UnifiedState> = {
                widgets: {
                    [widgetId]: {
                        id: widgetId,
                        type: 'core_widgets.ContentWidget',
                        slotName: 'main',
                        config: { content: 'Test content' },
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

            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            expect(result.current.getWidgetState().hasUnsavedChanges).toBe(true);
            expect(result.current.getWidgetState().isDirty).toBe(true);
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

            expect(result.current.getWidgetState().hasUnsavedChanges).toBe(true);
            expect(result.current.getWidgetState().config).toEqual(newConfig);
        });

        it('should move widget', async () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.move('sidebar', 2);
            });

            expect(result.current.getWidgetState().hasUnsavedChanges).toBe(true);
            expect(result.current.getWidgetState().slotName).toBe('sidebar');
            expect(result.current.getWidgetState().order).toBe(2);
        });

        it('should save widget', async () => {
            const initialState: Partial<UnifiedState> = {
                widgets: {
                    [widgetId]: {
                        id: widgetId,
                        type: 'core_widgets.ContentWidget',
                        slotName: 'main',
                        config: { content: 'Test content' },
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

            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            expect(result.current.getWidgetState().hasUnsavedChanges).toBe(true);

            await act(async () => {
                await result.current.save();
            });

            expect(result.current.getWidgetState().hasUnsavedChanges).toBe(false);
            expect(result.current.getWidgetState().lastSaveTime).toBeDefined();
        });

        it('should delete widget', async () => {
            const initialState: Partial<UnifiedState> = {
                widgets: {
                    [widgetId]: {
                        id: widgetId,
                        type: 'core_widgets.ContentWidget',
                        slotName: 'main',
                        config: { content: 'Test content' },
                        pageId: 'test-page',
                        order: 0
                    }
                }
            };

            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            await act(async () => {
                await result.current.delete();
            });

            expect(result.current.getWidgetState().exists).toBe(false);
        });
    });

    describe('Validation', () => {
        it('should validate widget config', async () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            await act(async () => {
                const validationResult = await result.current.validateConfig({
                    title: 'Valid Title',
                    content: 'Valid content'
                });

                expect(validationResult.isValid).toBe(true);
                expect(validationResult.errors).toHaveLength(0);
            });
        });

        it('should validate widget state', async () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            await act(async () => {
                const validationResult = await result.current.validate();
                expect(validationResult.isValid).toBe(true);
                expect(validationResult.errors).toHaveLength(0);
            });
        });

        it('should handle validation errors', async () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            await act(async () => {
                const validationResult = await result.current.validateConfig({
                    title: '', // Empty title should be invalid
                    content: null // Invalid content
                });

                expect(validationResult.isValid).toBe(false);
                expect(validationResult.errors.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Reset Functionality', () => {
        it('should reset widget to original state', async () => {
            const initialState: Partial<UnifiedState> = {
                widgets: {
                    [widgetId]: {
                        id: widgetId,
                        type: 'core_widgets.ContentWidget',
                        slotName: 'main',
                        config: { content: 'Original content' },
                        pageId: 'test-page',
                        order: 0
                    }
                }
            };

            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            // Make changes
            await act(async () => {
                await result.current.updateConfig({ content: 'Modified content' });
            });

            expect(result.current.getWidgetState().config.content).toBe('Modified content');
            expect(result.current.getWidgetState().hasUnsavedChanges).toBe(true);

            // Reset
            await act(async () => {
                await result.current.reset();
            });

            expect(result.current.getWidgetState().config.content).toBe('Original content');
            expect(result.current.getWidgetState().hasUnsavedChanges).toBe(false);
        });

        it('should handle partial reset', async () => {
            const initialState: Partial<UnifiedState> = {
                widgets: {
                    [widgetId]: {
                        id: widgetId,
                        type: 'core_widgets.ContentWidget',
                        slotName: 'main',
                        config: { title: 'Original Title', content: 'Original content' },
                        pageId: 'test-page',
                        order: 0
                    }
                }
            };

            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: (props) => <TestWrapper {...props} initialState={initialState} />
            });

            // Make changes
            await act(async () => {
                await result.current.updateConfig({
                    title: 'Modified Title',
                    content: 'Modified content'
                });
            });

            // Reset only title
            await act(async () => {
                await result.current.resetField('title');
            });

            expect(result.current.getWidgetState().config.title).toBe('Original Title');
            expect(result.current.getWidgetState().config.content).toBe('Modified content');
        });
    });

    describe('Error Handling', () => {
        it('should handle operation errors gracefully', async () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

            await act(async () => {
                try {
                    await result.current.updateConfig(null as any); // Invalid config
                } catch (error) {
                    expect(error.code).toBe('INVALID_CONFIG');
                }
            });

            expect(result.current.getWidgetState().hasErrors).toBe(true);
            expect(result.current.getWidgetState().errors.length).toBeGreaterThan(0);

            consoleErrorSpy.mockRestore();
        });

        it('should handle validation errors', async () => {
            const { result } = renderHook(() => useWidgetOperations(widgetId), {
                wrapper: TestWrapper
            });

            await act(async () => {
                try {
                    await result.current.updateConfig({
                        title: '', // Empty title
                        content: null // Invalid content
                    });
                } catch (error) {
                    expect(error.code).toBe('VALIDATION_ERROR');
                }
            });

            expect(result.current.getWidgetState().hasErrors).toBe(true);
            expect(result.current.getWidgetState().validationErrors.length).toBeGreaterThan(0);
        });
    });
});