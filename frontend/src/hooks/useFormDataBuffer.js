import { useRef, useCallback, useImperativeHandle } from 'react';

/**
 * Custom hook for buffering form data changes without triggering re-renders.
 * Useful for performance optimization in complex forms where you want to:
 * - Accumulate changes without re-rendering
 * - Batch updates before saving
 * - Maintain dirty state tracking
 * - Provide imperative save functionality
 * 
 * @param {Object} initialData - Initial form data
 * @param {Function} onSave - Callback function called when save is triggered
 * @param {Object} options - Configuration options
 * @param {Function} options.onDirtyChange - Called when dirty state changes
 * @param {Function} options.onRealTimeUpdate - Called on each field change for real-time updates
 * @param {Function} options.validator - Function to validate data before save
 * @returns {Object} Hook interface with methods and state accessors
 */
export const useFormDataBuffer = (initialData = {}, onSave, options = {}) => {
    const {
        onDirtyChange,
        onRealTimeUpdate,
        validator
    } = options;

    // Store current form data without triggering re-renders
    const dataRef = useRef({ ...initialData });

    // Track which fields have been modified
    const dirtyFieldsRef = useRef(new Set());

    // Track overall dirty state
    const isDirtyRef = useRef(false);

    // Store original data for reset functionality
    const originalDataRef = useRef({ ...initialData });

    /**
     * Update a specific field in the form data
     * @param {string} fieldPath - Dot notation path to field (e.g., 'user.name' or 'email')
     * @param {*} value - New value for the field
     */
    const updateField = useCallback((fieldPath, value) => {
        // Handle nested field paths (e.g., 'user.profile.name')
        const setNestedValue = (obj, path, val) => {
            const keys = path.split('.');
            const result = { ...obj };
            let current = result;

            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                current[key] = current[key] ? { ...current[key] } : {};
                current = current[key];
            }

            current[keys[keys.length - 1]] = val;
            return result;
        };

        // Update the data
        dataRef.current = setNestedValue(dataRef.current, fieldPath, value);

        // Track dirty field
        dirtyFieldsRef.current.add(fieldPath);

        // Update dirty state if not already dirty
        if (!isDirtyRef.current) {
            isDirtyRef.current = true;
            onDirtyChange?.(true);
        }

        // Trigger real-time update if provided
        onRealTimeUpdate?.(dataRef.current, fieldPath, value);
    }, [onDirtyChange, onRealTimeUpdate]);

    /**
     * Update multiple fields at once
     * @param {Object} updates - Object with field paths as keys and new values
     */
    const updateFields = useCallback((updates) => {
        Object.entries(updates).forEach(([fieldPath, value]) => {
            updateField(fieldPath, value);
        });
    }, [updateField]);

    /**
     * Save the current form data
     * @returns {Promise|*} Result of onSave callback
     */
    const save = useCallback(async () => {
        const currentData = dataRef.current;

        // Run validation if provided
        if (validator) {
            const validationResult = await validator(currentData);
            if (validationResult && !validationResult.isValid) {
                throw new Error(validationResult.error || 'Validation failed');
            }
        }

        // Call the save callback
        const result = await onSave(currentData);

        // Reset dirty state after successful save
        isDirtyRef.current = false;
        dirtyFieldsRef.current.clear();
        onDirtyChange?.(false);

        return result;
    }, [onSave, validator, onDirtyChange]);

    /**
     * Reset form to original data
     */
    const reset = useCallback(() => {
        dataRef.current = { ...originalDataRef.current };
        dirtyFieldsRef.current.clear();
        isDirtyRef.current = false;
        onDirtyChange?.(false);
    }, [onDirtyChange]);

    /**
     * Reset to new initial data (useful when props change)
     * @param {Object} newInitialData - New initial data to reset to
     */
    const resetTo = useCallback((newInitialData) => {
        originalDataRef.current = { ...newInitialData };
        dataRef.current = { ...newInitialData };
        dirtyFieldsRef.current.clear();
        isDirtyRef.current = false;
        onDirtyChange?.(false);
    }, [onDirtyChange]);

    /**
     * Get current form data (returns a copy to prevent mutations)
     * @returns {Object} Current form data
     */
    const getCurrentData = useCallback(() => {
        return { ...dataRef.current };
    }, []);

    /**
     * Check if form has unsaved changes
     * @returns {boolean} True if form is dirty
     */
    const isDirty = useCallback(() => {
        return isDirtyRef.current;
    }, []);

    /**
     * Get list of fields that have been modified
     * @returns {Array} Array of field paths that are dirty
     */
    const getDirtyFields = useCallback(() => {
        return Array.from(dirtyFieldsRef.current);
    }, []);

    /**
     * Check if a specific field is dirty
     * @param {string} fieldPath - Field path to check
     * @returns {boolean} True if field is dirty
     */
    const isFieldDirty = useCallback((fieldPath) => {
        return dirtyFieldsRef.current.has(fieldPath);
    }, []);

    /**
     * Get the value of a specific field
     * @param {string} fieldPath - Dot notation path to field
     * @returns {*} Field value
     */
    const getFieldValue = useCallback((fieldPath) => {
        const keys = fieldPath.split('.');
        let current = dataRef.current;

        for (const key of keys) {
            if (current && typeof current === 'object') {
                current = current[key];
            } else {
                return undefined;
            }
        }

        return current;
    }, []);

    return {
        // Data manipulation
        updateField,
        updateFields,
        save,
        reset,
        resetTo,

        // Data access
        getCurrentData,
        getFieldValue,

        // State queries
        isDirty,
        getDirtyFields,
        isFieldDirty
    };
};

/**
 * Higher-order hook that adds imperative handle support to useFormDataBuffer
 * Useful when you need to expose form methods to parent components via ref
 * 
 * @param {Object} ref - React ref to attach imperative methods to
 * @param {Object} initialData - Initial form data
 * @param {Function} onSave - Save callback
 * @param {Object} options - Configuration options
 * @returns {Object} Same interface as useFormDataBuffer
 */
export const useFormDataBufferWithRef = (ref, initialData, onSave, options = {}) => {
    const formBuffer = useFormDataBuffer(initialData, onSave, options);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
        save: formBuffer.save,
        reset: formBuffer.reset,
        resetTo: formBuffer.resetTo,
        getCurrentData: formBuffer.getCurrentData,
        getFieldValue: formBuffer.getFieldValue,
        isDirty: formBuffer.isDirty,
        getDirtyFields: formBuffer.getDirtyFields,
        isFieldDirty: formBuffer.isFieldDirty,
        updateField: formBuffer.updateField,
        updateFields: formBuffer.updateFields
    }), [formBuffer]);

    return formBuffer;
};

export default useFormDataBuffer;
