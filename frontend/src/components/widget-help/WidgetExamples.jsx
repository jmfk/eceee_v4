import React, { useState } from 'react'
import { Copy, Check, FileCode, Sparkles } from 'lucide-react'

/**
 * Widget Examples Component
 * 
 * Displays basic and advanced configuration examples for widgets
 * with syntax highlighting and copy-to-clipboard functionality
 */
const WidgetExamples = ({ examples, widgetType, onApplyExample }) => {
    const [activeExample, setActiveExample] = useState('basic')
    const [copiedExample, setCopiedExample] = useState(null)

    if (!examples || (!examples.basic && !examples.advanced)) {
        return (
            <div className="text-center text-gray-500 py-12">
                No examples available for this widget yet.
            </div>
        )
    }

    function copyExample(exampleType) {
        const example = examples[exampleType]
        if (!example) return

        const config = JSON.stringify(example.config, null, 2)
        navigator.clipboard.writeText(config)
        setCopiedExample(exampleType)
        setTimeout(() => setCopiedExample(null), 2000)
    }

    function applyExample(exampleType) {
        const example = examples[exampleType]
        if (!example || !onApplyExample) return

        onApplyExample(example.config)
    }

    const hasBasic = examples.basic && Object.keys(examples.basic).length > 0
    const hasAdvanced = examples.advanced && Object.keys(examples.advanced).length > 0

    return (
        <div className="space-y-6">
            {/* Info Banner */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                    <FileCode className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-900">
                        <p className="font-medium mb-1">Configuration Examples</p>
                        <p>
                            These examples show common widget configurations. All examples use camelCase
                            for field names as expected by the frontend API.
                        </p>
                    </div>
                </div>
            </div>

            {/* Example Type Selector */}
            {hasBasic && hasAdvanced && (
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveExample('basic')}
                        className={`
                            flex-1 px-4 py-3 rounded-lg font-medium transition-colors border-2
                            ${activeExample === 'basic'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                            }
                        `}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <FileCode className="w-4 h-4" />
                            Basic Example
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveExample('advanced')}
                        className={`
                            flex-1 px-4 py-3 rounded-lg font-medium transition-colors border-2
                            ${activeExample === 'advanced'
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                            }
                        `}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            Advanced Example
                        </div>
                    </button>
                </div>
            )}

            {/* Example Display */}
            {hasBasic && activeExample === 'basic' && (
                <ExampleCard
                    title="Basic Example"
                    description={examples.basic.description}
                    config={examples.basic.config}
                    exampleType="basic"
                    isCopied={copiedExample === 'basic'}
                    onCopy={() => copyExample('basic')}
                    onApply={onApplyExample ? () => applyExample('basic') : null}
                    color="blue"
                />
            )}

            {hasAdvanced && activeExample === 'advanced' && (
                <ExampleCard
                    title="Advanced Example"
                    description={examples.advanced.description}
                    config={examples.advanced.config}
                    exampleType="advanced"
                    isCopied={copiedExample === 'advanced'}
                    onCopy={() => copyExample('advanced')}
                    onApply={onApplyExample ? () => applyExample('advanced') : null}
                    color="purple"
                />
            )}
        </div>
    )
}

/**
 * Example Card Component
 */
function ExampleCard({ title, description, config, exampleType, isCopied, onCopy, onApply, color }) {
    const colors = {
        blue: {
            border: 'border-blue-200',
            bg: 'bg-blue-50',
            text: 'text-blue-900',
            button: 'bg-blue-600 hover:bg-blue-700'
        },
        purple: {
            border: 'border-purple-200',
            bg: 'bg-purple-50',
            text: 'text-purple-900',
            button: 'bg-purple-600 hover:bg-purple-700'
        }
    }

    const colorScheme = colors[color]

    return (
        <div className={`border rounded-lg ${colorScheme.border}`}>
            {/* Header */}
            <div className={`p-4 ${colorScheme.bg} rounded-t-lg border-b ${colorScheme.border}`}>
                <h3 className={`font-semibold ${colorScheme.text}`}>{title}</h3>
                {description && (
                    <p className={`text-sm mt-1 ${colorScheme.text} opacity-90`}>
                        {description}
                    </p>
                )}
            </div>

            {/* Code Display */}
            <div className="bg-gray-900 text-gray-100 p-4 font-mono text-sm overflow-x-auto">
                <pre className="whitespace-pre-wrap break-words">
                    <code>{JSON.stringify(config, null, 2)}</code>
                </pre>
            </div>

            {/* Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex items-center justify-between gap-3">
                <div className="text-xs text-gray-600">
                    Configuration in camelCase for frontend use
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onCopy}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium"
                    >
                        {isCopied ? (
                            <>
                                <Check className="w-4 h-4 text-green-600" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="w-4 h-4" />
                                Copy
                            </>
                        )}
                    </button>
                    {onApply && (
                        <button
                            onClick={onApply}
                            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors font-medium ${colorScheme.button}`}
                        >
                            <Sparkles className="w-4 h-4" />
                            Use This Example
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default WidgetExamples

