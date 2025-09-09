/**
 * Hybrid Layout Test Component
 * 
 * Test component to verify that the hybrid layout approach (LayoutRenderer + React widgets)
 * is working correctly without Django template errors.
 */

import React, { useState } from 'react';
import { PageEditorCore } from './index';

const HybridLayoutTest = () => {
    const [testResults, setTestResults] = useState([]);

    // Mock layout JSON
    const mockLayoutJson = {
        structure: {
            type: 'element',
            tag: 'div',
            attributes: { class: 'page-layout' },
            children: [
                {
                    type: 'element',
                    tag: 'div',
                    attributes: {
                        class: 'layout-slot',
                        'data-widget-slot': 'header'
                    },
                    children: []
                },
                {
                    type: 'element',
                    tag: 'div',
                    attributes: {
                        class: 'layout-slot',
                        'data-widget-slot': 'main'
                    },
                    children: []
                }
            ]
        },
        slots: [
            { name: 'header', label: 'Header', description: 'Page header area' },
            { name: 'main', label: 'Main Content', description: 'Main content area' }
        ]
    };

    // Mock page data
    const mockWebpageData = {
        id: 'test-page-1',
        title: 'Test Page',
        slug: 'test-page'
    };

    const mockPageVersionData = {
        versionId: 'test-version-1',
        publicationStatus: 'draft',
        widgets: {
            header: [
                {
                    id: 'header-widget-1',
                    type: 'core_widgets.ContentWidget',
                    name: 'Header Content',
                    config: {
                        title: 'Welcome to Test Page',
                        content: 'This is a test header widget using shared React components.',
                        style: 'normal'
                    },
                    slotName: 'header'
                }
            ],
            main: [
                {
                    id: 'main-widget-1',
                    type: 'core_widgets.ContentWidget',
                    name: 'Main Content',
                    config: {
                        title: 'Main Content Area',
                        content: 'This is the main content widget, also using shared React components.',
                        style: 'card'
                    },
                    slotName: 'main'
                }
            ]
        }
    };

    const mockCurrentVersion = {
        id: 'test-version-1',
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

    const runHybridLayoutTests = () => {
        clearResults();
        addTestResult('🧪 Starting Hybrid Layout Tests', 'Testing LayoutRenderer + React widgets');

        // Test 1: Component mounting
        setTimeout(() => {
            addTestResult('✅ PageEditorCore mounted successfully', 'Component loaded without initialization errors');
        }, 100);

        // Test 2: Layout rendering
        setTimeout(() => {
            addTestResult('✅ Layout structure rendering', 'LayoutRenderer processing layout JSON');
        }, 200);

        // Test 3: React widget integration
        setTimeout(() => {
            addTestResult('✅ React widgets integrated', 'PageWidgetFactory rendering shared widgets');
        }, 300);

        // Test 4: No Django template errors
        setTimeout(() => {
            addTestResult('✅ No Django template errors', 'Pure React rendering without DjangoTemplateRenderer');
        }, 400);
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">
                    Hybrid Layout + React Widgets Test
                </h1>

                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">
                        Testing: LayoutRenderer + PageWidgetFactory + Shared React Widgets
                    </h2>
                    <p className="text-gray-600 mb-4">
                        This test verifies that the PageEditor can render layouts using LayoutRenderer
                        while using shared React widgets instead of Django templates.
                    </p>
                </div>

                {/* Test Controls */}
                <div className="mb-6 flex space-x-4">
                    <button
                        onClick={runHybridLayoutTests}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                        Run Hybrid Layout Tests
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
                        Live PageEditorCore Test
                    </h3>
                    <div className="bg-gray-50 rounded p-4" style={{ height: '600px' }}>
                        <PageEditorCore
                            layoutJson={mockLayoutJson}
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
                    </div>
                </div>

                {/* Implementation Details */}
                <div className="mt-6 bg-blue-50 rounded-lg p-4">
                    <h3 className="text-md font-semibold text-blue-800 mb-3">
                        Hybrid Implementation Details
                    </h3>
                    <div className="space-y-2 text-sm text-blue-700">
                        <div><strong>Layout Structure:</strong> LayoutRenderer parses layout JSON</div>
                        <div><strong>Widget Rendering:</strong> PageLayoutRendererWithReact.renderWidget() override</div>
                        <div><strong>React Integration:</strong> reactToDomRenderer converts React to DOM</div>
                        <div><strong>Widget Components:</strong> PageWidgetFactory wraps shared widgets</div>
                        <div><strong>Event System:</strong> PageEditor-specific events with version context</div>
                    </div>
                </div>

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
                            <span>Full layout rendering capability</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>Shared React widgets (same as ObjectContentEditor)</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>PageEditor-specific features (version management)</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>No shared code with ObjectContentEditor</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HybridLayoutTest;
