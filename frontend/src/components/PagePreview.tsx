import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Monitor, Settings } from 'lucide-react';
import { previewSizesApi } from '../api';
import PreviewSizeManager from './PreviewSizeManager';

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
}) => {
    const [selectedSizeId, setSelectedSizeId] = useState<number | null>(null);
    const [isManaging, setIsManaging] = useState(false);
    const [iframeKey, setIframeKey] = useState(0);

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

    if (!webpageData || !pageVersionData) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-500">
                    <p className="text-lg">No page data available</p>
                    <p className="text-sm">Save your page to see the preview</p>
                </div>
            </div>
        );
    }

    if (!pageVersionData.id) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-500">
                    <p className="text-lg">Version not saved</p>
                    <p className="text-sm">Save the page to preview</p>
                </div>
            </div>
        );
    }

    // Get root page to access hostname
    const getRootPage = (page: any): any => {
        if (!page) return null;
        let root = page;
        while (root.parent) {
            root = root.parent;
        }
        return root;
    };

    const rootPage = getRootPage(webpageData);

    // Check if root page has hostnames
    const hasHostnames = rootPage?.hostnames && rootPage.hostnames.length > 0;
    const hostname = hasHostnames ? rootPage.hostnames[0] : null;

    // Check for hostname configuration before building preview URL
    if (!hostname) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="max-w-2xl mx-auto p-6">
                    <div className="bg-white border border-amber-300 rounded-lg shadow-sm p-6">
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                                <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-medium text-amber-900">Preview Configuration Required</h3>
                                <p className="mt-2 text-sm text-amber-800">
                                    This page cannot be previewed because the root page does not have any hostnames configured.
                                </p>
                                <div className="mt-3 text-sm text-amber-800">
                                    <p className="font-medium">Root Page: {rootPage?.title || rootPage?.slug || 'Unknown'}</p>
                                    {rootPage?.id && <p className="text-xs text-amber-700 mt-1">ID: {rootPage.id}</p>}
                                </div>
                                <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3">
                                    <p className="text-sm font-medium text-amber-900 mb-2">How to fix:</p>
                                    <ol className="text-sm text-amber-800 space-y-1 list-decimal list-inside">
                                        <li>Go to the Django Admin panel</li>
                                        <li>Navigate to Web Pages → Web Pages</li>
                                        <li>Edit the root page: <strong>{rootPage?.title || rootPage?.slug}</strong></li>
                                        <li>Add at least one hostname in the "Hostnames" field</li>
                                        <li>Save and refresh this preview</li>
                                    </ol>
                                    <p className="text-xs text-amber-700 mt-2">
                                        Examples: <code className="bg-amber-100 px-1 rounded">localhost:8000</code>, <code className="bg-amber-100 px-1 rounded">example.com</code>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Determine protocol
    const protocol = hostname && (hostname.startsWith('localhost') || hostname.startsWith('127.0.0.1'))
        ? 'http'
        : 'https';

    // Build full preview URL with hostname
    const previewPath = previewSizesApi.getPreviewUrl(
        webpageData.id,
        pageVersionData.id || pageVersionData.versionId
    );

    const previewUrl = hostname
        ? `${protocol}://${hostname}${previewPath}`
        : previewPath;

    return (
        <div className="h-full bg-gray-50 flex flex-col">
            {/* Preview Controls Toolbar */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Monitor className="w-5 h-5 text-gray-500" />
                        <h3 className="text-sm font-medium text-gray-900">Preview</h3>
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
                        <div className="text-right text-gray-400 font-mono truncate max-w-md" title={previewUrl}>
                            {hostname}
                        </div>
                    </div>
                )}
            </div>

            {/* Preview Container */}
            <div className="flex-1 bg-gray-100 overflow-auto">
                {isLoadingLayout ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center text-gray-500">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-sm">Loading preview...</p>
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
                            <iframe
                                key={iframeKey}
                                src={previewUrl}
                                className="w-full h-full border-0"
                                title="Page Preview"
                                sandbox="allow-same-origin allow-scripts"
                                referrerPolicy="same-origin"
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
