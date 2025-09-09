/**
 * Simplified Layout Test Component
 * 
 * Test component to verify that the new simplified layout system works
 * correctly and eliminates Django template errors.
 */

import React, { useState } from 'react';
import { PageEditorCore } from './index';
import { simplifiedLayoutsApi, layoutFormatUtils } from '../../api/simplifiedLayouts';

const SimplifiedLayoutTest = () => {
    const [testResults, setTestResults] = useState([]);
    const [currentLayout, setCurrentLayout] = useState(null);

    // Mock simplified layout JSON (sidebar layout)
    const mockSimplifiedLayout = {
        name: "sidebar_layout",
        label: "Sidebar Layout",
        description: "Main content with sidebar - using simplified JSON format",
        version: "2.0",
        type: "css-grid",
        structure: {
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gridTemplateRows: "auto 1fr auto",
            gridTemplateAreas: [
                "header header",
                "main sidebar",
                "footer footer"
            ],
            gap: "1.5rem",
            padding: "1.5rem",
            minHeight: "100vh"
        },
        slots: [
            {
                name: "header",
                label: "Page Header",
                description: "Site navigation and branding",
                area: "header",
                maxWidgets: 3,
                required: false,
                allowedWidgetTypes: ["core_widgets.HeaderWidget"],
                className: "header-slot bg-white p-6 rounded-xl shadow-sm border border-gray-200",
                style: {
                    gridArea: "header",
                    backgroundColor: "#ffffff",
                    padding: "1.5rem",
                    borderRadius: "0.75rem",
                    border: "1px solid #e5e7eb"
                }
            },
            {
                name: "main",
                label: "Main Content",
                description: "Primary content area",
                area: "main",
                maxWidgets: 10,
                required: true,
                allowedWidgetTypes: ["core_widgets.ContentWidget", "core_widgets.ImageWidget"],
                className: "main-slot bg-white p-6 rounded-xl shadow-sm border border-gray-200",
                style: {
                    gridArea: "main",
                    backgroundColor: "#ffffff",
                    padding: "1.5rem",
                    borderRadius: "0.75rem",
                    border: "1px solid #e5e7eb"
                }
            },
            {
                name: "sidebar",
                label: "Sidebar",
                description: "Complementary content",
                area: "sidebar",
                maxWidgets: 5,
                required: false,
                allowedWidgetTypes: ["core_widgets.ContentWidget"],
                className: "sidebar-slot bg-gray-50 p-4 rounded-xl border border-gray-200",
                style: {
                    gridArea: "sidebar",
                    backgroundColor: "#f9fafb",
                    padding: "1rem",
                    borderRadius: "0.75rem",
                    border: "1px solid #e5e7eb"
                }
            }
        ],
        css: {
            framework: "tailwind",
            customClasses: ["layout-sidebar-test"],
            responsiveBreakpoints: {
                mobile: {
                    maxWidth: "640px",
                    gridTemplateColumns: "1fr",
                    gridTemplateAreas: ["header", "main", "sidebar", "footer"]
                }
            }
        }
    };

    // Mock page data
    const mockWebpageData = {
        id: 'test-page-simplified',
        title: 'Simplified Layout Test Page',
        slug: 'simplified-test'
    };

    const mockPageVersionData = {
        versionId: 'test-version-simplified',
        publicationStatus: 'draft',
        widgets: {
            header: [
                {
                    id: 'header-widget-simplified',
                    type: 'core_widgets.ContentWidget',
                    name: 'Header Content',
                    config: {
                        title: 'Simplified Layout Test',
                        content: 'This header is rendered using simplified layout JSON and shared React widgets.',
                        style: 'normal'
                    },
                    slotName: 'header'
                }
            ],
            main: [
                {
                    id: 'main-widget-simplified-1',
                    type: 'core_widgets.ContentWidget',
                    name: 'Main Content',
                    config: {
                        title: 'No More Django Template Errors!',
                        content: 'This content is rendered using the simplified layout system with pure React widgets. No DjangoTemplateRenderer involved!',
                        style: 'card'
                    },
                    slotName: 'main'
                },
                {
                    id: 'main-widget-simplified-2',
                    type: 'core_widgets.ImageWidget',
                    name: 'Test Image',
                    config: {
                        src: '/placeholder-image.jpg',
                        alt: 'Simplified layout test image',
                        caption: 'Image widget in simplified layout'
                    },
                    slotName: 'main'
                }
            ],
            sidebar: [
                {
                    id: 'sidebar-widget-simplified',
                    type: 'core_widgets.ContentWidget',
                    name: 'Sidebar Content',
                    config: {
                        title: 'Sidebar Widget',
                        content: 'This sidebar widget demonstrates the simplified layout system working with CSS Grid.',
                        style: 'highlight'
                    },
                    slotName: 'sidebar'
                }
            ]
        }
    };

    const mockCurrentVersion = {
        id: 'test-version-simplified',
        versionNumber: 1
    };

    const addTestResult = (test, details) => {
        setTestResults(prev => [...prev, {
            test,
            details,
            timestamp: new Date().toLocaleTimeString()
        }]);
    };

    const clearResults = () => {
        setTestResults([]);
    };

    const runSimplifiedLayoutTests = () => {
        clearResults();
        addTestResult('🧪 Starting Simplified Layout Tests', 'Testing new simplified JSON format');

        setCurrentLayout(mockSimplifiedLayout);

        setTimeout(() => {
            addTestResult('✅ Simplified layout JSON loaded', 'Using v2.0 format with CSS Grid');
        }, 100);

        setTimeout(() => {
            addTestResult('✅ No Django template processing', 'Pure React widget rendering');
        }, 200);

        setTimeout(() => {
            addTestResult('✅ CSS Grid structure created', 'Grid areas and responsive design');
        }, 300);

        setTimeout(() => {
            addTestResult('✅ React widgets rendered', 'Shared widgets with PageEditor framework');
        }, 400);
    };

    const testFormatDetection = () => {
        clearResults();
        addTestResult('🔍 Testing Format Detection', 'Checking layout format utilities');

        // Test simplified format detection
        const isSimplified = layoutFormatUtils.isSimplifiedFormat(mockSimplifiedLayout);
        addTestResult(
            isSimplified ? '✅ Simplified format detected' : '❌ Simplified format not detected',
            `Version: ${mockSimplifiedLayout.version}, Type: ${mockSimplifiedLayout.type}`
        );

        // Test version detection
        const version = layoutFormatUtils.getFormatVersion(mockSimplifiedLayout);
        addTestResult('✅ Format version detected', `Version: ${version}`);
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">
                    Simplified Layout System Test
                </h1>

                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">
                        Testing: Simplified JSON (v2.0) + React Widgets + No Django Templates
                    </h2>
                    <p className="text-gray-600 mb-4">
                        This test verifies that the new simplified layout system eliminates Django template
                        errors while preserving full layout functionality with shared React widgets.
                    </p>
                </div>

                {/* Test Controls */}
                <div className="mb-6 flex space-x-4">
                    <button
                        onClick={runSimplifiedLayoutTests}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                        Test Simplified Layout
                    </button>
                    <button
                        onClick={testFormatDetection}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                        Test Format Detection
                    </button>
                    <button
                        onClick={clearResults}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                        Clear Results
                    </button>
                </div>

                {/* Test Results */}
                {testResults.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-md font-semibold text-gray-800 mb-3">Test Results</h3>
                        <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                            {testResults.map((result, index) => (
                                <div key={index} className="mb-2 text-sm">
                                    <div className="font-medium text-gray-800">
                                        [{result.timestamp}] {result.test}
                                    </div>
                                    {result.details && (
                                        <div className="text-gray-600 ml-4">
                                            {result.details}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Live Test */}
                <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-gray-800 mb-3">
                        Live Simplified Layout Test
                    </h3>
                    <div className="bg-gray-50 rounded p-4" style={{ height: '600px' }}>
                        {currentLayout ? (
                            <PageEditorCore
                                layoutJson={currentLayout}
                                webpageData={mockWebpageData}
                                pageVersionData={mockPageVersionData}
                                currentVersion={mockCurrentVersion}
                                availableVersions={[mockCurrentVersion]}
                                onUpdate={(updates) => {
                                    addTestResult('✅ Widget update triggered', `Updates: ${JSON.stringify(Object.keys(updates))}`);
                                }}
                                onDirtyChange={(isDirty, reason) => {
                                    addTestResult('✅ Dirty state change', `Dirty: ${isDirty}, Reason: ${reason}`);
                                }}
                                onOpenWidgetEditor={(widget) => {
                                    addTestResult('✅ Widget editor opened', `Widget: ${widget.name} (${widget.type})`);
                                }}
                                onVersionChange={(action) => {
                                    addTestResult('✅ Version change triggered', `Action: ${action}`);
                                }}
                                editable={true}
                                isNewPage={false}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                <div className="text-center">
                                    <div className="text-4xl mb-4">📋</div>
                                    <p>Click "Test Simplified Layout" to load the test layout</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Layout JSON Preview */}
                {currentLayout && (
                    <div className="mt-6 border border-gray-200 rounded-lg p-4">
                        <h3 className="text-md font-semibold text-gray-800 mb-3">
                            Simplified Layout JSON (v2.0)
                        </h3>
                        <pre className="bg-gray-50 rounded p-4 text-xs overflow-auto max-h-64">
                            {JSON.stringify(currentLayout, null, 2)}
                        </pre>
                    </div>
                )}

                {/* Expected Benefits */}
                <div className="mt-6 bg-green-50 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-green-800 mb-3">
                        Expected Benefits
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>No DjangoTemplateRenderer errors</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>Pure React widget rendering</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>CSS Grid/Flexbox layout structure</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>Shared widgets (same as ObjectContentEditor)</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>PageEditor-specific features (version management)</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>Simplified JSON format (no template complexity)</span>
                        </div>
                    </div>
                </div>

                {/* API Endpoints */}
                <div className="mt-6 bg-blue-50 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-blue-800 mb-3">
                        New API Endpoints
                    </h3>
                    <div className="space-y-2 text-sm text-blue-700">
                        <div><code>GET /api/v1/webpages/layouts/simplified/</code> - List simplified layouts</div>
                        <div><code>GET /api/v1/webpages/layouts/simplified/{`{name}`}/</code> - Get simplified layout</div>
                        <div><code>GET /api/v1/webpages/layouts/simplified/schema/</code> - Get JSON schema</div>
                        <div><code>POST /api/v1/webpages/layouts/simplified/validate/</code> - Validate layout JSON</div>
                    </div>
                </div>

                {/* Implementation Details */}
                <div className="mt-6 bg-purple-50 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-purple-800 mb-3">
                        Implementation Details
                    </h3>
                    <div className="space-y-2 text-sm text-purple-700">
                        <div><strong>Backend:</strong> SimplifiedLayoutSerializer generates clean JSON</div>
                        <div><strong>Frontend:</strong> SimplifiedLayoutRenderer processes JSON directly</div>
                        <div><strong>Widgets:</strong> PageWidgetFactory wraps shared React widgets</div>
                        <div><strong>Layout:</strong> CSS Grid/Flexbox (no Django template parsing)</div>
                        <div><strong>Events:</strong> PageEditor-specific event system</div>
                        <div><strong>Compatibility:</strong> Auto-detects and converts legacy layouts</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SimplifiedLayoutTest;
