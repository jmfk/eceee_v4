import { Operation } from '../types/operations';

/**
 * Error codes for UnifiedDataContext v2
 */
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
    SUBSCRIPTION_TIMEOUT: 'SUBSCRIPTION_TIMEOUT',
    
    // Form errors
    FORM_VALIDATION_ERROR: 'FORM_VALIDATION_ERROR',
    FORM_SUBMISSION_ERROR: 'FORM_SUBMISSION_ERROR',
    
    // Field errors
    FIELD_VALIDATION_ERROR: 'FIELD_VALIDATION_ERROR',
    FIELD_TYPE_ERROR: 'FIELD_TYPE_ERROR',
    
    // System errors
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR'
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

/**
 * Base error class for UnifiedDataContext v2
 */
export class UnifiedDataError extends Error {
    constructor(
        public code: ErrorCode,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'UnifiedDataError';
        
        // Ensure proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, new.target.prototype);
    }

    /**
     * Serialize error for logging or transmission
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            details: this.details
        };
    }
}

/**
 * Operation-specific error class
 */
export class OperationError extends UnifiedDataError {
    constructor(
        public operation: Operation,
        code: ErrorCode,
        message: string,
        details?: any
    ) {
        super(code, message, details);
        this.name = 'OperationError';
    }

    toJSON() {
        return {
            ...super.toJSON(),
            operation: this.operation
        };
    }
}

/**
 * Validation-specific error class
 */
export class ValidationError extends OperationError {
    constructor(
        operation: Operation,
        message: string,
        public validationErrors: Record<string, string[]>,
        details?: any
    ) {
        super(operation, ErrorCodes.INVALID_PAYLOAD, message, details);
        this.name = 'ValidationError';
    }

    toJSON() {
        return {
            ...super.toJSON(),
            validationErrors: this.validationErrors
        };
    }
}

/**
 * State-specific error class
 */
export class StateError extends UnifiedDataError {
    constructor(code: ErrorCode, message: string, details?: any) {
        super(code, message, details);
        this.name = 'StateError';
    }
}

/**
 * Form-specific error class
 */
export class FormError extends UnifiedDataError {
    constructor(
        public formId: string,
        code: ErrorCode,
        message: string,
        public fieldErrors?: Record<string, string[]>,
        details?: any
    ) {
        super(code, message, details);
        this.name = 'FormError';
    }

    toJSON() {
        return {
            ...super.toJSON(),
            formId: this.formId,
            fieldErrors: this.fieldErrors
        };
    }
}

/**
 * Field-specific error class
 */
export class FieldError extends UnifiedDataError {
    constructor(
        public fieldId: string,
        public fieldPath: string,
        code: ErrorCode,
        message: string,
        details?: any
    ) {
        super(code, message, details);
        this.name = 'FieldError';
    }

    toJSON() {
        return {
            ...super.toJSON(),
            fieldId: this.fieldId,
            fieldPath: this.fieldPath
        };
    }
}

/**
 * Determines if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
    if (error instanceof UnifiedDataError) {
        return [
            ErrorCodes.OPERATION_TIMEOUT,
            ErrorCodes.OPERATION_CONFLICT,
            ErrorCodes.STATE_CONFLICT,
            ErrorCodes.NETWORK_ERROR,
            ErrorCodes.SUBSCRIPTION_TIMEOUT
        ].includes(error.code);
    }
    return false;
}

/**
 * Creates a retry strategy for retryable errors
 */
export function createRetryStrategy(
    maxRetries: number = 3,
    baseDelay: number = 1000,
    maxDelay: number = 5000
) {
    return async function retry<T>(
        operation: () => Promise<T>,
        attempt: number = 1
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (!(error instanceof Error) || !isRetryableError(error) || attempt >= maxRetries) {
                throw error;
            }

            const delay = Math.min(
                baseDelay * Math.pow(2, attempt - 1),
                maxDelay
            );

            await new Promise(resolve => setTimeout(resolve, delay));
            return retry(operation, attempt + 1);
        }
    };
}

/**
 * Error boundary helper for async operations
 */
export async function withErrorBoundary<T>(
    operation: () => Promise<T>,
    errorHandler?: (error: Error) => void
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (errorHandler && error instanceof Error) {
            errorHandler(error);
        }
        throw error;
    }
}
