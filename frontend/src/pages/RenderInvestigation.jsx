import React, { useEffect, useState } from 'react'
import PerformanceProfiler from '../components/PerformanceProfiler'
import ContentWidget from '../components/widgets/ContentWidget'

/**
 * Render Investigation Page
 * Use this page to test and investigate re-rendering issues
 */

const RenderInvestigation = () => {
    const [config, setConfig] = useState({
        content: '<h2>Test Content</h2><p>This is for testing re-renders.</p>'
    })
    const [updateCounter, setUpdateCounter] = useState(0)

    // Simulate frequent updates to test re-rendering
    useEffect(() => {
        const interval = setInterval(() => {
            setUpdateCounter(prev => prev + 1)
        }, 1000)

        return () => clearInterval(interval)
    }, [])

    const handleConfigChange = (newConfig) => {
        console.log('Config changed:', newConfig)
        setConfig(newConfig)
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Render Investigation Dashboard</h1>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
                <h2 className="text-lg font-semibold mb-2">Investigation Instructions</h2>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Open browser Developer Tools (F12)</li>
                    <li>Go to Console tab</li>
                    <li>Watch for render tracking logs</li>
                    <li>Run <code>renderMonitor.generateReport()</code> in console</li>
                    <li>Check React DevTools Profiler tab</li>
                </ol>
            </div>

            <div className="mb-6 p-4 bg-gray-50 border rounded">
                <p>Update Counter: {updateCounter} (updates every second)</p>
                <p>This should NOT cause ContentWidget to re-render</p>
            </div>

            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold mb-3">ContentWidget in Editor Mode</h3>
                    <PerformanceProfiler id="ContentWidget-Editor">
                        <ContentWidget
                            config={config}
                            mode="editor"
                            onConfigChange={handleConfigChange}
                        />
                    </PerformanceProfiler>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-3">ContentWidget in Preview Mode</h3>
                    <PerformanceProfiler id="ContentWidget-Preview">
                        <ContentWidget
                            config={config}
                            mode="preview"
                        />
                    </PerformanceProfiler>
                </div>
            </div>

            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <h3 className="text-lg font-semibold mb-2">Console Commands</h3>
                <div className="text-sm font-mono space-y-1">
                    <div>renderMonitor.generateReport()</div>
                    <div>renderMonitor.components.get('ContentWidget')</div>
                    <div>Object.keys(renderMonitor.components)</div>
                </div>
            </div>
        </div>
    )
}

export default RenderInvestigation
