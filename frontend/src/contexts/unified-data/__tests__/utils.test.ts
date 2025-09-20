import { defaultEqualityFn, shallowEqual, deepEqual } from '../utils/equality';
import { OperationError, ValidationError, StateError, ErrorCodes, isRetryableError } from '../utils/errors';

describe('Utility Functions', () => {
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
    });

    describe('Error Classes', () => {
        describe('OperationError', () => {
            it('should create operation error with details', () => {
                const operation = {
                    type: 'UPDATE_WIDGET_CONFIG',
                    payload: { id: 'widget1', config: {} }
                };

                const error = new OperationError(
                    operation,
                    'TEST_ERROR',
                    'Test error message',
                    { detail: 'test' }
                );

                expect(error.name).toBe('OperationError');
                expect(error.operation).toBe(operation);
                expect(error.code).toBe('TEST_ERROR');
                expect(error.message).toBe('Test error message');
                expect(error.details).toEqual({ detail: 'test' });
            });
        });

        describe('ValidationError', () => {
            it('should create validation error', () => {
                const operation = {
                    type: 'UPDATE_WIDGET_CONFIG',
                    payload: { id: null, config: null }
                };

                const error = new ValidationError(
                    operation,
                    'Invalid payload',
                    { field: 'id' }
                );

                expect(error.name).toBe('ValidationError');
                expect(error.code).toBe('VALIDATION_ERROR');
                expect(error.message).toBe('Invalid payload');
            });
        });

        describe('StateError', () => {
            it('should create state error', () => {
                const error = new StateError(
                    'INVALID_STATE',
                    'State is invalid',
                    { reason: 'missing field' }
                );

                expect(error.name).toBe('StateError');
                expect(error.code).toBe('INVALID_STATE');
                expect(error.message).toBe('State is invalid');
                expect(error.details).toEqual({ reason: 'missing field' });
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
            expect(ErrorCodes.SYSTEM_ERROR).toBeDefined();
        });
    });
});
