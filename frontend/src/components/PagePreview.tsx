import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw, Monitor, Settings } from 'lucide-react';
import { previewSizesApi } from '../api';
import PreviewSizeManager from './PreviewSizeManager';
import { resolvePagePreviewModel } from './resolvePagePreviewModel';
import RenderFrame from '../rendering/RenderFrame';
import { createPageRenderModel } from '../rendering/adapters';
import { googleFontsStylesheetUrl } from '../rendering/primitives';
import type { RenderPageModel } from '../rendering/types';

interface PreviewSize {
    id: number;
    name: string;
    width: number;
    height: number | null;
    sortOrder: number;
    isDefault: boolean;
}

interface PagePreviewProps {
    webpageData: any;
    pageVersionData: any;
    isLoadingLayout?: boolean;
    layoutData?: any;
    localWidgets?: Record<string, any[]>;
    inheritedWidgets?: Record<string, any[]>;
    slotInheritanceRules?: Record<string, any>;
    pathVariables?: Record<string, string>;
    simulatedPath?: string;
}

// Default Tailwind breakpoint sizes as fallback
const DEFAULT_SIZES: Omit<PreviewSize, 'id'>[] = [
    { name: 'Desktop', width: 1920, height: 1080, sortOrder: 0, isDefault: true },
    { name: 'Laptop', width: 1280, height: 800, sortOrder: 1, isDefault: true },
    { name: 'Tablet', width: 768, height: 1024, sortOrder: 2, isDefault: true },
    { name: 'Mobile Large', width: 640, height: 844, sortOrder: 3, isDefault: true },
    { name: 'Mobile', width: 375, height: 667, sortOrder: 4, isDefault: true },
];

