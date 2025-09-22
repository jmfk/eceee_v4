import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UnifiedDataProvider } from '../v2/context/UnifiedDataContext';
import { useAutoSave } from '../v2/hooks/useAutoSave';
import { useValidation } from '../v2/hooks/useValidation';
import { OperationTypes } from '../v2/types/operations';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <UnifiedDataProvider
        initialState={{}}
        options={{
            enableAPIIntegration: false,
            enableAutoSave: true,
            enableValidation: true
        }}
    >
        {children}
    </UnifiedDataProvider>
);

describe('Auto-save and Validation Features v2', () => {
    describe('useAutoSave', () => {
        it('should initialize with default configuration', () => {
            const { result } = renderHook(() => useAutoSave(), {
                wrapper: TestWrapper
            });

            expect(result.current.isEnabled).toBe(true);
            expect(result.current.getConfig().interval).toBe(30000);
            expect(result.current.getSaveStats().totalSaves).toBe(0);
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

            expect(result.current.getConfig().interval).toBe(60000);
            expect(result.current.isEnabled).toBe(false);
        });

        it('should start and stop auto-save', () => {
            const { result } = renderHook(() => useAutoSave({ enabled: false }), {
                wrapper: TestWrapper
            });

            expect(result.current.isEnabled).toBe(false);

            act(() => {
                result.current.start();
            });

            expect(result.current.isEnabled).toBe(true);

            act(() => {
                result.current.stop();
            });

            expect(result.current.isEnabled).toBe(false);
        });

        it('should force save immediately', async () => {
            const { result } = renderHook(() => useAutoSave(), {
                wrapper: TestWrapper
            });

            await act(async () => {
                await result.current.forceSave();
            });

            expect(result.current.getLastError()).toBeNull();
            expect(result.current.getSaveStats().lastSaveTime).toBeDefined();
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
                slotName: 'main',
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
                slotName: ''  // Empty slot
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
                    widgetId: 'widget-1',
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

        it('should validate field values', () => {
            const { result } = renderHook(() => useValidation(), {
                wrapper: TestWrapper
            });

            const validField = {
                type: 'text',
                value: 'Valid text',
                required: true
            };

            const validResult = result.current.validateField(validField);
            expect(validResult.isValid).toBe(true);

            const invalidField = {
                ...validField,
                value: '' // Empty required field
            };

            const invalidResult = result.current.validateField(invalidField);
            expect(invalidResult.isValid).toBe(false);
            expect(invalidResult.errors[0].code).toBe('REQUIRED_FIELD');
        });

        it('should validate form data', () => {
            const { result } = renderHook(() => useValidation(), {
                wrapper: TestWrapper
            });

            const validForm = {
                id: 'form-1',
                fields: {
                    title: {
                        type: 'text',
                        value: 'Valid Title',
                        required: true
                    },
                    description: {
                        type: 'textarea',
                        value: 'Valid Description',
                        required: false
                    }
                }
            };

            const validResult = result.current.validateForm(validForm);
            expect(validResult.isValid).toBe(true);

            const invalidForm = {
                ...validForm,
                fields: {
                    ...validForm.fields,
                    title: {
                        ...validForm.fields.title,
                        value: '' // Empty required field
                    }
                }
            };

            const invalidResult = result.current.validateForm(invalidForm);
            expect(invalidResult.isValid).toBe(false);
            expect(invalidResult.errors[0].field).toBe('title');
        });
    });

    describe('Integration', () => {
        it('should work together for complete data management', () => {
            const { result } = renderHook(() => {
                const autoSave = useAutoSave({ interval: 5000 });
                const validation = useValidation();

                return { autoSave, validation };
            }, {
                wrapper: TestWrapper
            });

            // All systems should be available
            expect(result.current.autoSave).toBeDefined();
            expect(result.current.validation).toBeDefined();

            // Should have consistent state
            expect(result.current.validation.isStateValid()).toBe(true);
            expect(result.current.autoSave.getSaveStats().totalSaves).toBe(0);
        });

        it('should validate before auto-saving', async () => {
            const { result } = renderHook(() => {
                const autoSave = useAutoSave({ interval: 5000 });
                const validation = useValidation();

                return { autoSave, validation };
            }, {
                wrapper: TestWrapper
            });

            // Add invalid data
            act(() => {
                result.current.validation.addValidationError({
                    field: 'title',
                    message: 'Title is required',
                    code: 'REQUIRED_FIELD'
                });
            });

            // Try to auto-save
            await act(async () => {
                await result.current.autoSave.forceSave();
            });

            // Should not have saved due to validation error
            expect(result.current.autoSave.getLastError()?.code).toBe('VALIDATION_ERROR');
            expect(result.current.validation.getErrors()).toHaveLength(1);
        });
    });
});