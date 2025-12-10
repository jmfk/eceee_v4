import React, { useState, useEffect } from 'react'
import { X, Book, FileCode, Palette, Info, Copy, Check } from 'lucide-react'
import { getWidgetQuickReference } from '../../api/widgetQuickReference'
import WidgetParameterReference from './WidgetParameterReference'
import WidgetExamples from './WidgetExamples'

/**
 * Widget Quick Reference Panel
 * 
 * Comprehensive help panel for widgets showing:
 * - Overview (description, features)
 * - Configuration (parameter reference)
 * - Template Parameters (what's available in mustache templates)
 * - Examples (basic + advanced with code)
 * - CSS Variables (theme customization)
 */
const WidgetQuickReference = ({ widgetType, onClose, isOpen }) => {
    const [activeTab, setActiveTab] = useState('overview')
    const [widgetData, setWidgetData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (isOpen && widgetType) {
            loadWidgetData()
        }
    }, [isOpen, widgetType])

    async function loadWidgetData() {
        setLoading(true)
        setError(null)
        try {
            const data = await getWidgetQuickReference(widgetType)
            setWidgetData(data)
        } catch (err) {
            setError('Failed to load widget documentation')
            console.error('Error loading widget data:', err)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Info },
        { id: 'parameters', label: 'Template Parameters', icon: FileCode },
        { id: 'examples', label: 'Examples', icon: Book },
        { id: 'css', label: 'CSS Variables', icon: Palette },
    ]

    return (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-5/6 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                    <div>
                        <div className="text-xl font-semibold text-gray-900" role="heading" aria-level="2">
                            {widgetData?.name || 'Widget'} Quick Reference
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                            {widgetData?.type}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-6 bg-white">
                    {tabs.map(tab => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors
                                    ${activeTab === tab.id
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                                    }
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        )
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-gray-500">Loading...</div>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-red-600">{error}</div>
                        </div>
                    )}

                    {!loading && !error && widgetData && (
                        <>
                            {activeTab === 'overview' && <OverviewTab widgetData={widgetData} />}
                            {activeTab === 'parameters' && (
                                <WidgetParameterReference parameters={widgetData.templateParameters} />
                            )}
                            {activeTab === 'examples' && (
                                <WidgetExamples examples={widgetData.examples} widgetType={widgetType} />
                            )}
                            {activeTab === 'css' && <CSSVariablesTab cssVariables={widgetData.cssVariables} cssScope={widgetData.cssScope} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

/**
 * Overview Tab Component
 */
function OverviewTab({ widgetData }) {
    return (
        <div className="space-y-6">
            {/* Description */}
            <div>
                <div className="text-lg font-semibold text-gray-900 mb-2" role="heading" aria-level="3">Description</div>
                <div className="text-gray-700 leading-relaxed">{widgetData.description}</div>
            </div>

            {/* Category */}
            {widgetData.category && (
                <div>
                    <div className="text-lg font-semibold text-gray-900 mb-2" role="heading" aria-level="3">Category</div>
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                        {widgetData.category}
                    </span>
                </div>
            )}

            {/* Special Features */}
            {widgetData.specialFeatures && (
                <div>
                    <div className="text-lg font-semibold text-gray-900 mb-3" role="heading" aria-level="3">Special Features</div>
                    <div className="grid grid-cols-2 gap-4">
                        {widgetData.specialFeatures.hasSpecialEditor && (
                            <FeatureBadge
                                label="Special Editor"
                                description="Has a custom editor interface"
                                color="purple"
                            />
                        )}
                        {widgetData.specialFeatures.isContainer && (
                            <FeatureBadge
                                label="Container Widget"
                                description="Can contain other widgets in slots"
                                color="green"
                            />
                        )}
                        {widgetData.specialFeatures.supportsComponentStyles && (
                            <FeatureBadge
                                label="Component Styles"
                                description="Supports theme component styles"
                                color="blue"
                            />
                        )}
                        {widgetData.specialFeatures.isDevelopmentOnly && (
                            <FeatureBadge
                                label="Development Only"
                                description="For development and debugging"
                                color="orange"
                            />
                        )}
                    </div>

                    {/* Slot Information */}
                    {widgetData.specialFeatures.isContainer && widgetData.specialFeatures.slots && (
                        <div className="mt-4">
                            <div className="font-medium text-gray-900 mb-2" role="heading" aria-level="4">Available Slots</div>
                            <div className="space-y-2">
                                {Object.entries(widgetData.specialFeatures.slots).map(([slotName, slotDef]) => (
                                    <div key={slotName} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono text-sm font-medium text-gray-900">
                                                {slotName}
                                            </span>
                                            <span className="text-xs text-gray-600">
                                                Max: {slotDef.max_widgets || '∞'}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-600 mt-1">{slotDef.description}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Template Information */}
            <div>
                <div className="text-lg font-semibold text-gray-900 mb-2" role="heading" aria-level="3">Template</div>
                <code className="text-sm bg-gray-100 px-3 py-1 rounded border border-gray-300">
                    {widgetData.templateName}
                </code>
            </div>
        </div>
    )
}

/**
 * Feature Badge Component
 */
function FeatureBadge({ label, description, color }) {
    const colors = {
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        green: 'bg-green-50 text-green-700 border-green-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
        orange: 'bg-orange-50 text-orange-700 border-orange-200',
    }

    return (
        <div className={`p-3 rounded-lg border ${colors[color]}`}>
            <div className="font-medium text-sm">{label}</div>
            <div className="text-xs mt-1 opacity-90">{description}</div>
        </div>
    )
}

/**
 * CSS Variables Tab Component
 */
function CSSVariablesTab({ cssVariables, cssScope }) {
    const [copiedVar, setCopiedVar] = useState(null)

    function copyVariable(varName) {
        navigator.clipboard.writeText(`var(--${varName})`)
        setCopiedVar(varName)
        setTimeout(() => setCopiedVar(null), 2000)
    }

    if (!cssVariables || Object.keys(cssVariables).length === 0) {
        return (
            <div className="text-center text-gray-500 py-12">
                This widget does not define any CSS variables.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-900">
                        <div className="font-medium mb-1">CSS Scope: {cssScope}</div>
                        <div>
                            These CSS variables can be overridden in theme styles to customize the widget appearance.
                            Click any variable to copy the CSS var() function.
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {Object.entries(cssVariables).map(([varName, defaultValue]) => (
                    <div
                        key={varName}
                        className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <code className="text-sm font-mono font-medium text-blue-600">
                                        --{varName}
                                    </code>
                                    <button
                                        onClick={() => copyVariable(varName)}
                                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                                        title="Copy CSS variable"
                                    >
                                        {copiedVar === varName ? (
                                            <Check className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-gray-400" />
                                        )}
                                    </button>
                                </div>
                                <div className="text-sm text-gray-600 mt-1 font-mono">
                                    Default: <span className="text-gray-900">{defaultValue}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default WidgetQuickReference

