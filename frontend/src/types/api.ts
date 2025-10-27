// API Response Types for eceee_v4 Frontend
// These match the Pydantic models defined in backend/webpages/json_models.py

export type PublicationStatus = 'unpublished' | 'scheduled' | 'published' | 'expired';

export interface UserResponse {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface WebPageTreeResponse {
  id: number;
  title: string;
  slug: string;
  parent?: number | null;
  sortOrder: number;
  hostnames: string[];
  publicationStatus: PublicationStatus;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  childrenCount: number;
  
  // Tree-specific fields (added by frontend logic)
  isExpanded?: boolean;
  isLoading?: boolean;
  children?: WebPageTreeResponse[];
  childrenLoaded?: boolean;
}

export interface ThemeResponse {
  id: number;
  name: string;
  description?: string;
  cssVariables: Record<string, string>;
  isActive: boolean;
}

export interface ThemeInheritanceInfo {
  source: 'explicit' | 'inherited' | 'default' | 'none';
  inheritedFrom?: {
    pageId: number;
    pageTitle: string;
    themeId: number;
    themeName: string;
  } | null;
}

export interface LayoutResponse {
  name: string;
  description?: string;
  slots: Record<string, any>[];
  templatePath?: string;
}

export interface WebPageDetailResponse {
  id: number;
  title: string;
  slug: string;
  description?: string;
  parent?: WebPageTreeResponse | null;
  parentId?: number | null;
  sortOrder: number;
  hostnames: string[];
  codeLayout?: string;
  theme?: ThemeResponse | null;
  themeId?: number | null;
  publicationStatus: PublicationStatus;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;

  createdAt: string;
  updatedAt: string;
  createdBy: UserResponse;
  lastModifiedBy: UserResponse;
  absoluteUrl: string;
  isPublished: boolean;
  breadcrumbs: Record<string, any>[];
  effectiveLayout?: LayoutResponse | null;
  effectiveTheme?: ThemeResponse | null;
  layoutType?: string;
  layoutInheritanceInfo: Record<string, any>;
  availableCodeLayouts: LayoutResponse[];
  childrenCount: number;
}

export interface WebPageListResponse {
  id: number;
  title: string;
  slug: string;
  description?: string;
  parent?: WebPageTreeResponse | null;
  sortOrder: number;
  hostnames: string[];
  publicationStatus: PublicationStatus;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: UserResponse;
  lastModifiedBy: UserResponse;
  isPublished: boolean;
  childrenCount: number;
  layout?: LayoutResponse | null;
  theme?: ThemeResponse | null;
}

export interface PaginatedResponse<T = any> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

// API Request Types

export interface CreatePageRequest {
  title: string;
  slug: string;
  description?: string;
  parentId?: number | null;
  sortOrder?: number;
  hostnames?: string[];
  codeLayout?: string;
  themeId?: number | null;
  publicationStatus?: PublicationStatus;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
}

export interface UpdatePageRequest extends Partial<CreatePageRequest> {
  // All fields are optional for updates
}

export interface UpdateHostnamesRequest {
  hostnames: string[];
}

// API Error Response
export interface ApiError {
  detail?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

// Query Filters
export interface PageFilters {
  search?: string;
  parent?: number;
  parentIsnull?: boolean;
  publicationStatus?: PublicationStatus;
  ordering?: string;
} 