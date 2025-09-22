import { useCallback, useEffect } from 'react';
import { useUnifiedData } from '../context/UnifiedDataContext';
import { PathString } from '../types/paths';

export interface ObjectRegistrationOptions {
    // Initial data
    initialData?: Record<string, any>;
    // Whether to preserve local changes on external updates
    preserveLocalChanges?: boolean;
    // Validation options
    validateOnRegister?: boolean;
    // Metadata
    metadata?: Record<string, any>;
}

/**
 * Hook to manage object registration and lifecycle in UnifiedDataContext
 */
export function useObjectRegistration(
    objectId: string,
    options: ObjectRegistrationOptions = {}
) {
    const {
        initialData,
        preserveLocalChanges = true,
        validateOnRegister = false,
        metadata = {}
    } = options;

    const { get, set, subscribe } = useUnifiedData();
    const objectPath = `object.${objectId}` as PathString;

    // Register object in context
    const registerObject = useCallback(async () => {
        try {
            // Check if object already exists
            const existingData = get(objectPath);
            if (!existingData && initialData) {
                // Register initial data
                set({
                    path: objectPath,
                    value: initialData,
                    metadata: {
                        registeredAt: new Date().toISOString(),
                        ...metadata
                    }
                });

                // Validate if needed
                if (validateOnRegister) {
                    // TODO: Add validation logic
                }
            }
            return true;
        } catch (error) {
            console.error('Failed to register object:', error);
            return false;
        }
    }, [objectPath, initialData, metadata, validateOnRegister, get, set]);

    // Cleanup on unmount
    const unregisterObject = useCallback(() => {
        try {
            // We don't actually delete the object data, just mark it as unregistered
            const existingData = get(objectPath);
            if (existingData) {
                set({
                    path: objectPath,
                    value: existingData,
                    metadata: {
                        ...metadata,
                        unregisteredAt: new Date().toISOString(),
                        active: false
                    }
                });
            }
            return true;
        } catch (error) {
            console.error('Failed to unregister object:', error);
            return false;
        }
    }, [objectPath, metadata, get, set]);

    // Handle external updates
    useEffect(() => {
        if (!preserveLocalChanges) {
            return subscribe(
                objectPath,
                (newData) => {
                    if (newData) {
                        set({
                            path: objectPath,
                            value: newData,
                            metadata: {
                                lastExternalUpdate: new Date().toISOString(),
                                ...metadata
                            }
                        });
                    }
                },
                { includeChildren: true }
            );
        }
    }, [objectPath, preserveLocalChanges, metadata, set, subscribe]);

    // Register on mount
    useEffect(() => {
        registerObject();
        return () => {
            unregisterObject();
        };
    }, [registerObject, unregisterObject]);

    return {
        isRegistered: !!get(objectPath),
        registerObject,
        unregisterObject
    };
}
