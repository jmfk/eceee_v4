/**
 * Page Structure Query Utilities
 * 
 * Helper functions for querying page and version structure via API calls.
 * These functions must match the Python implementation interface exactly.
 */

import {
    PageMetadata,
    VersionMetadata,
    PageWithVersion,
    ChildPageInfo,
    PageTreeNode,
    PageStructureSummary,
    PageSearchOptions,
    VersionSearchOptions,
    BreadcrumbItem,
    VersionStatus,
    VersionFilter,
    StructureQueryError,
    StructureQueryErrorCode
} from '../types/pageStructure'
import api from '../api/client'


export class PageStructureHelpers {
    /**Helper functions for querying page structure via API*/
    
    // Core Query Functions
    
    async getPageById(pageId: number, versionFilter?: VersionFilter): Promise<PageMetadata | null> {
        /**
         * Get page metadata by ID.
         * 
         * @param pageId - Page ID
         * @param versionFilter - Optional filter to include version information
         * @returns PageMetadata or null if not found
         */
        try {
            const params: any = {}
            if (versionFilter) {
                params.version_filter = versionFilter
            }
            const response = await api.get(`/api/webpages/pages/${pageId}/metadata/`, { params })
            return response.data
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null
            }
            throw new StructureQueryError(
                StructureQueryErrorCode.DATABASE_ERROR,
                'Failed to fetch page',
                error
            )
        }
    }
    
    async getPageByPath(path: string, hostname?: string, versionFilter?: VersionFilter): Promise<PageMetadata | null> {
        /**
         * Get page metadata by path.
         * 
         * @param path - Full path like "/about/team"
         * @param hostname - Optional hostname for root page resolution
         * @param versionFilter - Optional filter to include version information
         * @returns PageMetadata or null if not found
         */
        try {
            const params: any = { path }
            if (hostname) {
                params.hostname = hostname
            }
            if (versionFilter) {
                params.version_filter = versionFilter
            }
            const response = await api.get('/api/webpages/pages/by-path/', { params })
            return response.data
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null
            }
            throw new StructureQueryError(
                StructureQueryErrorCode.INVALID_PATH,
                'Failed to resolve page path',
                error
            )
        }
    }
    
    async getActiveChildren(
        pageId: number,
        includeUnpublished: boolean = false
    ): Promise<ChildPageInfo[]> {
        /**
         * Get active child pages of a page.
         * 
         * @param pageId - Parent page ID
         * @param includeUnpublished - Whether to include pages without published versions
         * @returns List of ChildPageInfo objects
         */
        try {
            const response = await api.get(`/api/pages/${pageId}/children/`, {
                params: { include_unpublished: includeUnpublished }
            })
            return response.data
        } catch (error: any) {
            throw new StructureQueryError(
                StructureQueryErrorCode.DATABASE_ERROR,
                'Failed to fetch children',
                error
            )
        }
    }
    
    async getChildrenRecursive(
        pageId: number,
        maxDepth?: number,
        includeUnpublished: boolean = false
    ): Promise<PageTreeNode> {
        /**
         * Get page tree recursively.
         * 
         * @param pageId - Root page ID
         * @param maxDepth - Maximum depth to traverse (undefined = unlimited)
         * @param includeUnpublished - Whether to include pages without published versions
         * @returns PageTreeNode with nested children
         */
        try {
            const params: any = { include_unpublished: includeUnpublished }
            if (maxDepth !== undefined) {
                params.max_depth = maxDepth
            }
            const response = await api.get(`/api/pages/${pageId}/tree/`, { params })
            return response.data
        } catch (error: any) {
            if (error.response?.status === 404) {
                throw new StructureQueryError(
                    StructureQueryErrorCode.PAGE_NOT_FOUND,
                    `Page ${pageId} not found`
                )
            }
            throw new StructureQueryError(
                StructureQueryErrorCode.DATABASE_ERROR,
                'Failed to fetch page tree',
                error
            )
        }
    }
    
    async getAncestors(pageId: number): Promise<PageMetadata[]> {
        /**
         * Get all ancestor pages (parent, grandparent, etc.).
         * 
         * @param pageId - Page ID
         * @returns List of PageMetadata from immediate parent to root
         */
        try {
            const response = await api.get(`/api/pages/${pageId}/ancestors/`)
            return response.data
        } catch (error: any) {
            throw new StructureQueryError(
                StructureQueryErrorCode.DATABASE_ERROR,
                'Failed to fetch ancestors',
                error
            )
        }
    }
    
    async getBreadcrumbs(pageId: number): Promise<BreadcrumbItem[]> {
        /**
         * Get breadcrumb trail for a page.
         * 
         * @param pageId - Page ID
         * @returns List of BreadcrumbItem from root to current page
         */
        try {
            const response = await api.get(`/api/pages/${pageId}/breadcrumbs/`)
            return response.data
        } catch (error: any) {
            throw new StructureQueryError(
                StructureQueryErrorCode.DATABASE_ERROR,
                'Failed to fetch breadcrumbs',
                error
            )
        }
    }
    
    async getRootPage(pageId: number): Promise<PageMetadata | null> {
        /**
         * Get the root page for a given page.
         * 
         * @param pageId - Page ID
         * @returns PageMetadata of root page or null
         */
        try {
            const response = await api.get(`/api/pages/${pageId}/root/`)
            return response.data
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null
            }
            throw new StructureQueryError(
                StructureQueryErrorCode.DATABASE_ERROR,
                'Failed to fetch root page',
                error
            )
        }
    }
    
    // Version Query Functions
    
    async getVersionById(versionId: number): Promise<VersionMetadata | null> {
        /**Get version metadata by ID*/
        try {
            const response = await api.get(`/api/page-versions/${versionId}/metadata/`)
            return response.data
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null
            }
            throw new StructureQueryError(
                StructureQueryErrorCode.VERSION_NOT_FOUND,
                'Failed to fetch version',
                error
            )
        }
    }
    
    async getVersionsForPage(
        pageId: number,
        status?: VersionStatus
    ): Promise<VersionMetadata[]> {
        /**
         * Get all versions for a page.
         * 
         * @param pageId - Page ID
         * @param status - Optional status filter
         * @returns List of VersionMetadata ordered by version number (newest first)
         */
        try {
            const params: any = {}
            if (status) {
                params.status = status
            }
            const response = await api.get(`/api/pages/${pageId}/versions/`, { params })
            return response.data
        } catch (error: any) {
            throw new StructureQueryError(
                StructureQueryErrorCode.DATABASE_ERROR,
                'Failed to fetch versions',
                error
            )
        }
    }
    
    async getCurrentVersion(pageId: number): Promise<VersionMetadata | null> {
        /**Get the current published version for a page*/
        try {
            const response = await api.get(`/api/pages/${pageId}/current-version/`)
            return response.data
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null
            }
            throw new StructureQueryError(
                StructureQueryErrorCode.DATABASE_ERROR,
                'Failed to fetch current version',
                error
            )
        }
    }
    
    async getPageWithVersions(pageId: number): Promise<PageWithVersion | null> {
        /**
         * Get page with version information.
         * 
         * @param pageId - Page ID
         * @returns PageWithVersion with current, published, and latest version info
         */
        try {
            const response = await api.get(`/api/pages/${pageId}/with-versions/`)
            return response.data
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null
            }
            throw new StructureQueryError(
                StructureQueryErrorCode.DATABASE_ERROR,
                'Failed to fetch page with versions',
                error
            )
        }
    }
    
    // Structure Summary Functions
    
    async getPageStructureSummary(pageId: number): Promise<PageStructureSummary | null> {
        /**
         * Get comprehensive structure summary for a page.
         * 
         * @param pageId - Page ID
         * @returns PageStructureSummary with full structural information
         */
        try {
            const response = await api.get(`/api/pages/${pageId}/structure-summary/`)
            return response.data
        } catch (error: any) {
            if (error.response?.status === 404) {
                return null
            }
            throw new StructureQueryError(
                StructureQueryErrorCode.DATABASE_ERROR,
                'Failed to fetch structure summary',
                error
            )
        }
    }
    
    // Search Functions
    
    async searchPages(options: PageSearchOptions = {}): Promise<PageMetadata[]> {
        /**
         * Search for pages with various filters.
         * 
         * @param options - Search options
         * @returns List of matching PageMetadata
         */
        try {
            const response = await api.get('/api/pages/search/', { params: options })
            return response.data
        } catch (error: any) {
            throw new StructureQueryError(
                StructureQueryErrorCode.DATABASE_ERROR,
                'Failed to search pages',
                error
            )
        }
    }
}


