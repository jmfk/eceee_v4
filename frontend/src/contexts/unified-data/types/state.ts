/**
 * Core state types for the Unified Data Context
 */

export interface PageData {
  id: string;
  title: string;
  slug: string;
  url: string;
  status: 'draft' | 'published' | 'scheduled';
  currentVersionId: string;
  availableVersions: string[];
  metadata: PageMetadata;
  created_at: string;
  updated_at: string;
  created_by?: string;
  published_at?: string;
  scheduled_for?: string;
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
  config: WidgetConfig;
  // Optional metadata (not stored in widget JSON, derived from context)
  slot?: string;
  order?: number;
  parentId?: string;
  createdAt?: string;
  updatedAt?: string;
  content?: any;
  // Publishing & Inheritance fields (camelCase for frontend)
  isPublished?: boolean;
  inheritanceLevel?: number;
  inheritFromParent?: boolean;
  publishEffectiveDate?: string;
  publishExpireDate?: string;
}

export interface WidgetConfig {
  [key: string]: any;
}

export interface ThemeData {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, string>;  // CSS variables/tokens
  styles: Record<string, any>;        // Component-specific styles
  parentTheme?: string;               // For theme inheritance
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface LayoutData {
  id: string;
  name: string;
  slots: LayoutSlot[];
  defaultThemeId?: string;  // Default theme for this layout
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
  pageId: string;
  number: number;
  status: 'draft' | 'published';
  widgets: Record<string, WidgetData[]>;
  layoutId: string;  // Reference to layout in layouts collection
  themeId?: string;  // Reference to theme in themes collection
  content: Record<string, ContentData>;
  metadata: PageMetadata;
  created_at: string;
  updated_at: string;
  created_by: string;
  published_at?: string;
  changesDescription?: string;
}

/**
 * Object Data and Versions
 */
export interface ObjectData {
  id: string;
  type: string; // object type identifier/name
  slug?: string;
  name?: string;
  url?: string;
  status: 'draft' | 'published' | 'scheduled';
  currentVersionId: string;
  availableVersions: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  published_at?: string;
  scheduled_for?: string;
  // Optional relationship context
  parentId?: string | null;
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
  versions: Record<string, VersionData>;
  // Objects and their versions (object storage)
  objects: Record<string, ObjectData>;
  layouts: Record<string, LayoutData>;
  themes: Record<string, ThemeData>;
  
  // Metadata about the state itself
  metadata: {
    lastUpdated: string;
    currentUser?: string;
    isLoading: boolean;
    isDirty: boolean;
    // Object editing flags (parallel to page/version flags)
    isObjectLoading: boolean;
    isObjectDirty: boolean;
    
    // Current editing context
    currentPageId?: string;
    currentVersionId?: string;
    currentObjectId?: string;
    currentObjectVersionId?: string;
    
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
 * Change metadata passed to state change callbacks
 */
export interface ChangeMetadata {
  sourceId?: string;
  type?: string;
  timestamp?: number;
}

/**
 * State change callback type - used by components to handle external changes
 */
export type StateChangeCallback<T = any> = (state: AppState, metadata?: ChangeMetadata) => void;

/**
 * State update type
 */
export type StateUpdate = Partial<AppState> | ((prevState: AppState) => Partial<AppState>);
