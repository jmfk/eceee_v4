/**
 * Self-Contained Form Demo
 * 
 * Demonstration component showing the self-contained widget form in action.
 * This can be used for testing and showcasing the new form system.
 */

import React, { useState, useRef } from 'react'
import { Play, Settings, Eye, Save } from 'lucide-react'
import SelfContainedWidgetEditor from '../forms/SelfContainedWidgetEditor.jsx'

// Mock widget data for testing
const mockWidgets = {
    textWidget: {
        id: 'demo-text-widget',
        type: 'easy_widgets.TextWidget',
        name: 'Text Widget',
        slotName: 'demo-slot',
        config: {
            text: 'Hello World!',
            fontSize: 16,
            color: '#000000',
            bold: false,
            italic: false,
            alignment: 'left'
        }
    },
    imageWidget: {
        id: 'demo-image-widget',
        type: 'easy_widgets.ImageWidget',
        name: 'Image Widget',
        slotName: 'demo-slot',
        config: {
            src: 'https://via.placeholder.com/300x200',
            alt: 'Demo Image',
            width: 300,
            height: 200,
            objectFit: 'cover'
        }
    },
    buttonWidget: {
        id: 'demo-button-widget',
        type: 'easy_widgets.ButtonWidget',
        name: 'Button Widget',
        slotName: 'demo-slot',
        config: {
            text: 'Click Me',
            url: '#',
            style: 'primary',
            size: 'medium',
            disabled: false
        }
    }
}

const SelfContainedFormDemo = () => {
    const [selectedWidget, setSelectedWidget] = useState('textWidget')
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const [widgetStates, setWidgetStates] = useState(mockWidgets)
    const [realTimeUpdates, setRealTimeUpdates] = useState([])
    const [showRegistry, setShowRegistry] = useState(false)
    const [autoSave, setAutoSave] = useState(true)

    const editorRef = useRef()

    // Handle real-time updates from the form
    const handleRealTimeUpdate = (updatedWidget) => {
        console.log('Real-time update received:', updatedWidget)

        // Update the widget state
        setWidgetStates(prev => ({
            ...prev,
            [selectedWidget]: updatedWidget
        }))

        // Add to real-time updates log
        setRealTimeUpdates(prev => [
            ...prev.slice(-9), // Keep last 10 updates
            {
                timestamp: new Date().toLocaleTimeString(),
                widget: updatedWidget.name,
                config: { ...updatedWidget.config }
            }
        ])
    }

    // Handle unsaved changes notification
    const handleUnsavedChanges = (hasChanges) => {
        console.log('Unsaved changes:', hasChanges)
    }

    // Handle save
    const handleSave = (savedWidget) => {
        console.log('Widget saved:', savedWidget)
        setWidgetStates(prev => ({
            ...prev,
            [selectedWidget]: savedWidget
        }))
    }

    // Get registry state
    const getRegistryState = () => {
        if (typeof window !== 'undefined' && window.widgetRegistry) {
            return window.widgetRegistry.getAllWidgetStates()
        }
        return {}
    }

    const currentWidget = widgetStates[selectedWidget]

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Settings className="w-6 h-6 text-blue-600" />
                        Self-Contained Widget Form Demo
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Demonstration of the new self-contained widget form with real-time updates and zero React rerenders.
                    </p>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Widget Selection */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900">Select Widget</h3>
                            <div className="space-y-2">
                                {Object.entries(mockWidgets).map(([key, widget]) => (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedWidget(key)}
                                        className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedWidget === key
                                            ? 'border-blue-500 bg-blue-50 text-blue-900'
                                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                            }`}
                                    >
                                        <div className="font-medium">{widget.name}</div>
                                        <div className="text-sm opacity-75">{widget.type}</div>
                                    </button>
                                ))}
                            </div>

                            {/* Settings */}
                            <div className="pt-4 border-t border-gray-200">
                                <h4 className="font-medium text-gray-900 mb-2">Settings</h4>
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={autoSave}
                                        onChange={(e) => setAutoSave(e.target.checked)}
                                        className="rounded border-gray-300"
                                    />
                                    <span className="text-sm text-gray-700">Auto-save enabled</span>
                                </label>
                            </div>
                        </div>

                        {/* Current Widget State */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900">Current State</h3>
                                <button
                                    onClick={() => setIsEditorOpen(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Settings className="w-4 h-4" />
                                    Edit Widget
                                </button>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="font-medium">Widget:</span>
                                        <span className="text-gray-600">{currentWidget.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-medium">Type:</span>
                                        <span className="text-gray-600 text-sm">{currentWidget.type}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-medium">Slot:</span>
                                        <span className="text-gray-600">{currentWidget.slotName}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-medium text-gray-900">Configuration</h4>
                                <pre className="bg-gray-100 rounded-lg p-3 text-sm overflow-auto max-h-40">
                                    {JSON.stringify(currentWidget.config, null, 2)}
                                </pre>
                            </div>
                        </div>

                        {/* Real-time Updates Log */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900">Real-time Updates</h3>
                                <button
                                    onClick={() => setRealTimeUpdates([])}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Clear
                                </button>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                                {realTimeUpdates.length === 0 ? (
                                    <p className="text-gray-500 text-sm">No updates yet. Open the editor and make changes.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {realTimeUpdates.map((update, index) => (
                                            <div key={index} className="bg-white rounded p-2 border border-gray-200">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {update.widget}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {update.timestamp}
                                                    </span>
                                                </div>
                                                <pre className="text-xs text-gray-600 mt-1 overflow-auto">
                                                    {JSON.stringify(update.config, null, 2)}
                                                </pre>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Registry State */}
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Widget Registry State</h3>
                            <button
                                onClick={() => setShowRegistry(!showRegistry)}
                                className="text-sm text-blue-600 hover:text-blue-800"
                            >
                                {showRegistry ? 'Hide' : 'Show'} Registry
                            </button>
                        </div>

                        {showRegistry && (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <pre className="text-sm overflow-auto max-h-48">
                                    {JSON.stringify(getRegistryState(), null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Self-Contained Widget Editor */}
            <SelfContainedWidgetEditor
                ref={editorRef}
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                onSave={handleSave}
                onRealTimeUpdate={handleRealTimeUpdate}
                onUnsavedChanges={handleUnsavedChanges}
                widgetData={currentWidget}
                title={`Edit ${currentWidget.name}`}
                autoSave={autoSave}
                showValidationInline={true}
                showSaveStatus={true}
            />
        </div>
    )
}

export default SelfContainedFormDemo
