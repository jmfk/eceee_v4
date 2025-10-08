/**
 * React Hook for Page Structure Queries
 * 
 * Provides easy access to page structure and metadata queries.
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query'
import {
    PageMetadata,
    VersionMetadata,
    PageWithVersion,
    ChildPageInfo,
    PageTreeNode,
    PageStructureSummary,
    BreadcrumbItem,
    PageSearchOptions,
    VersionStatus,
    VersionFilter
} from '../types/pageStructure'
import { PageStructureHelpers } from '../utils/pageStructure'


const helpers = new PageStructureHelpers()


/**
 * Hook to get page metadata by ID
 */
export function usePageMetadata(
    pageId: number | null, 
    versionFilter?: VersionFilter
): UseQueryResult<PageMetadata | null> {
    return useQuery({
        queryKey: ['page', 'metadata', pageId, versionFilter],
        queryFn: () => pageId ? helpers.getPageById(pageId, versionFilter) : null,
        enabled: pageId !== null,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}


/**
 * Hook to get page metadata by path
 */
export function usePageByPath(
    path: string | null,
    hostname?: string,
    versionFilter?: VersionFilter
): UseQueryResult<PageMetadata | null> {
    return useQuery({
        queryKey: ['page', 'by-path', path, hostname, versionFilter],
        queryFn: () => path ? helpers.getPageByPath(path, hostname, versionFilter) : null,
        enabled: path !== null,
        staleTime: 5 * 60 * 1000,
    })
}


/**
 * Hook to get active children of a page
 */
export function usePageChildren(
    pageId: number | null,
    includeUnpublished: boolean = false
): UseQueryResult<ChildPageInfo[]> {
    return useQuery({
        queryKey: ['page', pageId, 'children', includeUnpublished],
        queryFn: () => pageId ? helpers.getActiveChildren(pageId, includeUnpublished) : [],
        enabled: pageId !== null,
        staleTime: 5 * 60 * 1000,
    })
}


/**
 * Hook to get page tree recursively
 */
export function usePageTree(
    pageId: number | null,
    maxDepth?: number,
    includeUnpublished: boolean = false
): UseQueryResult<PageTreeNode | null> {
    return useQuery({
        queryKey: ['page', pageId, 'tree', maxDepth, includeUnpublished],
        queryFn: () => pageId ? helpers.getChildrenRecursive(pageId, maxDepth, includeUnpublished) : null,
        enabled: pageId !== null,
        staleTime: 5 * 60 * 1000,
    })
}


/**
 * Hook to get ancestors of a page
 */
export function usePageAncestors(pageId: number | null): UseQueryResult<PageMetadata[]> {
    return useQuery({
        queryKey: ['page', pageId, 'ancestors'],
        queryFn: () => pageId ? helpers.getAncestors(pageId) : [],
        enabled: pageId !== null,
        staleTime: 10 * 60 * 1000, // 10 minutes (hierarchies change less)
    })
}


/**
 * Hook to get breadcrumbs for a page
 */
export function useBreadcrumbs(pageId: number | null): UseQueryResult<BreadcrumbItem[]> {
    return useQuery({
        queryKey: ['page', pageId, 'breadcrumbs'],
        queryFn: () => pageId ? helpers.getBreadcrumbs(pageId) : [],
        enabled: pageId !== null,
        staleTime: 10 * 60 * 1000,
    })
}


/**
 * Hook to get root page for a given page
 */
export function useRootPage(pageId: number | null): UseQueryResult<PageMetadata | null> {
    return useQuery({
        queryKey: ['page', pageId, 'root'],
        queryFn: () => pageId ? helpers.getRootPage(pageId) : null,
        enabled: pageId !== null,
        staleTime: 10 * 60 * 1000,
    })
}


/**
 * Hook to get version metadata by ID
 */
export function useVersionMetadata(versionId: number | null): UseQueryResult<VersionMetadata | null> {
    return useQuery({
        queryKey: ['version', 'metadata', versionId],
        queryFn: () => versionId ? helpers.getVersionById(versionId) : null,
        enabled: versionId !== null,
        staleTime: 5 * 60 * 1000,
    })
}


/**
 * Hook to get all versions for a page
 */
export function usePageVersions(
    pageId: number | null,
    status?: VersionStatus
): UseQueryResult<VersionMetadata[]> {
    return useQuery({
        queryKey: ['page', pageId, 'versions', status],
        queryFn: () => pageId ? helpers.getVersionsForPage(pageId, status) : [],
        enabled: pageId !== null,
        staleTime: 2 * 60 * 1000, // 2 minutes (versions change more frequently)
    })
}


/**
 * Hook to get current published version for a page
 */
export function useCurrentVersion(pageId: number | null): UseQueryResult<VersionMetadata | null> {
    return useQuery({
        queryKey: ['page', pageId, 'current-version'],
        queryFn: () => pageId ? helpers.getCurrentVersion(pageId) : null,
        enabled: pageId !== null,
        staleTime: 2 * 60 * 1000,
    })
}


/**
 * Hook to get page with all version information
 */
export function usePageWithVersions(pageId: number | null): UseQueryResult<PageWithVersion | null> {
    return useQuery({
        queryKey: ['page', pageId, 'with-versions'],
        queryFn: () => pageId ? helpers.getPageWithVersions(pageId) : null,
        enabled: pageId !== null,
        staleTime: 2 * 60 * 1000,
    })
}


/**
 * Hook to get comprehensive structure summary for a page
 */
export function usePageStructureSummary(pageId: number | null): UseQueryResult<PageStructureSummary | null> {
    return useQuery({
        queryKey: ['page', pageId, 'structure-summary'],
        queryFn: () => pageId ? helpers.getPageStructureSummary(pageId) : null,
        enabled: pageId !== null,
        staleTime: 5 * 60 * 1000,
    })
}


/**
 * Hook to search for pages
 */
export function usePageSearch(options: PageSearchOptions = {}): UseQueryResult<PageMetadata[]> {
    return useQuery({
        queryKey: ['pages', 'search', options],
        queryFn: () => helpers.searchPages(options),
        staleTime: 5 * 60 * 1000,
    })
}


/**
 * Combined hook that provides all commonly needed page structure data
 */
export interface UsePageStructureResult {
    page: PageMetadata | null
    currentVersion: VersionMetadata | null
    children: ChildPageInfo[]
    ancestors: PageMetadata[]
    breadcrumbs: BreadcrumbItem[]
    summary: PageStructureSummary | null
    isLoading: boolean
    isError: boolean
    error: Error | null
}

export function usePageStructure(pageId: number | null): UsePageStructureResult {
    const pageQuery = usePageMetadata(pageId)
    const versionQuery = useCurrentVersion(pageId)
    const childrenQuery = usePageChildren(pageId)
    const ancestorsQuery = usePageAncestors(pageId)
    const breadcrumbsQuery = useBreadcrumbs(pageId)
    const summaryQuery = usePageStructureSummary(pageId)

    const isLoading = 
        pageQuery.isLoading ||
        versionQuery.isLoading ||
        childrenQuery.isLoading ||
        ancestorsQuery.isLoading ||
        breadcrumbsQuery.isLoading ||
        summaryQuery.isLoading

    const isError = 
        pageQuery.isError ||
        versionQuery.isError ||
        childrenQuery.isError ||
        ancestorsQuery.isError ||
        breadcrumbsQuery.isError ||
        summaryQuery.isError

    const error = 
        pageQuery.error ||
        versionQuery.error ||
        childrenQuery.error ||
        ancestorsQuery.error ||
        breadcrumbsQuery.error ||
        summaryQuery.error

    return {
        page: pageQuery.data ?? null,
        currentVersion: versionQuery.data ?? null,
        children: childrenQuery.data ?? [],
        ancestors: ancestorsQuery.data ?? [],
        breadcrumbs: breadcrumbsQuery.data ?? [],
        summary: summaryQuery.data ?? null,
        isLoading,
        isError,
        error: error as Error | null,
    }
}

