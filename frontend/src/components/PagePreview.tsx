import React, { useState } from 'react';
import ContentEditor from './ContentEditor';
import type { ComponentType } from 'react';

// TypeScript: ContentEditor is a JS component without TS props, cast to any-compatible component
const AnyContentEditor = ContentEditor as unknown as ComponentType<any>;



// Preview component that renders actual page content without editing controls
const PagePreview = ({ webpageData, pageVersionData, isLoadingLayout, layoutData }) => {
    const [viewportSize, setViewportSize] = useState('desktop');

    // Viewport configurations with realistic device dimensions
    const viewports = {
        desktop: { width: '100%', height: '100%', label: 'Desktop', icon: '🖥️' },
        tablet: { width: '820px', height: '1180px', label: 'iPad Pro', icon: '📱' },
        mobile: { width: '390px', height: '844px', label: 'iPhone 14', icon: '📱' }
    };

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

    if (!pageVersionData.codeLayout) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-500">
                    <p className="text-lg">No layout selected</p>
                    <p className="text-sm">Choose a layout to see the preview</p>
                </div>
            </div>
        );
    }

    // Show loading state if layout data is still being fetched
    if (isLoadingLayout) {
        return (
            <div className="h-full bg-gray-50 overflow-auto">
                <div className="h-full p-4 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                        <p className="text-lg">Loading preview...</p>
                        <p className="text-sm">Fetching layout data</p>
                    </div>
                </div>
            </div>
        );
    }

    // Show error state if layout data failed to load
    if (!layoutData && pageVersionData.codeLayout) {
        return (
            <div className="h-full bg-gray-50 overflow-auto">
                <div className="h-full p-4 flex items-center justify-center">
                    <div className="text-center text-red-500">
                        <p className="text-lg">Preview unavailable</p>
                        <p className="text-sm">Failed to load layout: {pageVersionData.codeLayout}</p>
                    </div>
                </div>
            </div>
        );
    }

    const currentViewport = viewports[viewportSize];

    return (
        <div className="h-full bg-gray-50 flex flex-col">
            {/* Responsive Preview Controls */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">Preview</h3>
                    <div className="flex items-center space-x-1">
                        {Object.entries(viewports).map(([key, viewport]) => (
                            <button
                                key={key}
                                onClick={() => setViewportSize(key)}
                                className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewportSize === key
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                                    }`}
                                title={`Switch to ${viewport.label} view`}
                            >
                                <span className="mr-1">{viewport.icon}</span>
                                {viewport.label}
                            </button>
                        ))}
                    </div>
                </div>
                {/* Viewport Size Indicator */}
                {viewportSize !== 'desktop' && (
                    <div className="mt-2 text-xs text-gray-500 text-center">
                        {currentViewport.width} × {currentViewport.height}
                    </div>
                )}
            </div>

            {/* Preview Content */}
            <div className="flex-1 bg-gray-100 overflow-auto">
                {viewportSize === 'desktop' ? (
                    /* Desktop: Full responsive container */
                    <div className="h-full p-4">
                        <div className="bg-white shadow-lg rounded-lg w-full h-full overflow-auto">
                            <AnyContentEditor
                                key={`preview-${webpageData?.id}-${pageVersionData?.versionId || 'current'}`}
                                layoutJson={layoutData}
                                webpageData={webpageData}
                                pageVersionData={pageVersionData}
                                editable={false}
                                className="h-full preview-mode"
                            />
                        </div>
                    </div>
                ) : (
                    /* Mobile/Tablet: Fixed-size device containers with external scrolling */
                    <div className="h-full p-4 overflow-auto">
                        <div className="min-h-full flex items-start justify-center">
                            {/* Fixed-size device frame */}
                            <div
                                className={`transition-all duration-300 flex-shrink-0 ${viewportSize === 'tablet'
                                    ? 'border-2 border-gray-800 rounded-xl shadow-2xl'
                                    : 'border-2 border-gray-900 rounded-3xl shadow-2xl'
                                    }`}
                                style={{
                                    width: currentViewport.width,
                                    height: currentViewport.height,
                                    // Add device-like styling for mobile and tablet
                                    background: viewportSize === 'mobile'
                                        ? 'linear-gradient(145deg, #1f2937, #374151)'
                                        : 'linear-gradient(145deg, #374151, #4b5563)',
                                    padding: viewportSize === 'mobile' ? '8px' : '6px',
                                }}
                            >
                                {/* Inner screen with fixed dimensions and device-like scrolling */}
                                <div
                                    className="bg-white w-full h-full rounded-lg overflow-auto relative"
                                    style={{
                                        // Device-like smooth scrolling
                                        scrollBehavior: 'smooth',
                                        WebkitOverflowScrolling: 'touch',
                                        // Custom scrollbar for device-like appearance
                                        scrollbarWidth: 'thin',
                                        scrollbarColor: '#CBD5E0 transparent'
                                    }}
                                >
                                    {/* Device content area with natural scrolling */}
                                    <div className="w-full">
                                        <AnyContentEditor
                                            key={`mobile-preview-${webpageData?.id}-${pageVersionData?.versionId || 'current'}`}
                                            layoutJson={layoutData}
                                            webpageData={webpageData}
                                            pageVersionData={pageVersionData}
                                            editable={false}
                                            className="preview-mode device-content"
                                            style={{
                                                minHeight: 'auto',
                                                height: 'auto',
                                                display: 'block',
                                                overflow: 'visible'
                                            }}
                                        />
                                        {/* Add bottom padding for device-like scroll experience */}
                                        <div className="h-20 w-full"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}

export default PagePreview;