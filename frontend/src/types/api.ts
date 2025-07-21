// API Response Types for eceee_v4 Frontend
// These match the Pydantic models defined in backend/webpages/json_models.py

export type PublicationStatus = 'unpublished' | 'scheduled' | 'published' | 'expired';

export interface UserResponse {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface WebPageTreeResponse {
  id: number;
  title: string;
  slug: string;
  parent?: number | null;
  sort_order: number;
  hostnames: string[];
  publication_status: PublicationStatus;
  effective_date?: string | null;
  expiry_date?: string | null;
  children_count: number;
  
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
  css_variables: Record<string, string>;
  is_active: boolean;
}

export interface LayoutResponse {
  name: string;
  description?: string;
  slots: Record<string, any>[];
  template_path?: string;
}

export interface WebPageDetailResponse {
  id: number;
  title: string;
  slug: string;
  description?: string;
  parent?: WebPageTreeResponse | null;
  parent_id?: number | null;
  sort_order: number;
  hostnames: string[];
  code_layout?: string;
  theme?: ThemeResponse | null;
  theme_id?: number | null;
  publication_status: PublicationStatus;
  effective_date?: string | null;
  expiry_date?: string | null;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  linked_object_type?: string;
  linked_object_id?: number | null;
  created_at: string;
  updated_at: string;
  created_by: UserResponse;
  last_modified_by: UserResponse;
  absolute_url: string;
  is_published: boolean;
  breadcrumbs: Record<string, any>[];
  effective_layout?: LayoutResponse | null;
  effective_theme?: ThemeResponse | null;
  layout_type?: string;
  layout_inheritance_info: Record<string, any>;
  available_code_layouts: LayoutResponse[];
  children_count: number;
}

export interface WebPageListResponse {
  id: number;
  title: string;
  slug: string;
  description?: string;
  parent?: WebPageTreeResponse | null;
  sort_order: number;
  hostnames: string[];
  publication_status: PublicationStatus;
  effective_date?: string | null;
  expiry_date?: string | null;
  created_at: string;
  updated_at: string;
  created_by: UserResponse;
  last_modified_by: UserResponse;
  is_published: boolean;
  children_count: number;
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
  parent_id?: number | null;
  sort_order?: number;
  hostnames?: string[];
  code_layout?: string;
  theme_id?: number | null;
  publication_status?: PublicationStatus;
  effective_date?: string | null;
  expiry_date?: string | null;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
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
  parent_isnull?: boolean;
  publication_status?: PublicationStatus;
  ordering?: string;
} 