import {
    defaultEqualityFn,
    shallowEqual,
    deepEqual,
    arrayEqual,
    memoizedEqualityFn
} from '../v2/utils/equality';
import {
    UnifiedDataError,
    OperationError,
    ValidationError,
    StateError,
    FormError,
    FieldError,
    ErrorCodes,
    isRetryableError,
    createRetryStrategy,
    withErrorBoundary
} from '../v2/utils/errors';
import { Operation } from '../v2/types/operations';

describe('Utility Functions v2', () => {
    describe('Equality Functions', () => {
        describe('defaultEqualityFn', () => {
            it('should handle primitive values', () => {
                expect(defaultEqualityFn(1, 1)).toBe(true);
                expect(defaultEqualityFn('hello', 'hello')).toBe(true);
                expect(defaultEqualityFn(true, true)).toBe(true);
                expect(defaultEqualityFn(null, null)).toBe(true);
                expect(defaultEqualityFn(undefined, undefined)).toBe(true);

                expect(defaultEqualityFn(1, 2)).toBe(false);
                expect(defaultEqualityFn('hello', 'world')).toBe(false);
                expect(defaultEqualityFn(true, false)).toBe(false);
                expect(defaultEqualityFn(null, undefined)).toBe(false);
            });

            it('should handle arrays', () => {
                expect(defaultEqualityFn([1, 2, 3], [1, 2, 3])).toBe(true);
                expect(defaultEqualityFn([], [])).toBe(true);
                
                expect(defaultEqualityFn([1, 2, 3], [1, 2, 4])).toBe(false);
                expect(defaultEqualityFn([1, 2], [1, 2, 3])).toBe(false);
            });

            it('should handle objects', () => {
                expect(defaultEqualityFn(
                    { a: 1, b: 2 },
                    { a: 1, b: 2 }
                )).toBe(true);

                expect(defaultEqualityFn({}, {})).toBe(true);

                expect(defaultEqualityFn(
                    { a: 1, b: 2 },
                    { a: 1, b: 3 }
                )).toBe(false);

                expect(defaultEqualityFn(
                    { a: 1 },
                    { a: 1, b: 2 }
                )).toBe(false);
            });

            it('should handle nested structures', () => {
                expect(defaultEqualityFn(
                    { arr: [1, 2], obj: { x: 1 } },
                    { arr: [1, 2], obj: { x: 1 } }
                )).toBe(true);

                expect(defaultEqualityFn(
                    { arr: [1, 2], obj: { x: 1 } },
                    { arr: [1, 3], obj: { x: 1 } }
                )).toBe(false);
            });
        });

        describe('shallowEqual', () => {
            it('should handle shallow object comparison', () => {
                const obj1 = { a: 1, b: 'hello' };
                const obj2 = { a: 1, b: 'hello' };
                const obj3 = { a: 1, b: 'world' };

                expect(shallowEqual(obj1, obj2)).toBe(true);
                expect(shallowEqual(obj1, obj3)).toBe(false);
            });

            it('should not deep compare nested objects', () => {
                const obj1 = { nested: { a: 1 } };
                const obj2 = { nested: { a: 1 } };

                // Different object references, so should be false
                expect(shallowEqual(obj1, obj2)).toBe(false);
            });
        });

        describe('arrayEqual', () => {
            it('should compare arrays with custom comparison', () => {
                const arr1 = [{ id: 1 }, { id: 2 }];
                const arr2 = [{ id: 1 }, { id: 2 }];
                const arr3 = [{ id: 1 }, { id: 3 }];

                const compareById = (a: any, b: any) => a.id === b.id;

                expect(arrayEqual(arr1, arr2, compareById)).toBe(true);
                expect(arrayEqual(arr1, arr3, compareById)).toBe(false);
            });
        });

        describe('memoizedEqualityFn', () => {
            it('should cache comparison results', () => {
                const compare = memoizedEqualityFn();
                const obj1 = { a: 1, b: { c: 2 } };
                const obj2 = { a: 1, b: { c: 2 } };

                // First comparison
                expect(compare(obj1, obj2)).toBe(true);

                // Should use cached result
                expect(compare(obj1, obj2)).toBe(true);
            });
        });
    });

    describe('Error Classes', () => {
        describe('UnifiedDataError', () => {
            it('should create base error with metadata', () => {
                const error = new UnifiedDataError(
                    ErrorCodes.SYSTEM_ERROR,
                    'System error occurred',
                    { detail: 'test' }
                );

                expect(error.name).toBe('UnifiedDataError');
                expect(error.code).toBe(ErrorCodes.SYSTEM_ERROR);
                expect(error.message).toBe('System error occurred');
                expect(error.details).toEqual({ detail: 'test' });

                const json = error.toJSON();
                expect(json.name).toBe('UnifiedDataError');
                expect(json.code).toBe(ErrorCodes.SYSTEM_ERROR);
            });
        });

        describe('OperationError', () => {
            it('should create operation error with details', () => {
                const operation: Operation = {
                    type: 'UPDATE_WIDGET_CONFIG',
                    payload: { widgetId: 'widget1', config: {} }
                };

                const error = new OperationError(
                    operation,
                    ErrorCodes.OPERATION_FAILED,
                    'Operation failed',
                    { detail: 'test' }
                );

                expect(error.name).toBe('OperationError');
                expect(error.operation).toBe(operation);
                expect(error.code).toBe(ErrorCodes.OPERATION_FAILED);

                const json = error.toJSON();
                expect(json.operation).toBe(operation);
            });
        });

        describe('ValidationError', () => {
            it('should create validation error with field errors', () => {
                const operation: Operation = {
                    type: 'UPDATE_WIDGET_CONFIG',
                    payload: { widgetId: null, config: null }
                };

                const validationErrors = {
                    widgetId: ['Widget ID is required'],
                    config: ['Config is required']
                };

                const error = new ValidationError(
                    operation,
                    'Validation failed',
                    validationErrors,
                    { detail: 'test' }
                );

                expect(error.name).toBe('ValidationError');
                expect(error.validationErrors).toBe(validationErrors);

                const json = error.toJSON();
                expect(json.validationErrors).toBe(validationErrors);
            });
        });

        describe('FormError', () => {
            it('should create form error with field errors', () => {
                const fieldErrors = {
                    title: ['Title is required'],
                    content: ['Content is too short']
                };

                const error = new FormError(
                    'form1',
                    ErrorCodes.FORM_VALIDATION_ERROR,
                    'Form validation failed',
                    fieldErrors,
                    { detail: 'test' }
                );

                expect(error.name).toBe('FormError');
                expect(error.formId).toBe('form1');
                expect(error.fieldErrors).toBe(fieldErrors);

                const json = error.toJSON();
                expect(json.formId).toBe('form1');
                expect(json.fieldErrors).toBe(fieldErrors);
            });
        });

        describe('FieldError', () => {
            it('should create field error with path', () => {
                const error = new FieldError(
                    'field1',
                    'form.section.field1',
                    ErrorCodes.FIELD_VALIDATION_ERROR,
                    'Field validation failed',
                    { detail: 'test' }
                );

                expect(error.name).toBe('FieldError');
                expect(error.fieldId).toBe('field1');
                expect(error.fieldPath).toBe('form.section.field1');

                const json = error.toJSON();
                expect(json.fieldId).toBe('field1');
                expect(json.fieldPath).toBe('form.section.field1');
            });
        });
    });

    describe('Error Utilities', () => {
        describe('isRetryableError', () => {
            it('should identify retryable errors', () => {
                const retryableError = new OperationError(
                    { type: 'TEST', payload: {} },
                    ErrorCodes.OPERATION_TIMEOUT,
                    'Timeout error'
                );

                const nonRetryableError = new OperationError(
                    { type: 'TEST', payload: {} },
                    ErrorCodes.INVALID_OPERATION,
                    'Invalid operation'
                );

                expect(isRetryableError(retryableError)).toBe(true);
                expect(isRetryableError(nonRetryableError)).toBe(false);
                expect(isRetryableError(new Error('Regular error'))).toBe(false);
            });
        });

        describe('createRetryStrategy', () => {
            it('should retry operations with exponential backoff', async () => {
                const retryStrategy = createRetryStrategy(3, 100, 500);
                let attempts = 0;

                const operation = async () => {
                    attempts++;
                    if (attempts < 3) {
                        throw new OperationError(
                            { type: 'TEST', payload: {} },
                            ErrorCodes.OPERATION_TIMEOUT,
                            'Timeout'
                        );
                    }
                    return 'success';
                };

                const result = await retryStrategy(operation);
                expect(result).toBe('success');
                expect(attempts).toBe(3);
            });

            it('should respect max retries', async () => {
                const retryStrategy = createRetryStrategy(2, 100, 500);
                let attempts = 0;

                const operation = async () => {
                    attempts++;
                    throw new OperationError(
                        { type: 'TEST', payload: {} },
                        ErrorCodes.OPERATION_TIMEOUT,
                        'Timeout'
                    );
                };

                await expect(retryStrategy(operation)).rejects.toThrow('Timeout');
                expect(attempts).toBe(2);
            });
        });

        describe('withErrorBoundary', () => {
            it('should handle errors with custom handler', async () => {
                const errorHandler = vi.fn();

                await expect(
                    withErrorBoundary(
                        async () => {
                            throw new Error('Test error');
                        },
                        errorHandler
                    )
                ).rejects.toThrow('Test error');

                expect(errorHandler).toHaveBeenCalled();
            });
        });
    });

    describe('Error Codes', () => {
        it('should have all required error codes', () => {
            expect(ErrorCodes.INVALID_OPERATION).toBeDefined();
            expect(ErrorCodes.INVALID_PAYLOAD).toBeDefined();
            expect(ErrorCodes.OPERATION_FAILED).toBeDefined();
            expect(ErrorCodes.OPERATION_TIMEOUT).toBeDefined();
            expect(ErrorCodes.OPERATION_CONFLICT).toBeDefined();
            expect(ErrorCodes.INVALID_INITIAL_STATE).toBeDefined();
            expect(ErrorCodes.SUBSCRIPTION_ERROR).toBeDefined();
            expect(ErrorCodes.SUBSCRIPTION_TIMEOUT).toBeDefined();
            expect(ErrorCodes.FORM_VALIDATION_ERROR).toBeDefined();
            expect(ErrorCodes.FORM_SUBMISSION_ERROR).toBeDefined();
            expect(ErrorCodes.FIELD_VALIDATION_ERROR).toBeDefined();
            expect(ErrorCodes.FIELD_TYPE_ERROR).toBeDefined();
            expect(ErrorCodes.SYSTEM_ERROR).toBeDefined();
            expect(ErrorCodes.NETWORK_ERROR).toBeDefined();
        });
    });
});