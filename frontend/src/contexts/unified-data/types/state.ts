/**
 * Core state types for the Unified Data Context
 */

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface PageData {
  id: string;
  title: string;
  slug: string;
  metadata: PageMetadata;
  layout: string; // Layout ID
  version: string; // Current version ID
  status: 'draft' | 'published' | 'scheduled';
  created_at: string;
  updated_at: string;
}

export interface PageMetadata {
  description?: string;
  keywords?: string[];
  author?: string;
  [key: string]: any;
}

export interface WidgetData {
  id: string;
  type: string;
  slot: string;
  slotName?: string; // Alternative slot reference
  config: WidgetConfig;
  content?: any;
  order: number;
  parent_id?: string;
  pageId?: string; // Reference to parent page
  name?: string; // Widget display name
  widgetType?: { name: string }; // Alternative type reference
  widget_type?: { name: string }; // Alternative type reference
  created_at: string;
  updated_at: string;
}

export interface WidgetConfig {
  [key: string]: any;
}

export interface LayoutData {
  id: string;
  name: string;
  slots: LayoutSlot[];
  theme?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LayoutSlot {
  id: string;
  name: string;
  allowedWidgets?: string[];
  metadata?: Record<string, any>;
}

export interface VersionData {
  id: string;
  page_id: string;
  number: number;
  data: PageVersionData;
  created_at: string;
  created_by: string;
  status: 'draft' | 'published';
}

export interface PageVersionData {
  layout: string;
  widgets: Record<string, WidgetData>;
  metadata: PageMetadata;
}

/**
 * Object Instance Data
 */
export interface ObjectData {
  id: string;
  objectType: {
    id: string;
    name: string;
    label: string;
    schema?: any;
    slotConfiguration?: any;
  };
  title: string;
  data: Record<string, any>; // Schema-based field data
  status: 'draft' | 'published' | 'scheduled';
  widgets: Record<string, WidgetData[]>; // Slot name -> widgets array
  metadata: Record<string, any>;
  version?: number;
  parent?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Form Field Data
 */
export interface FormFieldData {
  fieldName: string;
  value: any;
  isValid: boolean;
  errors: ValidationError[];
  isDirty: boolean;
  lastUpdated: string;
}

/**
 * Form Data Collection
 */
export interface FormData {
  id: string; // Form instance ID (could be object ID, page ID, etc.)
  type: 'object' | 'page' | 'widget' | 'layout'; // Form type
  fields: Record<string, FormFieldData>;
  isValid: boolean;
  isDirty: boolean;
  errors: ValidationError[];
  metadata?: Record<string, any>;
}

/**
 * Complete application state interface
 */
export interface AppState {
  pages: Record<string, PageData>;
  widgets: Record<string, WidgetData>;
  layouts: Record<string, LayoutData>;
  versions: Record<string, VersionData>;
  objects: Record<string, ObjectData>;
  forms: Record<string, FormData>;
  // Note: Metadata state is now managed in UnifiedDataContext
}

/**
 * State selector type
 */
export type StateSelector<T = any> = (state: AppState) => T;

/**
 * State update type
 */
export type StateUpdate = Partial<AppState> | ((prevState: AppState) => Partial<AppState>);
