/**
 * Manual React Layout Test
 * 
 * Test component for the new manual React layout approach that eliminates
 * all backend/frontend layout protocol complexity.
 */

import React, { useState } from 'react';
import ReactLayoutRenderer from './ReactLayoutRenderer';
import { getAvailableLayouts } from './layouts/LayoutRegistry';

const ManualReactLayoutTest = () => {
    const [selectedLayout, setSelectedLayout] = useState('sidebar_layout');
    const [testWidgets, setTestWidgets] = useState({
        header: [
            {
                id: 'header-widget-1',
                type: 'core_widgets.ContentWidget',
                name: 'Header Content',
                config: {
                    title: 'Manual React Layout Test',
                    content: 'This header is rendered using pure React layouts - no backend protocol!',
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
                    title: 'Success! 🎉',
                    content: 'This content is rendered using manual React layout components. No Django templates, no complex parsing, no errors!',
                    style: 'card'
                },
                slotName: 'main'
            },
            {
                id: 'main-widget-2',
                type: 'core_widgets.ImageWidget',
                name: 'Test Image',
                config: {
                    src: 'https://via.placeholder.com/600x300/3b82f6/ffffff?text=React+Layout+Success',
                    alt: 'React layout success',
                    caption: 'Manual React layout working perfectly!'
                },
                slotName: 'main'
            }
        ],
        sidebar: [
            {
                id: 'sidebar-widget-1',
                type: 'core_widgets.ContentWidget',
                name: 'Sidebar Content',
                config: {
                    title: 'Sidebar Widget',
                    content: 'This sidebar demonstrates the manual React layout approach. Clean, simple, and flexible!',
                    style: 'highlight'
                },
                slotName: 'sidebar'
            }
        ],
        left: [
            {
                id: 'left-widget-1',
                type: 'core_widgets.ContentWidget',
                name: 'Left Column',
                config: {
                    title: 'Left Column',
                    content: 'Left column content for two/three column layouts.',
                    style: 'normal'
                },
                slotName: 'left'
            }
        ],
        right: [
            {
                id: 'right-widget-1',
                type: 'core_widgets.ContentWidget',
                name: 'Right Column',
                config: {
                    title: 'Right Column',
                    content: 'Right column content for two/three column layouts.',
                    style: 'normal'
                },
                slotName: 'right'
            }
        ],
        center: [
            {
                id: 'center-widget-1',
                type: 'core_widgets.ContentWidget',
                name: 'Center Column',
                config: {
                    title: 'Center Column',
                    content: 'Center column content for three column layout.',
                    style: 'card'
                },
                slotName: 'center'
            }
        ]
    });

    // Mock page context
    const mockPageVersionData = {
        versionId: 'test-manual-react',
        publicationStatus: 'draft'
    };

    const mockCurrentVersion = {
        id: 'test-manual-react',
        versionNumber: 1
    };

    const handleWidgetChange = (updatedWidgets) => {
        setTestWidgets(updatedWidgets);
    };

    const handleLayoutChange = (layoutName) => {
        setSelectedLayout(layoutName);
    };

    return (
        <div className="manual-react-layout-test">
            {/* Test Controls */}
            <div className="bg-white border-b border-gray-200 p-4">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        Manual React Layout Test
                    </h1>
                    <div className="flex items-center space-x-4">
                        <label className="text-sm font-medium text-gray-700">
                            Layout:
                        </label>
                        <select
                            value={selectedLayout}
                            onChange={(e) => handleLayoutChange(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                        >
                            {getAvailableLayouts().map(layout => (
                                <option key={layout.name} value={layout.name}>
                                    {layout.label} - {layout.description}
                                </option>
                            ))}
                        </select>
                        <div className="text-sm text-gray-500">
                            No backend protocol • Pure React • {testWidgets ? Object.values(testWidgets).flat().length : 0} widgets
                        </div>
                    </div>
                </div>
            </div>

            {/* Layout Renderer */}
            <div className="layout-test-area">
                <ReactLayoutRenderer
                    layoutName={selectedLayout}
                    widgets={testWidgets}
                    onWidgetChange={handleWidgetChange}
                    editable={true}
                    onDirtyChange={(isDirty, reason) => {
                        // Handle dirty state changes
                    }}
                    onOpenWidgetEditor={(widget) => {
                        alert(`Opening editor for: ${widget.name} (${widget.type})`);
                    }}
                    // PageEditor-specific props
                    currentVersion={mockCurrentVersion}
                    pageVersionData={mockPageVersionData}
                    onVersionChange={(action) => {
                        alert(`Version action: ${action}`);
                    }}
                />
            </div>

            {/* Benefits Display */}
            <div className="bg-green-50 border-t border-green-200 p-4">
                <div className="max-w-7xl mx-auto">
                    <h3 className="text-lg font-semibold text-green-800 mb-3">
                        Manual React Layout Benefits
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>No Django templates</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>No backend protocol</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>Pure React components</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>Easy to modify</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>Shared React widgets</span>
                        </div>
                        <div className="flex items-center">
                            <span className="text-green-600 mr-2">✅</span>
                            <span>PageEditor features</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManualReactLayoutTest;
