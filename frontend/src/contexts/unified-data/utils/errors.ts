import { Operation } from '../types/operations';

/**
 * Custom error types for UnifiedDataContext
 */

export class OperationError extends Error {
    constructor(
        public operation: Operation,
        public code: string,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'OperationError';
    }
}

export class ValidationError extends OperationError {
    constructor(operation: Operation, message: string, details?: any) {
        super(operation, 'VALIDATION_ERROR', message, details);
        this.name = 'ValidationError';
    }
}

export class StateError extends Error {
    constructor(
        public code: string,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'StateError';
    }
}

export const ErrorCodes = {
    // Validation errors
    INVALID_OPERATION: 'INVALID_OPERATION',
    INVALID_PAYLOAD: 'INVALID_PAYLOAD',
    INVALID_STATE: 'INVALID_STATE',
    
    // Operation errors
    OPERATION_FAILED: 'OPERATION_FAILED',
    OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
    OPERATION_CONFLICT: 'OPERATION_CONFLICT',
    
    // State errors
    INVALID_INITIAL_STATE: 'INVALID_INITIAL_STATE',
    INVALID_STATE_UPDATE: 'INVALID_STATE_UPDATE',
    STATE_CONFLICT: 'STATE_CONFLICT',
    
    // Subscription errors
    SUBSCRIPTION_ERROR: 'SUBSCRIPTION_ERROR',
    
    // System errors
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    
    // Context errors
    NO_ACTIVE_CONTEXT: 'NO_ACTIVE_CONTEXT',
    INVALID_CONTEXT: 'INVALID_CONTEXT'
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

/**
 * Determines if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
    if (error instanceof OperationError) {
        return [
            ErrorCodes.OPERATION_TIMEOUT,
            ErrorCodes.OPERATION_CONFLICT,
            ErrorCodes.STATE_CONFLICT
        ].includes(error.code as any);
    }
    return false;
}
