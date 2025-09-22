import { ObjectState, WidgetState, LayoutState, FormState } from '../types/state';

/**
 * Validation utilities for the v2 context
 */

// Object validation
export async function validateObjectData(data: Partial<ObjectState>): Promise<boolean> {
    try {
        // Required fields
        if (!data.id) {
            throw new Error('Object ID is required');
        }

        // Type validation
        if (data.type !== 'object') {
            throw new Error('Invalid object type');
        }

        // Data validation
        if (data.data && typeof data.data !== 'object') {
            throw new Error('Invalid object data');
        }

        // Title validation
        if (data.title && typeof data.title !== 'string') {
            throw new Error('Invalid object title');
        }

        // Metadata validation
        if (data.metadata && typeof data.metadata !== 'object') {
            throw new Error('Invalid object metadata');
        }

        // Status validation
        if (data.status && typeof data.status !== 'string') {
            throw new Error('Invalid object status');
        }

        return true;
    } catch (error) {
        console.error('Object validation failed:', error);
        return false;
    }
}

// Widget validation
export async function validateWidgetData(data: Partial<WidgetState>): Promise<boolean> {
    try {
        // Required fields
        if (!data.id) {
            throw new Error('Widget ID is required');
        }

        // Type validation
        if (data.type !== 'widget') {
            throw new Error('Invalid widget type');
        }

        // Widget type validation
        if (!data.widgetType || typeof data.widgetType !== 'string') {
            throw new Error('Invalid widget type');
        }

        // Config validation
        if (data.config && typeof data.config !== 'object') {
            throw new Error('Invalid widget config');
        }

        // Slot validation
        if (!data.slotName || typeof data.slotName !== 'string') {
            throw new Error('Invalid widget slot');
        }

        // Order validation
        if (typeof data.order !== 'undefined' && typeof data.order !== 'number') {
            throw new Error('Invalid widget order');
        }

        return true;
    } catch (error) {
        console.error('Widget validation failed:', error);
        return false;
    }
}

// Layout validation
export async function validateLayoutData(data: Partial<LayoutState>): Promise<boolean> {
    try {
        // Required fields
        if (!data.name) {
            throw new Error('Layout name is required');
        }

        // Type validation
        if (data.type !== 'layout') {
            throw new Error('Invalid layout type');
        }

        // Config validation
        if (data.config && typeof data.config !== 'object') {
            throw new Error('Invalid layout config');
        }

        return true;
    } catch (error) {
        console.error('Layout validation failed:', error);
        return false;
    }
}

// Form validation
export async function validateFormData(data: Partial<FormState>): Promise<boolean> {
    try {
        // Required fields
        if (!data.id) {
            throw new Error('Form ID is required');
        }

        // Type validation
        if (data.type !== 'form') {
            throw new Error('Invalid form type');
        }

        // Fields validation
        if (data.fields && typeof data.fields !== 'object') {
            throw new Error('Invalid form fields');
        }

        // Field validation
        if (data.fields) {
            for (const [fieldName, field] of Object.entries(data.fields)) {
                if (typeof field.value === 'undefined') {
                    throw new Error(`Field ${fieldName} is missing value`);
                }

                if (typeof field.isDirty !== 'boolean') {
                    throw new Error(`Field ${fieldName} is missing isDirty`);
                }

                if (typeof field.isTouched !== 'boolean') {
                    throw new Error(`Field ${fieldName} is missing isTouched`);
                }

                if (typeof field.isValidating !== 'boolean') {
                    throw new Error(`Field ${fieldName} is missing isValidating`);
                }

                if (!field.validation || typeof field.validation !== 'object') {
                    throw new Error(`Field ${fieldName} is missing validation`);
                }

                if (typeof field.validation.isValid !== 'boolean') {
                    throw new Error(`Field ${fieldName} validation is missing isValid`);
                }

                if (!Array.isArray(field.validation.errors)) {
                    throw new Error(`Field ${fieldName} validation is missing errors array`);
                }

                if (!Array.isArray(field.validation.warnings)) {
                    throw new Error(`Field ${fieldName} validation is missing warnings array`);
                }
            }
        }

        return true;
    } catch (error) {
        console.error('Form validation failed:', error);
        return false;
    }
}
