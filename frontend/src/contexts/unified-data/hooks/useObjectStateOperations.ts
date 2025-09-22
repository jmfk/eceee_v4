/**
 * Hook for managing object state operations in UnifiedDataContext
 * Handles core state like isDirty, hasErrors, etc.
 */

import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { ValidationError } from '../types/state';

export interface UseObjectStateOperations {
    // State Management
    markDirty: (source?: 'user' | 'system') => void;
    markClean: () => void;
    
    // Error Management
    setErrors: (errors: ValidationError[], source?: string) => void;
    clearErrors: (source?: string) => void;
    
    // State Access (non-reactive)
    isDirty: () => boolean;
    hasErrors: () => boolean;
    getErrors: () => ValidationError[];
}

export function useObjectStateOperations(objectId: string): UseObjectStateOperations {
    const { dispatch, getState } = useUnifiedData();

    /**
     * Mark object as dirty
     */
    const markDirty = useCallback((source: 'user' | 'system' = 'user') => {
        dispatch({
            type: 'SET_DIRTY',
            payload: {
                id: objectId,
                isDirty: true
            },
            metadata: {
                source,
                timestamp: Date.now()
            }
        });
    }, [objectId, dispatch]);

    /**
     * Mark object as clean (typically after save)
     */
    const markClean = useCallback(() => {
        dispatch({
            type: 'SET_DIRTY',
            payload: {
                id: objectId,
                isDirty: false
            },
            metadata: {
                source: 'system',
                timestamp: Date.now()
            }
        });
    }, [objectId, dispatch]);

    /**
     * Set validation errors
     */
    const setErrors = useCallback((errors: ValidationError[], source?: string) => {
        dispatch({
            type: 'SET_ERRORS',
            payload: {
                id: objectId,
                errors
            },
            metadata: {
                source: source || 'system',
                timestamp: Date.now()
            }
        });
    }, [objectId, dispatch]);

    /**
     * Clear validation errors
     */
    const clearErrors = useCallback((source?: string) => {
        dispatch({
            type: 'CLEAR_ERRORS',
            payload: {
                id: objectId
            },
            metadata: {
                source: source || 'system',
                timestamp: Date.now()
            }
        });
    }, [objectId, dispatch]);

    /**
     * Check if object is dirty (non-reactive)
     */
    const isDirty = useCallback((): boolean => {
        const state = getState();
        return state.objects?.[objectId]?.metadata?.isDirty || false;
    }, [objectId, getState]);

    /**
     * Check if object has errors (non-reactive)
     */
    const hasErrors = useCallback((): boolean => {
        const state = getState();
        const errors = state.objects?.[objectId]?.metadata?.errors || [];
        return errors.length > 0;
    }, [objectId, getState]);

    /**
     * Get current errors (non-reactive)
     */
    const getErrors = useCallback((): ValidationError[] => {
        const state = getState();
        return state.objects?.[objectId]?.metadata?.errors || [];
    }, [objectId, getState]);

    return {
        markDirty,
        markClean,
        setErrors,
        clearErrors,
        isDirty,
        hasErrors,
        getErrors
    };
}

export default useObjectStateOperations;
