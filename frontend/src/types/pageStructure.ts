/**
 * Page Structure Query Types
 * 
 * Shared type definitions for querying page and widget structure.
 * These types must match the Python implementation exactly.
 */

export enum PageStatus {
    PUBLISHED = 'published',
    DRAFT = 'draft',
    SCHEDULED = 'scheduled',
    EXPIRED = 'expired'
}

export enum VersionStatus {
    CURRENT = 'current',
    DRAFT = 'draft',
    SCHEDULED = 'scheduled',
    EXPIRED = 'expired',
    HISTORICAL = 'historical'
}

export enum VersionFilter {
    CURRENT_PUBLISHED = 'current_published',  // Currently live version
    LATEST = 'latest',  // Most recent version regardless of status
    LATEST_DRAFT = 'latest_draft',  // Most recent draft version
    LATEST_PUBLISHED = 'latest_published'  // Most recent published (current or expired)
}

export interface PageMetadata {
    id: number
    title: string
    slug: string
    description: string
    path: string  // Full path from root
    parent_id: number | null
    is_root: boolean
    created_at: string
    updated_at: string
    created_by: string
    last_modified_by: string
    // Optional version information (included when requested)
    version?: VersionMetadata | null
}

export interface VersionMetadata {
    id: number
    version_number: number
    version_title: string
    meta_title: string
    meta_description: string
    code_layout: string | null
    theme_id: number | null
    theme_name: string | null
    effective_date: string | null
    expiry_date: string | null
    created_at: string
    created_by: string
    status: VersionStatus
}

export interface PageWithVersion {
    page: PageMetadata
    current_version: VersionMetadata | null
    published_version: VersionMetadata | null
    latest_version: VersionMetadata | null
    version_count: number
    has_draft: boolean
}

export interface ChildPageInfo {
    page: PageMetadata
    current_version: VersionMetadata | null
    child_count: number  // Number of children this page has
    sort_order: number
}

export interface PageTreeNode {
    page: PageMetadata
    current_version: VersionMetadata | null
    children: PageTreeNode[]
    child_count: number
    depth: number
}

export interface WidgetSummary {
    slot_name: string
    widget_count: number
    widget_types: string[]
    has_inherited: boolean
    has_local: boolean
}

export interface PageStructureSummary {
    page: PageMetadata
    current_version: VersionMetadata | null
    ancestor_count: number
    ancestor_ids: number[]
    child_count: number
    descendant_count: number
    widget_summary: WidgetSummary[]
    hostnames: string[]
}

export interface PageSearchOptions {
    include_drafts?: boolean
    include_unpublished?: boolean
    parent_id?: number | null
    root_only?: boolean
    has_published_version?: boolean | null
    layout_type?: string | null
    theme_id?: number | null
    hostname?: string | null
}

export interface VersionSearchOptions {
    page_id?: number | null
    status?: VersionStatus | null
    has_layout?: boolean | null
    has_theme?: boolean | null
    created_after?: string | null
    created_before?: string | null
}

export interface BreadcrumbItem {
    page_id: number
    title: string
    slug: string
    path: string
}

export class StructureQueryError extends Error {
    code: string
    details?: any

    constructor(code: string, message: string, details?: any) {
        super(message)
        this.name = 'StructureQueryError'
        this.code = code
        this.details = details
    }
}

export enum StructureQueryErrorCode {
    PAGE_NOT_FOUND = 'PAGE_NOT_FOUND',
    VERSION_NOT_FOUND = 'VERSION_NOT_FOUND',
    INVALID_PATH = 'INVALID_PATH',
    CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
    DATABASE_ERROR = 'DATABASE_ERROR',
    PERMISSION_DENIED = 'PERMISSION_DENIED'
}

// Type guards for runtime type checking
export function isPageMetadata(obj: any): obj is PageMetadata {
    return obj && 
           typeof obj === 'object' && 
           typeof obj.id === 'number' &&
           typeof obj.slug === 'string' &&
           typeof obj.path === 'string'
}

export function isVersionMetadata(obj: any): obj is VersionMetadata {
    return obj && 
           typeof obj === 'object' && 
           typeof obj.id === 'number' &&
           typeof obj.version_number === 'number' &&
           typeof obj.status === 'string'
}

export function isPageWithVersion(obj: any): obj is PageWithVersion {
    return obj && 
           typeof obj === 'object' && 
           isPageMetadata(obj.page) &&
           typeof obj.version_count === 'number'
}

export function isPageTreeNode(obj: any): obj is PageTreeNode {
    return obj && 
           typeof obj === 'object' && 
           isPageMetadata(obj.page) &&
           Array.isArray(obj.children) &&
           typeof obj.depth === 'number'
}