const PagePreview: React.FC<PagePreviewProps> = ({
    webpageData,
    pageVersionData,
    isLoadingLayout,
    layoutData,
    localWidgets,
    inheritedWidgets,
    slotInheritanceRules,
    pathVariables,
    simulatedPath,
}) => {
    const [selectedSizeId, setSelectedSizeId] = useState<number | null>(null);
    const [isManaging, setIsManaging] = useState(false);
    const [iframeKey, setIframeKey] = useState(0);
    const [themeCss, setThemeCss] = useState('');
    const [resolvedModel, setResolvedModel] = useState<RenderPageModel | null>(null);

    // Fetch preview sizes from backend
    const { data: previewSizesResponse, isLoading: isLoadingSizes, refetch: refetchSizes } = useQuery({
        queryKey: ['previewSizes'],
        queryFn: () => previewSizesApi.list(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Handle paginated API response (DRF returns {count, next, previous, results})
    const backendSizes = (previewSizesResponse as any)?.results || previewSizesResponse || [];

    // Use backend sizes or fall back to defaults
    const previewSizes: PreviewSize[] = backendSizes.length > 0
        ? backendSizes
        : DEFAULT_SIZES.map((size, index) => ({ ...size, id: -index - 1 }));

    // Set initial selected size
    useEffect(() => {
        if (previewSizes.length > 0 && selectedSizeId === null) {
            setSelectedSizeId(previewSizes[0].id);
        }
    }, [previewSizes, selectedSizeId]);

    // Auto-refresh iframe when page version data changes
    useEffect(() => {
        setIframeKey(prev => prev + 1);
    }, [pageVersionData]);

    // Manual refresh handler
    const handleRefresh = useCallback(() => {
        setIframeKey(prev => prev + 1);
    }, []);

    // Get selected size configuration
    const selectedSize = previewSizes.find(size => size.id === selectedSizeId) || previewSizes[0];

    const renderUrl = useMemo(() => {
        const siteId = webpageData?.cachedRootId
            || webpageData?.cached_root_id
            || webpageData?.breadcrumbs?.[0]?.id
            || (!webpageData?.parentId && !webpageData?.parent_id ? webpageData?.id : null);
        if (!siteId) return null;
        const path = String(webpageData?.cachedPath || webpageData?.cached_path || webpageData?.absoluteUrl || webpageData?.slug || '')
            .split('?')[0]
            .replace(/^\/+|\/+$/g, '');
        return `/_render/${siteId}${path ? `/${path}` : ''}`;
    }, [webpageData]);

    const themeId = pageVersionData?.effectiveTheme?.id
        || pageVersionData?.theme?.id
        || pageVersionData?.theme
        || webpageData?.effectiveTheme?.id;

    useEffect(() => {
        if (!themeId) { setThemeCss(''); return; }
        const controller = new AbortController();
        fetch(`/api/v1/webpages/themes/${themeId}/styles.css`, { credentials: 'same-origin', signal: controller.signal })
            .then((response) => response.ok ? response.text() : '')
            .then(setThemeCss)
            .catch((error) => { if (error.name !== 'AbortError') setThemeCss(''); });
        return () => controller.abort();
    }, [themeId]);

    const layoutName = layoutData?.layout?.name || layoutData?.name || pageVersionData?.codeLayout || 'main_layout';
    const renderModel = useMemo(() => createPageRenderModel({
        layout: layoutName,
        widgets: localWidgets || pageVersionData?.widgets || {},
        inheritedWidgets,
        slotInheritanceRules,
        themeCss,
        fontUrl: googleFontsStylesheetUrl(pageVersionData?.effectiveTheme?.fonts || webpageData?.effectiveTheme?.fonts),
        context: {
            pageId: webpageData?.id,
            siteId: webpageData?.cachedRootId || webpageData?.cached_root_id || (!webpageData?.parentId && !webpageData?.parent_id ? webpageData?.id : undefined),
            siteHostnames: webpageData?.hostnames || webpageData?.cachedRootHostnames || webpageData?.cached_root_hostnames || [],
            versionId: pageVersionData?.id || pageVersionData?.versionId,
            pathVariables: pathVariables || {},
            simulatedPath,
            componentStyles: pageVersionData?.effectiveTheme?.componentStyles || pageVersionData?.effectiveTheme?.component_styles || {},
        },
    }), [layoutName, localWidgets, pageVersionData, inheritedWidgets, slotInheritanceRules, themeCss, webpageData, pathVariables, simulatedPath]);

    useEffect(() => {
        let current = true;
        setResolvedModel(renderModel);
        resolvePagePreviewModel(renderModel).then((resolved) => { if (current) setResolvedModel(resolved); });
        return () => { current = false; };
    }, [renderModel]);

    if (!webpageData || !pageVersionData) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-500">
                    <div className="text-lg">No page data available</div>
                    <div className="text-sm">Save your page to see the preview</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-gray-50 flex flex-col">
            {/* Preview Controls Toolbar */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Monitor className="w-5 h-5 text-gray-500" />
                        <div className="text-sm font-medium text-gray-900" role="heading" aria-level="3">Preview</div>
                    </div>

                    <div className="flex items-center space-x-3">
                        {/* Size Selector Buttons */}
                        <div className="flex items-center space-x-1">
                            {isLoadingSizes ? (
                                <div className="text-xs text-gray-500 px-3 py-1.5">
                                    Loading sizes...
                                </div>
                            ) : (
                                previewSizes.map((size) => (
                                    <button
                                        key={size.id}
                                        onClick={() => setSelectedSizeId(size.id)}
                                        className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedSizeId === size.id
                                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                                            }`}
                                        title={`${size.width}${size.height ? `×${size.height}` : 'px'}`}
                                    >
                                        {size.name}
                                    </button>
                                ))
                            )}
                        </div>

                        {renderUrl && (
                            <a
                                href={renderUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                title="Open the latest saved preview in a new tab"
                            >
                                <ExternalLink className="w-4 h-4 mr-1.5" />
                                Open saved preview
                            </a>
                        )}

                        {/* Refresh Button */}
                        <button
                            onClick={handleRefresh}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            title="Refresh preview"
                        >
                            <RefreshCw className="w-4 h-4 mr-1.5" />
                            Refresh
                        </button>

                        {/* Manage Sizes Button */}
                        <button
                            onClick={() => setIsManaging(true)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            title="Manage preview sizes"
                        >
                            <Settings className="w-4 h-4 mr-1.5" />
                            Manage Sizes
                        </button>
                    </div>
                </div>

                {/* Size Indicator & Preview URL */}
                {selectedSize && (
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <div className="text-center flex-1">
                            {selectedSize.width}px
                            {selectedSize.height && ` × ${selectedSize.height}px`}
                            {!selectedSize.height && ' wide (responsive height)'}
                        </div>
                        <div className="text-right text-gray-400 font-mono truncate max-w-md">Unsaved working copy</div>
                    </div>
                )}
            </div>

            {/* Preview Container */}
            <div className="flex-1 bg-gray-100 overflow-auto">
                {isLoadingLayout ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center text-gray-500">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <div className="text-sm">Loading preview...</div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full p-4 flex items-start justify-center">
                        {/* Iframe Container with Selected Dimensions */}
                        <div
                            className="bg-white shadow-xl rounded-lg overflow-hidden transition-all duration-300"
                            style={{
                                width: selectedSize ? `${selectedSize.width}px` : '100%',
                                height: selectedSize?.height ? `${selectedSize.height}px` : '100%',
                                maxWidth: '100%',
                                maxHeight: '100%',
                            }}
                        >
                            <RenderFrame
                                key={iframeKey}
                                model={resolvedModel || renderModel}
                                className="w-full h-full border-0"
                                title="Page Preview"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Preview Size Manager Modal */}
            {isManaging && (
                <PreviewSizeManager
                    isOpen={isManaging}
                    onClose={() => setIsManaging(false)}
                    onSizesUpdated={() => {
                        refetchSizes();
                    }}
                />
            )}
        </div>
    );
};

export default PagePreview;
