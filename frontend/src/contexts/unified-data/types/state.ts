/**
 * Core state types for the Unified Data Context
 */

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
  config: WidgetConfig;
  content?: any;
  order: number;
  parent_id?: string;
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
 * Complete application state interface
 */
export interface ContentData {
  id: string;
  value: string;
  type: string;
  metadata?: Record<string, any>;
}

export interface AppState {
  pages: Record<string, PageData>;
  widgets: Record<string, WidgetData>;
  layouts: Record<string, LayoutData>;
  versions: Record<string, VersionData>;
  content: Record<string, ContentData>;
  
  // Metadata about the state itself
  metadata: {
    lastUpdated: string;
    currentUser?: string;
    isLoading: boolean;
    isDirty: boolean;
    // Track last operation for update source filtering
    lastOperation?: {
      type: string;
      sourceId?: string;
      timestamp: number;
    };
    // Global errors and warnings with categories
    errors: Array<{
      message: string;
      category: string;
      timestamp: number;
    }>;
    warnings: Array<{
      message: string;
      category: string;
      timestamp: number;
    }>;
    // Widget-specific metadata
    widgetStates: {
      errors: Record<string, Error>;
      activeEditors: string[];
    };
  };
}

/**
 * State selector type - used by DataManager for internal state selection
 */
export type StateSelector<T = any> = (state: AppState) => T;

/**
 * State change callback type - used by components to handle external changes
 */
export type StateChangeCallback<T = any> = (state: AppState) => void;

/**
 * State update type
 */
export type StateUpdate = Partial<AppState> | ((prevState: AppState) => Partial<AppState>);
