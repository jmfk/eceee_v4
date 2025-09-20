import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../context/UnifiedDataContext';
import { useAutoSave } from '../hooks/useAutoSave';
import { useValidation } from '../hooks/useValidation';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { OperationTypes } from '../types/operations';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <UnifiedDataProvider enableAPIIntegration={false}>
        {children}
    </UnifiedDataProvider>
);

describe('Auto-save and Validation Features', () => {
    describe('useAutoSave', () => {
        it('should initialize with default configuration', () => {
            const { result } = renderHook(() => useAutoSave(), {
                wrapper: TestWrapper
            });

            expect(result.current.isEnabled).toBe(true);
            expect(result.current.config.interval).toBe(30000);
            expect(result.current.saveCount).toBe(0);
        });

        it('should update configuration', () => {
            const { result } = renderHook(() => useAutoSave(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.updateConfig({
                    interval: 60000,
                    enabled: false
                });
            });

            expect(result.current.config.interval).toBe(60000);
            expect(result.current.isEnabled).toBe(false);
        });

        it('should start and stop auto-save', () => {
            const { result } = renderHook(() => useAutoSave({ enabled: false }), {
                wrapper: TestWrapper
            });

            expect(result.current.isEnabled).toBe(false);

            act(() => {
                result.current.startAutoSave();
            });

            // Note: isEnabled reflects config, not runtime state
            // Would need to check if timer is active

            act(() => {
                result.current.stopAutoSave();
            });
        });

        it('should force save immediately', async () => {
            const { result } = renderHook(() => useAutoSave(), {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.forceSave();
            });

            // Should complete without error
            expect(result.current.lastError).toBeNull();
        });
    });

    describe('useValidation', () => {
        it('should validate page data', () => {
            const { result } = renderHook(() => useValidation(), {
                wrapper: TestWrapper
            });

            // Valid page
            const validPage = {
                id: 'page-1',
                title: 'Valid Page',
                slug: 'valid-page',
                status: 'draft' as const,
                metadata: {},
                layout: 'single_column',
                version: 'v1',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const validResult = result.current.validatePage(validPage);
            expect(validResult.isValid).toBe(true);
            expect(validResult.errors).toHaveLength(0);

            // Invalid page
            const invalidPage = {
                ...validPage,
                title: '', // Empty title
                slug: 'Invalid Slug!' // Invalid characters
            };

            const invalidResult = result.current.validatePage(invalidPage);
            expect(invalidResult.isValid).toBe(false);
            expect(invalidResult.errors.length).toBeGreaterThan(0);
        });

        it('should validate widget data', () => {
            const { result } = renderHook(() => useValidation(), {
                wrapper: TestWrapper
            });

            const validWidget = {
                id: 'widget-1',
                type: 'core_widgets.ContentWidget',
                slot: 'main',
                config: { content: 'Test content' },
                order: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const validResult = result.current.validateWidget(validWidget);
            expect(validResult.isValid).toBe(true);

            const invalidWidget = {
                ...validWidget,
                type: '', // Empty type
                slot: ''  // Empty slot
            };

            const invalidResult = result.current.validateWidget(invalidWidget);
            expect(invalidResult.isValid).toBe(false);
            expect(invalidResult.errors.length).toBeGreaterThan(0);
        });

        it('should validate operations', () => {
            const { result } = renderHook(() => useValidation(), {
                wrapper: TestWrapper
            });

            const validOperation = {
                type: OperationTypes.UPDATE_WIDGET_CONFIG,
                payload: {
                    id: 'widget-1',
                    config: { title: 'Valid Config' }
                }
            };

            const validResult = result.current.validateOperation(validOperation);
            expect(validResult.isValid).toBe(true);

            const invalidOperation = {
                type: 'INVALID_TYPE' as any,
                payload: null
            };

            const invalidResult = result.current.validateOperation(invalidOperation);
            expect(invalidResult.isValid).toBe(false);
        });

        it('should add and remove custom validation rules', () => {
            const { result } = renderHook(() => useValidation(), {
                wrapper: TestWrapper
            });

            const customRule = {
                name: 'custom-title-length',
                severity: 'warning' as const,
                validate: (page: any) => ({
                    isValid: true,
                    errors: [],
                    warnings: page.title && page.title.length > 100 ? [{
                        field: 'title',
                        message: 'Title is very long',
                        code: 'LONG_TITLE'
                    }] : []
                })
            };

            act(() => {
                result.current.addValidationRule('page', customRule);
            });

            // Test page with long title
            const pageWithLongTitle = {
                id: 'page-1',
                title: 'A'.repeat(150), // Very long title
                slug: 'test-page',
                status: 'draft' as const,
                metadata: {},
                layout: 'single_column',
                version: 'v1',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const result1 = result.current.validatePage(pageWithLongTitle);
            expect(result1.warnings.length).toBeGreaterThan(0);

            // Remove custom rule
            act(() => {
                result.current.removeValidationRule('page', 'custom-title-length');
            });

            const result2 = result.current.validatePage(pageWithLongTitle);
            expect(result2.warnings.length).toBe(0);
        });
    });

    describe('usePerformanceMonitor', () => {
        it('should initialize monitoring', () => {
            const { result } = renderHook(() => usePerformanceMonitor(), {
                wrapper: TestWrapper
            });

            expect(result.current.isMonitoring).toBe(false);
            expect(result.current.metrics.totalOperations).toBe(0);
            expect(result.current.performanceScore).toBe(100);
        });

        it('should start and stop monitoring', () => {
            const { result } = renderHook(() => usePerformanceMonitor(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.startMonitoring();
            });

            expect(result.current.isMonitoring).toBe(true);

            act(() => {
                result.current.stopMonitoring();
            });

            expect(result.current.isMonitoring).toBe(false);
        });

        it('should reset metrics', () => {
            const { result } = renderHook(() => usePerformanceMonitor(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.resetMetrics();
            });

            expect(result.current.metrics.totalOperations).toBe(0);
            expect(result.current.metrics.slowestOperations).toHaveLength(0);
        });

        it('should provide optimization suggestions', () => {
            const { result } = renderHook(() => usePerformanceMonitor(), {
                wrapper: TestWrapper
            });

            const suggestions = result.current.getOptimizationSuggestions();
            expect(Array.isArray(suggestions)).toBe(true);
        });
    });

    describe('Integration', () => {
        it('should work together for complete data management', () => {
            const { result } = renderHook(() => {
                const autoSave = useAutoSave({ interval: 5000 });
                const validation = useValidation();
                const performance = usePerformanceMonitor();

                return { autoSave, validation, performance };
            }, {
                wrapper: TestWrapper
            });

            // All systems should be available
            expect(result.current.autoSave).toBeDefined();
            expect(result.current.validation).toBeDefined();
            expect(result.current.performance).toBeDefined();

            // Should have consistent state
            expect(result.current.validation.isStateValid).toBe(true);
            expect(result.current.performance.performanceScore).toBe(100);
        });
    });
});
