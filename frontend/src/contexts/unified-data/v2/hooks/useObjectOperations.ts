import { useCallback } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { validateObjectData } from '../utils/validation';
import { ObjectData, ObjectOperations } from '../types/object-operations';

/**
 * Hook for managing object operations in the v2 context
 * 
 * Features:
 * - Granular state updates
 * - Validation
 * - Error handling
 * - Real-time sync
 */
export function useObjectOperations(objectId?: string): ObjectOperations {
    const { get, dispatch } = useUnifiedData();

    // Get object state
    const getObjectState = useCallback(() => {
        if (!objectId) return null;
        return get(`objects.${objectId}`) || null;
    }, [get, objectId]);

    // Get current data (includes all object data)
    const getCurrentData = useCallback(() => {
        if (!objectId) return null;
        return get(`objects.${objectId}`) || null;
    }, [get, objectId]);

    // Update object data
    const updateObjectData = useCallback(async (data: Partial<ObjectData>) => {
        if (!objectId) return;

        try {
            // Validate data before updating
            const isValid = await validateObjectData(data);
            if (!isValid) {
                throw new Error('Invalid object data');
            }

            // Update object data
            await dispatch({
                type: 'UPDATE_OBJECT_DATA',
                payload: {
                    objectId,
                    data
                }
            });
        } catch (error) {
            console.error('Failed to update object data:', error);
            throw error;
        }
    }, [objectId, dispatch]);

    // Update object title
    const updateObjectTitle = useCallback(async (title: string) => {
        if (!objectId) return;

        try {
            await dispatch({
                type: 'UPDATE_OBJECT_TITLE',
                payload: {
                    objectId,
                    title
                }
            });
        } catch (error) {
            console.error('Failed to update object title:', error);
            throw error;
        }
    }, [objectId, dispatch]);

    // Update object metadata
    const updateObjectMetadata = useCallback(async (metadata: Record<string, any>) => {
        if (!objectId) return;

        try {
            await dispatch({
                type: 'UPDATE_OBJECT_METADATA',
                payload: {
                    objectId,
                    metadata
                }
            });
        } catch (error) {
            console.error('Failed to update object metadata:', error);
            throw error;
        }
    }, [objectId, dispatch]);

    // Update object status
    const updateObjectStatus = useCallback(async (status: string) => {
        if (!objectId) return;

        try {
            await dispatch({
                type: 'UPDATE_OBJECT_STATUS',
                payload: {
                    objectId,
                    status
                }
            });
        } catch (error) {
            console.error('Failed to update object status:', error);
            throw error;
        }
    }, [objectId, dispatch]);

    // Save object
    const saveObject = useCallback(async () => {
        if (!objectId) return;

        try {
            // Validate object before saving
            const objectState = getObjectState();
            if (!objectState) {
                throw new Error('Object not found');
            }

            const isValid = await validateObjectData(objectState);
            if (!isValid) {
                throw new Error('Invalid object data');
            }

            // Save object
            await dispatch({
                type: 'SAVE_OBJECT',
                payload: {
                    objectId
                }
            });
        } catch (error) {
            console.error('Failed to save object:', error);
            throw error;
        }
    }, [objectId, dispatch, getObjectState]);

    // Reset object
    const resetObject = useCallback(async () => {
        if (!objectId) return;

        try {
            await dispatch({
                type: 'RESET_OBJECT',
                payload: {
                    objectId
                }
            });
        } catch (error) {
            console.error('Failed to reset object:', error);
            throw error;
        }
    }, [objectId, dispatch]);

    // Validate object
    const validateObject = useCallback(async () => {
        if (!objectId) return false;

        try {
            const objectState = getObjectState();
            if (!objectState) {
                throw new Error('Object not found');
            }

            return await validateObjectData(objectState);
        } catch (error) {
            console.error('Failed to validate object:', error);
            return false;
        }
    }, [objectId, getObjectState]);

    return {
        // State
        getObjectState,
        getCurrentData,

        // Operations
        updateObjectData,
        updateObjectTitle,
        updateObjectMetadata,
        updateObjectStatus,
        saveObject,
        resetObject,
        validateObject,

        // Derived state
        isDirty: Boolean(get(`objects.${objectId}.isDirty`)),
        hasUnsavedChanges: Boolean(get(`objects.${objectId}.hasUnsavedChanges`)),
        isLoading: Boolean(get(`objects.${objectId}.isLoading`)),
        errors: get(`objects.${objectId}.errors`) || []
    };
}