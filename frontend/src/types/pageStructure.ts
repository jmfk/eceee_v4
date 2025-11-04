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
    parentId: number | null
    isRoot: boolean
    createdAt: string
    updatedAt: string
    createdBy: string
    lastModifiedBy: string
    // Optional version information (included when requested)
    version?: VersionMetadata | null
}

export interface VersionMetadata {
    id: number
    versionNumber: number
    versionTitle: string
    metaTitle: string
    metaDescription: string
    codeLayout: string | null
    themeId: number | null
    themeName: string | null
    effectiveDate: string | null
    expiryDate: string | null
    createdAt: string
    createdBy: string
    status: VersionStatus
}

export interface PageWithVersion {
    page: PageMetadata
    currentVersion: VersionMetadata | null
    publishedVersion: VersionMetadata | null
    latestVersion: VersionMetadata | null
    versionCount: number
    hasDraft: boolean
}

export interface ChildPageInfo {
    page: PageMetadata
    currentVersion: VersionMetadata | null
    childCount: number  // Number of children this page has
    sortOrder: number
}

export interface PageTreeNode {
    page: PageMetadata
    currentVersion: VersionMetadata | null
    children: PageTreeNode[]
    childCount: number
    depth: number
}

export interface WidgetSummary {
    slotName: string
    widgetCount: number
    widgetTypes: string[]
    hasInherited: boolean
    hasLocal: boolean
}

export interface PageStructureSummary {
    page: PageMetadata
    currentVersion: VersionMetadata | null
    ancestorCount: number
    ancestorIds: number[]
    childCount: number
    descendantCount: number
    widgetSummary: WidgetSummary[]
    hostnames: string[]
}

export interface PageSearchOptions {
    includeDrafts?: boolean
    includeUnpublished?: boolean
    parentId?: number | null
    rootOnly?: boolean
    hasPublishedVersion?: boolean | null
    layoutType?: string | null
    themeId?: number | null
    hostname?: string | null
}

export interface VersionSearchOptions {
    pageId?: number | null
    status?: VersionStatus | null
    hasLayout?: boolean | null
    hasTheme?: boolean | null
    createdAfter?: string | null
    createdBefore?: string | null
}

export interface BreadcrumbItem {
    pageId: number
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
           typeof obj.versionNumber === 'number' &&
           typeof obj.status === 'string'
}

export function isPageWithVersion(obj: any): obj is PageWithVersion {
    return obj && 
           typeof obj === 'object' && 
           isPageMetadata(obj.page) &&
           typeof obj.versionCount === 'number'
}

export function isPageTreeNode(obj: any): obj is PageTreeNode {
    return obj && 
           typeof obj === 'object' && 
           isPageMetadata(obj.page) &&
           Array.isArray(obj.children) &&
           typeof obj.depth === 'number'
}

