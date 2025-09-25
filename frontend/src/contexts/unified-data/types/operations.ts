/**
 * Operation types for the Unified Data Context
 */

import { PageData, WidgetData, LayoutData, VersionData, PageMetadata, WidgetConfig, ObjectData } from './state';

/**
 * Base operation interface
 */
export interface Operation<T = any> {
  type: string;
  sourceId?: string; // Component ID that originated the update
  payload: T;
  metadata?: OperationMetadata;
}

export interface OperationMetadata {
  timestamp?: number;
  actor?: string;
  validation?: ValidationResult;
  source?: 'user' | 'system' | 'api';
  batchId?: string;
  category?: string; // Category of operation (e.g., 'widget_operation')
}

export interface DispatchOptions {
  priority?: 'high' | 'normal' | 'low';
  debounce?: number;
  sourceId?: string;
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
 * Widget operation payloads with explicit TypeScript types
 */
export type WidgetContext =
  | { contextType: 'page'; pageId: string }
  | { contextType: 'object'; objectId: string };

export type AddWidgetPayload = WidgetContext & {
  id: string;
  type: string; // widget type
  config?: Partial<WidgetConfig>;
  slot?: string;
  order?: number;
};

export type UpdateWidgetConfigPayload = WidgetContext & {
  id: string;
  slotName: string;
  config: Partial<WidgetConfig>;
};

export type MoveWidgetPayload = WidgetContext & {
  id: string;
  slot: string;
  widgets: Record<string, WidgetData[]>;
};

export type RemoveWidgetPayload = WidgetContext & {
  id: string;
};

export type AnyWidgetPayload =
  | AddWidgetPayload
  | UpdateWidgetConfigPayload
  | MoveWidgetPayload
  | RemoveWidgetPayload;

// Narrowed operation types for better type inference at call sites
export type AddWidgetOperation = Operation<AddWidgetPayload> & { type: typeof OperationTypes.ADD_WIDGET };
export type UpdateWidgetConfigOperation = Operation<UpdateWidgetConfigPayload> & { type: typeof OperationTypes.UPDATE_WIDGET_CONFIG };
export type MoveWidgetOperation = Operation<MoveWidgetPayload> & { type: typeof OperationTypes.MOVE_WIDGET };
export type RemoveWidgetOperation = Operation<RemoveWidgetPayload> & { type: typeof OperationTypes.REMOVE_WIDGET };

export type WidgetOperation =
  | AddWidgetOperation
  | UpdateWidgetConfigOperation
  | MoveWidgetOperation
  | RemoveWidgetOperation;

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
  | Operation<{ id: string; metadata: Record<string, any> }>;

/**
 * Object Version Operations
 */
export type ObjectVersionOperation =
  | Operation<{ id: string; updates: Record<string, any> }>
  | Operation<{ objectId: string; versionId: string; action: 'publish' | 'revert' }>;

/**
 * Metadata Operations
 */
export type MetadataOperation =
  | Operation<{ isDirty: boolean }>
  | Operation<{ isLoading: boolean }>
  | Operation<{ widgetId: string }>
  | Operation<{ widgetId: string; error: Error | null }>
  | Operation<{ message: string; category?: string }>  // ADD_ERROR
  | Operation<{ message: string; category?: string }>  // ADD_WARNING
  | Operation<{ category?: string }>  // CLEAR_ERRORS
  | Operation<{ category?: string }>;  // CLEAR_WARNINGS

/**
 * All possible operation types
 */
export type DataOperation =
  | PageOperation
  | WidgetOperation
  | LayoutOperation
  | VersionOperation
  | ObjectOperation
  | ObjectVersionOperation
  | MetadataOperation;

/**
 * Operation type constants
 */
export const OperationTypes = {
  // Page operations
  UPDATE_PAGE: 'UPDATE_PAGE',
  UPDATE_PAGE_METADATA: 'UPDATE_PAGE_METADATA',
  UPDATE_WEBPAGE_DATA: 'UPDATE_WEBPAGE_DATA',
  UPDATE_PAGE_VERSION_DATA: 'UPDATE_PAGE_VERSION_DATA',
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
  
  // Layout operations
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
  PUBLISH_VERSION: 'PUBLISH_VERSION',
  REVERT_VERSION: 'REVERT_VERSION',
  CREATE_VERSION: 'CREATE_VERSION',
  DELETE_VERSION: 'DELETE_VERSION',
  COMPARE_VERSIONS: 'COMPARE_VERSIONS',
  SWITCH_VERSION: 'SWITCH_VERSION',

  // Object operations
  INIT_OBJECT: 'INIT_OBJECT',
  UPDATE_OBJECT: 'UPDATE_OBJECT',
  SWITCH_OBJECT: 'SWITCH_OBJECT',

  // Object version operations
  INIT_OBJECT_VERSION: 'INIT_OBJECT_VERSION',
  UPDATE_OBJECT_VERSION: 'UPDATE_OBJECT_VERSION',
  SWITCH_OBJECT_VERSION: 'SWITCH_OBJECT_VERSION',
  
  // Metadata operations
  SET_DIRTY: 'SET_DIRTY',
  SET_LOADING: 'SET_LOADING',
  SET_OBJECT_DIRTY: 'SET_OBJECT_DIRTY',
  SET_OBJECT_LOADING: 'SET_OBJECT_LOADING',
  MARK_WIDGET_DIRTY: 'MARK_WIDGET_DIRTY',
  MARK_WIDGET_SAVED: 'MARK_WIDGET_SAVED',
  SET_WIDGET_ERROR: 'SET_WIDGET_ERROR',
  ADD_ERROR: 'ADD_ERROR',
  ADD_WARNING: 'ADD_WARNING',
  CLEAR_ERRORS: 'CLEAR_ERRORS',
  CLEAR_WARNINGS: 'CLEAR_WARNINGS',
  RESET_STATE: 'RESET_STATE',

  // Content operations
  UPDATE_CONTENT: 'UPDATE_CONTENT',

  // Form operations
  WIDGET_FORM_REGISTERED: 'WIDGET_FORM_REGISTERED',
  WIDGET_FORM_UNREGISTERED: 'WIDGET_FORM_UNREGISTERED',
  CONFIG_CHANGE: 'CONFIG_CHANGE',
  DIRTY_STATE_CHANGED: 'DIRTY_STATE_CHANGED',
  SAVED_TO_SERVER: 'SAVED_TO_SERVER',
  VALIDATION_COMPLETE: 'VALIDATION_COMPLETE',
  FORM_RESET: 'FORM_RESET',
  FORM_DESTROYED: 'FORM_DESTROYED',

  // Initialization operations
  INIT_WIDGET: 'INIT_WIDGET',  // For initializing widget data without side effects Deprecated?
  INIT_PAGE: 'INIT_PAGE',      // For initializing page data without side effects
  INIT_VERSION: 'INIT_VERSION',// For initializing version data without side effects
  INIT_LAYOUT: 'INIT_LAYOUT',  // For initializing layout data without side effects
  
} as const;
