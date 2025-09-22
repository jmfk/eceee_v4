import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { Operation } from '../types/operations';

export function useStatusOperations() {
    const { dispatch, get } = useUnifiedData();

    const getValidationState = useCallback(() => {
        const metadata = get('metadata');
        return {
            isValid: !metadata.errors || Object.keys(metadata.errors).length === 0,
            errors: metadata.errors || {},
            warnings: metadata.warnings || [],
            isValidating: metadata.isValidating || false
        };
    }, [get]);

    const getSaveState = useCallback(() => {
        const metadata = get('metadata');
        return {
            isDirty: metadata.isDirty || false,
            hasUnsavedChanges: metadata.hasUnsavedChanges || false,
            isLoading: metadata.isLoading || false,
            canSave: (metadata.isDirty || metadata.hasUnsavedChanges) && !metadata.isLoading && !metadata.isValidating,
            canSaveNew: !metadata.isLoading && !metadata.isValidating
        };
    }, [get]);

    const handleSave = useCallback(async () => {
        await dispatch({
            type: 'SAVE_CHANGES',
            payload: {}
        } as Operation);
    }, [dispatch]);

    const handleSaveNew = useCallback(async () => {
        await dispatch({
            type: 'SAVE_NEW_VERSION',
            payload: {}
        } as Operation);
    }, [dispatch]);

    const clearErrors = useCallback(() => {
        dispatch({
            type: 'CLEAR_ERRORS',
            payload: {}
        } as Operation);
    }, [dispatch]);

    const setError = useCallback((error: any) => {
        dispatch({
            type: 'SET_ERROR',
            payload: { error }
        } as Operation);
    }, [dispatch]);

    const setWarning = useCallback((warning: any) => {
        dispatch({
            type: 'SET_WARNING',
            payload: { warning }
        } as Operation);
    }, [dispatch]);

    const setLoading = useCallback((isLoading: boolean) => {
        dispatch({
            type: 'SET_LOADING',
            payload: { isLoading }
        } as Operation);
    }, [dispatch]);

    const setDirty = useCallback((isDirty: boolean) => {
        dispatch({
            type: 'SET_DIRTY',
            payload: { isDirty }
        } as Operation);
    }, [dispatch]);

    const setHasUnsavedChanges = useCallback((hasUnsavedChanges: boolean) => {
        dispatch({
            type: 'SET_HAS_UNSAVED_CHANGES',
            payload: { hasUnsavedChanges }
        } as Operation);
    }, [dispatch]);

    return {
        getValidationState,
        getSaveState,
        handleSave,
        handleSaveNew,
        clearErrors,
        setError,
        setWarning,
        setLoading,
        setDirty,
        setHasUnsavedChanges
    };
}