// Singleton instance for convenience
export const pageStructureHelpers = new PageStructureHelpers()


// Convenience functions that use singleton instance
export function getPageById(pageId: number, versionFilter?: VersionFilter): Promise<PageMetadata | null> {
    return pageStructureHelpers.getPageById(pageId, versionFilter)
}

export function getPageByPath(path: string, hostname?: string, versionFilter?: VersionFilter): Promise<PageMetadata | null> {
    return pageStructureHelpers.getPageByPath(path, hostname, versionFilter)
}

export function getActiveChildren(pageId: number, includeUnpublished?: boolean): Promise<ChildPageInfo[]> {
    return pageStructureHelpers.getActiveChildren(pageId, includeUnpublished)
}

export function getChildrenRecursive(
    pageId: number,
    maxDepth?: number,
    includeUnpublished?: boolean
): Promise<PageTreeNode> {
    return pageStructureHelpers.getChildrenRecursive(pageId, maxDepth, includeUnpublished)
}

export function getAncestors(pageId: number): Promise<PageMetadata[]> {
    return pageStructureHelpers.getAncestors(pageId)
}

export function getBreadcrumbs(pageId: number): Promise<BreadcrumbItem[]> {
    return pageStructureHelpers.getBreadcrumbs(pageId)
}

export function getRootPage(pageId: number): Promise<PageMetadata | null> {
    return pageStructureHelpers.getRootPage(pageId)
}

export function getCurrentVersion(pageId: number): Promise<VersionMetadata | null> {
    return pageStructureHelpers.getCurrentVersion(pageId)
}

export function getPageWithVersions(pageId: number): Promise<PageWithVersion | null> {
    return pageStructureHelpers.getPageWithVersions(pageId)
}

export function getPageStructureSummary(pageId: number): Promise<PageStructureSummary | null> {
    return pageStructureHelpers.getPageStructureSummary(pageId)
}

export function searchPages(options?: PageSearchOptions): Promise<PageMetadata[]> {
    return pageStructureHelpers.searchPages(options)
}

