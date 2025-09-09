/**
 * Debug Layout Test - Minimal test to verify SimplifiedLayoutRenderer
 * 
 * This component tests the most basic functionality to identify why
 * the layout isn't showing anything.
 */

import React, { useRef, useEffect } from 'react';
import SimplifiedLayoutRenderer from './SimplifiedLayoutRenderer';

const DebugLayoutTest = () => {
    const containerRef = useRef(null);

    // Minimal test layout
    const minimalLayout = {
        name: 'debug_test',
        label: 'Debug Test Layout',
        description: 'Minimal layout for debugging',
        version: '2.0',
        type: 'flexbox',
        structure: {
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '2rem',
            backgroundColor: '#ffffff',
            border: '2px solid #3b82f6',
            borderRadius: '0.5rem',
            minHeight: '300px'
        },
        slots: [
            {
                name: 'debug',
                label: 'Debug Slot',
                description: 'Test slot for debugging',
                required: true,
                maxWidgets: 5,
                allowedWidgetTypes: ['*'],
                className: 'debug-slot',
                style: {
                    backgroundColor: '#fef3c7',
                    padding: '1rem',
                    border: '1px solid #f59e0b',
                    borderRadius: '0.25rem',
                    minHeight: '100px'
                }
            }
        ],
        css: {
            framework: 'tailwind',
            customClasses: ['debug-layout']
        }
    };

    // Test widgets
    const testWidgets = {
        debug: [
            {
                id: 'debug-widget-1',
                type: 'core_widgets.ContentWidget',
                name: 'Debug Widget',
                config: {
                    title: 'Debug Test Widget',
                    content: 'If you can see this, the SimplifiedLayoutRenderer is working!',
                    style: 'card'
                },
                slotName: 'debug'
            }
        ]
    };

    useEffect(() => {
        if (!containerRef.current) return;

        const testRender = async () => {
            console.log('DebugLayoutTest: Starting render test');
            console.log('DebugLayoutTest: Container:', containerRef.current);
            console.log('DebugLayoutTest: Layout:', minimalLayout);
            console.log('DebugLayoutTest: Widgets:', testWidgets);

            try {
                // Create renderer
                const renderer = new SimplifiedLayoutRenderer({ editable: true });
                console.log('DebugLayoutTest: Renderer created');

                // Load widget data
                renderer.loadWidgetData(testWidgets);
                console.log('DebugLayoutTest: Widget data loaded');

                // Render layout
                await renderer.render(minimalLayout, containerRef);
                console.log('DebugLayoutTest: Render completed');

            } catch (error) {
                console.error('DebugLayoutTest: Render failed:', error);

                // Show error in container
                if (containerRef.current) {
                    containerRef.current.innerHTML = `
                        <div style="padding: 2rem; background: #fef2f2; border: 2px solid #dc2626; border-radius: 0.5rem;">
                            <h3 style="color: #dc2626; margin-bottom: 1rem;">Debug Test Failed</h3>
                            <p style="color: #7f1d1d; font-size: 0.875rem;">${error.message}</p>
                            <pre style="background: #ffffff; padding: 1rem; border-radius: 0.25rem; margin-top: 1rem; overflow: auto; font-size: 0.75rem;">${error.stack}</pre>
                        </div>
                    `;
                }
            }
        };

        testRender();
    }, []);

    return (
        <div className="p-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">
                    Debug Layout Test
                </h1>

                <div className="mb-4">
                    <p className="text-gray-600">
                        This is a minimal test to debug the SimplifiedLayoutRenderer.
                        Check the console for detailed logs.
                    </p>
                </div>

                {/* Test Container */}
                <div
                    ref={containerRef}
                    className="border-2 border-dashed border-gray-300 rounded-lg"
                    style={{ minHeight: '400px', padding: '1rem' }}
                >
                    <div className="text-center text-gray-500 py-8">
                        <p>Loading debug test...</p>
                        <p className="text-sm mt-2">Check console for logs</p>
                    </div>
                </div>

                {/* Layout JSON Display */}
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">Test Layout JSON</h3>
                    <pre className="bg-gray-50 rounded p-4 text-xs overflow-auto max-h-64">
                        {JSON.stringify(minimalLayout, null, 2)}
                    </pre>
                </div>

                {/* Test Widgets Display */}
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">Test Widgets</h3>
                    <pre className="bg-gray-50 rounded p-4 text-xs overflow-auto max-h-32">
                        {JSON.stringify(testWidgets, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default DebugLayoutTest;
