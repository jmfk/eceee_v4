/**
 * Specialized operation types for object data management
 * Each type represents a specific aspect of object data that can be updated
 */

import { Operation, OperationMetadata } from './operations';
import { WidgetData, ValidationError } from './state';

/**
 * Title Operations
 */
export interface ObjectTitleOperation extends Operation<{
    id: string;
    title: string;
}> {
    type: 'UPDATE_OBJECT_TITLE';
    metadata?: OperationMetadata & {
        previousTitle?: string;
        validation?: {
            isValid: boolean;
            errors?: ValidationError[];
        };
    };
}

/**
 * Data Field Operations
 */
export interface ObjectDataOperation extends Operation<{
    id: string;
    fieldName: string;
    value: any;
    schema?: any; // Optional schema for validation
}> {
    type: 'UPDATE_OBJECT_FIELD';
    metadata?: OperationMetadata & {
        previousValue?: any;
        validation?: {
            isValid: boolean;
            errors?: ValidationError[];
        };
    };
}

/**
 * Widget Operations
 */
export interface ObjectWidgetOperation extends Operation<{
    id: string;
    slotName: string;
    widgets: WidgetData[];
}> {
    type: 'UPDATE_OBJECT_SLOT';
    metadata?: OperationMetadata & {
        previousWidgets?: WidgetData[];
        validation?: {
            isValid: boolean;
            errors?: ValidationError[];
        };
    };
}

/**
 * Metadata Operations
 */
export interface ObjectMetadataOperation extends Operation<{
    id: string;
    metadata: Record<string, any>;
}> {
    type: 'UPDATE_OBJECT_METADATA';
    metadata?: OperationMetadata & {
        previousMetadata?: Record<string, any>;
        validation?: {
            isValid: boolean;
            errors?: ValidationError[];
        };
    };
}

/**
 * Status Operations
 */
export interface ObjectStatusOperation extends Operation<{
    id: string;
    status: 'draft' | 'published' | 'scheduled';
}> {
    type: 'UPDATE_OBJECT_STATUS';
    metadata?: OperationMetadata & {
        previousStatus?: 'draft' | 'published' | 'scheduled';
        validation?: {
            isValid: boolean;
            errors?: ValidationError[];
        };
        transitionRules?: {
            allowedTransitions: ('draft' | 'published' | 'scheduled')[];
            requiresApproval?: boolean;
            requiresSchedule?: boolean;
        };
    };
}

/**
 * Operation Results
 */
export interface ObjectOperationResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    validation?: {
        isValid: boolean;
        errors?: ValidationError[];
    };
}

/**
 * Operation Hooks Return Types
 */
export interface UseObjectTitleOperations {
    updateTitle: (title: string, options?: { source?: 'user' | 'system' }) => Promise<ObjectOperationResult<string>>;
    validateTitle: (title: string) => Promise<ObjectOperationResult<string>>;
    getCurrentTitle: () => string;
}

export interface UseObjectDataOperations {
    updateField: (fieldName: string, value: any, options?: { source?: 'user' | 'system' }) => Promise<ObjectOperationResult>;
    validateField: (fieldName: string, value: any) => Promise<ObjectOperationResult>;
    getCurrentFieldValue: (fieldName: string) => any;
}

export interface UseObjectWidgetOperations {
    updateWidgetSlot: (slotName: string, widgets: WidgetData[], options?: { source?: 'user' | 'system' }) => Promise<ObjectOperationResult>;
    validateWidgetSlot: (slotName: string, widgets: WidgetData[]) => Promise<ObjectOperationResult>;
    getCurrentSlotWidgets: (slotName: string) => WidgetData[];
}

export interface UseObjectMetadataOperations {
    updateMetadata: (metadata: Record<string, any>, options?: { source?: 'user' | 'system' }) => Promise<ObjectOperationResult>;
    validateMetadata: (metadata: Record<string, any>) => Promise<ObjectOperationResult>;
    getCurrentMetadata: () => Record<string, any>;
}

export interface UseObjectStatusOperations {
    updateStatus: (status: 'draft' | 'published' | 'scheduled', options?: { source?: 'user' | 'system' }) => Promise<ObjectOperationResult>;
    validateStatusTransition: (newStatus: 'draft' | 'published' | 'scheduled') => Promise<ObjectOperationResult>;
    getCurrentStatus: () => 'draft' | 'published' | 'scheduled';
    getAllowedTransitions: () => ('draft' | 'published' | 'scheduled')[];
}

/**
 * Operation Constants
 */
export const ObjectOperationTypes = {
    UPDATE_TITLE: 'UPDATE_OBJECT_TITLE',
    UPDATE_FIELD: 'UPDATE_OBJECT_FIELD',
    UPDATE_SLOT: 'UPDATE_OBJECT_SLOT',
    UPDATE_METADATA: 'UPDATE_OBJECT_METADATA',
    UPDATE_STATUS: 'UPDATE_OBJECT_STATUS'
} as const;
