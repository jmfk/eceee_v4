/**
 * Operation types for the Unified Data Context
 */

import { PageData, WidgetData, LayoutData, VersionData, PageMetadata, WidgetConfig } from './state';

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
  | BatchOperation;

/**
 * Operation type constants
 */
export const OperationTypes = {
  // Page operations
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
  
  // Batch operations
  BATCH: 'BATCH',
  
  // App state operations
  SET_DIRTY: 'SET_DIRTY',
  RESET_STATE: 'RESET_STATE',
  CLEAR_ERRORS: 'CLEAR_ERRORS',
  MARK_WIDGET_SAVED: 'MARK_WIDGET_SAVED'
} as const;
