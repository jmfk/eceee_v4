/**
 * Operation types for the Unified Data Context
 */

import { PageData, WidgetData, LayoutData, VersionData, PageMetadata, WidgetConfig, ObjectData, FormData, FormFieldData } from './state';

/**
 * Base operation interface
 */
export interface Operation<T = any> {
  type: string;
  payload: T;
  metadata?: OperationMetadata;
}

export interface OperationMetadata {
  timestamp?: number;
  actor?: string;
  validation?: ValidationResult;
  source?: 'user' | 'system' | 'api';
  batchId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Page Operations
 */
export type PageOperation =
  | Operation<{ id: string; updates: Partial<PageData> }>
  | Operation<{ id: string; metadata: Partial<PageMetadata> }>;

/**
 * Widget Operations
 */
export type WidgetOperation =
  | Operation<{ id: string; updates: Partial<WidgetData> }>
  | Operation<{ id: string; config: Partial<WidgetConfig> }>
  | Operation<{ id: string; slot: string; order: number }>;

/**
 * Layout Operations
 */
export type LayoutOperation =
  | Operation<{ id: string; updates: Partial<LayoutData> }>
  | Operation<{ id: string; theme: string }>;

/**
 * Version Operations
 */
export type VersionOperation =
  | Operation<{ id: string; updates: Partial<VersionData> }>
  | Operation<{ pageId: string; versionId: string; action: 'publish' | 'revert' }>;

/**
 * Object Operations
 */
export type ObjectOperation =
  | Operation<{ id: string; updates: Partial<ObjectData> }>
  | Operation<{ id: string; fieldName: string; value: any }>
  | Operation<{ id: string; widgets: Record<string, WidgetData[]> }>
  | Operation<{ id: string; slotName: string; widgets: WidgetData[] }>
  | Operation<{ id: string; title: string }>
  | Operation<{ id: string; status: 'draft' | 'published' | 'scheduled' }>
  | Operation<{ id: string; metadata: Record<string, any> }>;

/**
 * Form Operations
 */
export type FormOperation =
  | Operation<{ formId: string; fieldName: string; value: any }>
  | Operation<{ formId: string; fieldName: string; fieldData: FormFieldData }>
  | Operation<{ formId: string; fields: Record<string, FormFieldData> }>
  | Operation<{ formId: string; errors: ValidationError[] }>
  | Operation<{ formId: string }>
  | Operation<{ formId: string; formData: FormData }>;

/**
 * Batch Operation
 */
export interface BatchOperation extends Operation<Operation[]> {
  type: 'BATCH';
}

/**
 * All possible operation types
 */
export type DataOperation =
  | PageOperation
  | WidgetOperation
  | LayoutOperation
  | VersionOperation
  | ObjectOperation
  | FormOperation
  | BatchOperation;

/**
 * Operation type constants
 */
export const OperationTypes = {
  // Page operations
  CREATE_PAGE: 'CREATE_PAGE',
  UPDATE_PAGE: 'UPDATE_PAGE',
  UPDATE_PAGE_METADATA: 'UPDATE_PAGE_METADATA',
  PUBLISH_PAGE: 'PUBLISH_PAGE',
  UNPUBLISH_PAGE: 'UNPUBLISH_PAGE',
  SCHEDULE_PAGE: 'SCHEDULE_PAGE',
  DUPLICATE_PAGE: 'DUPLICATE_PAGE',
  DELETE_PAGE: 'DELETE_PAGE',
  
  // Widget operations
  UPDATE_WIDGET: 'UPDATE_WIDGET',
  UPDATE_WIDGET_CONFIG: 'UPDATE_WIDGET_CONFIG',
  MOVE_WIDGET: 'MOVE_WIDGET',
  ADD_WIDGET: 'ADD_WIDGET',
  REMOVE_WIDGET: 'REMOVE_WIDGET',
  SAVE_WIDGET: 'SAVE_WIDGET',
  DUPLICATE_WIDGET: 'DUPLICATE_WIDGET',
  REORDER_WIDGETS: 'REORDER_WIDGETS',
  VALIDATE_WIDGET: 'VALIDATE_WIDGET',
  
  // Layout operations
  CREATE_LAYOUT: 'CREATE_LAYOUT',
  UPDATE_LAYOUT: 'UPDATE_LAYOUT',
  UPDATE_LAYOUT_THEME: 'UPDATE_LAYOUT_THEME',
  ADD_LAYOUT_SLOT: 'ADD_LAYOUT_SLOT',
  REMOVE_LAYOUT_SLOT: 'REMOVE_LAYOUT_SLOT',
  UPDATE_LAYOUT_SLOT: 'UPDATE_LAYOUT_SLOT',
  REORDER_LAYOUT_SLOTS: 'REORDER_LAYOUT_SLOTS',
  DUPLICATE_LAYOUT: 'DUPLICATE_LAYOUT',
  DELETE_LAYOUT: 'DELETE_LAYOUT',
  
  // Version operations
  UPDATE_VERSION: 'UPDATE_VERSION',
  CREATE_VERSION: 'CREATE_VERSION',
  PUBLISH_VERSION: 'PUBLISH_VERSION',
  REVERT_VERSION: 'REVERT_VERSION',
  DELETE_VERSION: 'DELETE_VERSION',
  COMPARE_VERSIONS: 'COMPARE_VERSIONS',
  
  // Object operations
  CREATE_OBJECT: 'CREATE_OBJECT',
  UPDATE_OBJECT: 'UPDATE_OBJECT',
  UPDATE_OBJECT_FIELD: 'UPDATE_OBJECT_FIELD',
  UPDATE_OBJECT_WIDGETS: 'UPDATE_OBJECT_WIDGETS',
  UPDATE_OBJECT_SLOT: 'UPDATE_OBJECT_SLOT',
  UPDATE_OBJECT_TITLE: 'UPDATE_OBJECT_TITLE',
  UPDATE_OBJECT_STATUS: 'UPDATE_OBJECT_STATUS',
  UPDATE_OBJECT_METADATA: 'UPDATE_OBJECT_METADATA',
  DELETE_OBJECT: 'DELETE_OBJECT',
  DUPLICATE_OBJECT: 'DUPLICATE_OBJECT',
  
  // Form operations
  CREATE_FORM: 'CREATE_FORM',
  UPDATE_FORM_FIELD: 'UPDATE_FORM_FIELD',
  UPDATE_FORM_FIELD_DATA: 'UPDATE_FORM_FIELD_DATA',
  UPDATE_FORM_FIELDS: 'UPDATE_FORM_FIELDS',
  VALIDATE_FORM: 'VALIDATE_FORM',
  VALIDATE_FORM_FIELD: 'VALIDATE_FORM_FIELD',
  SET_FORM_ERRORS: 'SET_FORM_ERRORS',
  CLEAR_FORM_ERRORS: 'CLEAR_FORM_ERRORS',
  RESET_FORM: 'RESET_FORM',
  SUBMIT_FORM: 'SUBMIT_FORM',
  
  // Batch operations
  BATCH: 'BATCH',
  
  // App state operations
  SET_DIRTY: 'SET_DIRTY',
  RESET_STATE: 'RESET_STATE',
  CLEAR_ERRORS: 'CLEAR_ERRORS',
  MARK_WIDGET_SAVED: 'MARK_WIDGET_SAVED',
  
  // Data loading operations
  LOAD_PAGE_DATA: 'LOAD_PAGE_DATA',
  LOAD_WIDGET_DATA: 'LOAD_WIDGET_DATA',
  LOAD_LAYOUT_DATA: 'LOAD_LAYOUT_DATA',
  LOAD_OBJECT_DATA: 'LOAD_OBJECT_DATA',
  LOAD_FORM_DATA: 'LOAD_FORM_DATA',
  SYNC_FROM_API: 'SYNC_FROM_API'
} as const;
