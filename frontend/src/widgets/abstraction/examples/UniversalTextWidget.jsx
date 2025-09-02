/**
 * Universal Text Widget Example
 * 
 * Demonstrates how a widget can work seamlessly in both page and object
 * contexts using the abstraction layer, without requiring knowledge of
 * which editor it's in.
 */

import React, { useState, useEffect } from 'react'
import { useWidgetContext, useWidgetOperations } from '../components/WidgetHost'

/**
 * Universal Text Widget - Works in any context
 * 
 * This widget demonstrates the power of the abstraction layer:
 * - No if/else statements for different contexts
 * - Same component works in pages and objects
 * - Context-specific behavior handled by abstraction layer
 * - Clean, maintainable code
 */
export function UniversalTextWidget({
    widget,
    slotId,
    onConfigChange,
    editable = true,
    className = ''
}) {
    const context = useWidgetContext()
    const operations = useWidgetOperations(slotId)

    const [localConfig, setLocalConfig] = useState(widget.config || {})
    const [isEditing, setIsEditing] = useState(false)
    const [validationResult, setValidationResult] = useState(null)

    // Sync local config with widget changes
    useEffect(() => {
        setLocalConfig(widget.config || {})
    }, [widget.config])

    // Validate configuration when it changes
    useEffect(() => {
        if (widget && localConfig) {
            const validation = context.validateWidget({
                ...widget,
                config: localConfig
            })
            setValidationResult(validation)
        }
    }, [widget, localConfig, context])

    /**
     * Handle configuration changes
     * The abstraction layer handles context-specific differences
     */
    const handleConfigChange = async (newConfig) => {
        setLocalConfig(newConfig)

        // Update through context (handles page vs object differences automatically)
        const result = await context.updateWidget(widget.id, newConfig)

        if (result.success) {
            // Notify parent component if needed
            onConfigChange?.(newConfig)
        } else {
            console.error('Failed to update widget:', result.error)
        }
    }

    /**
     * Handle text content change
     */
    const handleTextChange = (newText) => {
        const newConfig = {
            ...localConfig,
            content: newText
        }
        handleConfigChange(newConfig)
    }

    /**
     * Handle style changes
     */
    const handleStyleChange = (styleProperty, value) => {
        const newConfig = {
            ...localConfig,
            [styleProperty]: value
        }
        handleConfigChange(newConfig)
    }

    /**
     * Toggle edit mode
     */
    const toggleEdit = () => {
        if (operations.isEditable) {
            setIsEditing(!isEditing)
        }
    }

    /**
     * Render the widget content
     * The same rendering works in both contexts
     */
    const renderContent = () => {
        const {
            content = 'Enter text here...',
            fontSize = 16,
            color = '#000000',
            fontFamily = 'Arial, sans-serif',
            fontWeight = 'normal',
            textAlign = 'left'
        } = localConfig

        const textStyle = {
            fontSize: `${fontSize}px`,
            color,
            fontFamily,
            fontWeight,
            textAlign,
            minHeight: '1.5em',
            padding: '8px',
            border: isEditing ? '2px solid #007cba' : '1px solid transparent',
            borderRadius: '4px',
            outline: 'none',
            width: '100%',
            backgroundColor: isEditing ? '#f9f9f9' : 'transparent'
        }

        if (isEditing) {
            return (
                <textarea
                    value={content}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onBlur={() => setIsEditing(false)}
                    style={textStyle}
                    placeholder="Enter text here..."
                    autoFocus
                />
            )
        }

        return (
            <div
                style={textStyle}
                onClick={toggleEdit}
                role={operations.isEditable ? 'button' : 'text'}
                tabIndex={operations.isEditable ? 0 : -1}
                onKeyPress={(e) => {
                    if (e.key === 'Enter' && operations.isEditable) {
                        toggleEdit()
                    }
                }}
            >
                {content || <span style={{ opacity: 0.5 }}>Click to edit text</span>}
            </div>
        )
    }

    /**
     * Render editor controls
     * Context determines what controls are available
     */
    const renderControls = () => {
        if (!operations.isEditable || !isEditing) return null

        const {
            fontSize = 16,
            color = '#000000',
            fontFamily = 'Arial, sans-serif',
            fontWeight = 'normal',
            textAlign = 'left'
        } = localConfig

        // Get available options based on context
        // Object context might have more restrictions than page context
        const fontSizeRange = context.type === 'object'
            ? { min: 8, max: 48 }   // More restrictive for objects
            : { min: 8, max: 72 }   // More flexible for pages

        const availableFonts = context.type === 'object'
            ? ['Arial, sans-serif', 'Georgia, serif', 'monospace'] // Limited for objects
            : ['Arial, sans-serif', 'Georgia, serif', 'Times New Roman, serif', 'monospace', 'Helvetica, sans-serif'] // More options for pages

        return (
            <div className="widget-controls p-3 bg-gray-50 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <label className="block text-gray-700 mb-1">Font Size</label>
                        <input
                            type="range"
                            min={fontSizeRange.min}
                            max={fontSizeRange.max}
                            value={fontSize}
                            onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
                            className="w-full"
                        />
                        <span className="text-xs text-gray-500">{fontSize}px</span>
                    </div>

                    <div>
                        <label className="block text-gray-700 mb-1">Color</label>
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => handleStyleChange('color', e.target.value)}
                            className="w-full h-8 rounded border border-gray-300"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 mb-1">Font Family</label>
                        <select
                            value={fontFamily}
                            onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                            className="w-full p-1 border border-gray-300 rounded"
                        >
                            {availableFonts.map(font => (
                                <option key={font} value={font}>
                                    {font.split(',')[0]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-gray-700 mb-1">Text Align</label>
                        <select
                            value={textAlign}
                            onChange={(e) => handleStyleChange('textAlign', e.target.value)}
                            className="w-full p-1 border border-gray-300 rounded"
                        >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                            <option value="justify">Justify</option>
                        </select>
                    </div>
                </div>

                {/* Context-specific information */}
                <div className="mt-3 p-2 bg-blue-50 rounded text-xs">
                    <div className="flex justify-between items-center">
                        <span className="text-blue-700">
                            Context: <strong>{context.type}</strong>
                        </span>
                        <span className="text-blue-600">
                            {context.type === 'object' ? 'Restricted Mode' : 'Full Mode'}
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    /**
     * Render validation messages
     */
    const renderValidation = () => {
        if (!validationResult || validationResult.isValid) return null

        return (
            <div className="widget-validation p-2 bg-red-50 border border-red-200 rounded">
                {validationResult.errors.map((error, index) => (
                    <div key={index} className="text-red-700 text-sm">
                        ⚠️ {error}
                    </div>
                ))}
                {validationResult.warnings.map((warning, index) => (
                    <div key={index} className="text-yellow-700 text-sm">
                        ⚡ {warning}
                    </div>
                ))}
            </div>
        )
    }

    /**
     * Render context indicator for development
     */
    const renderContextIndicator = () => {
        if (process.env.NODE_ENV !== 'development') return null

        const metadata = context.getMetadata()

        return (
            <div className="widget-debug absolute top-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 rounded-bl">
                {context.type} | {metadata.slotCount} slots | {metadata.totalWidgets} widgets
            </div>
        )
    }

    return (
        <div className={`universal-text-widget relative ${className}`}>
            {renderContextIndicator()}

            <div className="widget-content">
                {renderContent()}
            </div>

            {renderControls()}
            {renderValidation()}

            {/* Widget metadata - same structure regardless of context */}
            <div className="widget-metadata text-xs text-gray-500 p-2 border-t">
                <div className="flex justify-between">
                    <span>ID: {widget.id}</span>
                    <span>Type: {widget.type}</span>
                    <span>Updated: {new Date(widget.updatedAt).toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    )
}

/**
 * Example usage in different contexts
 */
export const TextWidgetExamples = {
    /**
     * Usage in Page Context
     */
    PageExample: () => (
        <div className="example-container">
            <h3>Page Context Example</h3>
            <p>This widget will automatically adapt to page-specific behavior:</p>
            <ul>
                <li>Supports inheritance from templates</li>
                <li>More flexible font size range (8-72px)</li>
                <li>More font family options</li>
                <li>Can override inherited configurations</li>
            </ul>

            {/* The widget automatically detects it's in a page context */}
            <UniversalTextWidget
                widget={{
                    id: 'text-widget-1',
                    type: 'text-block',
                    config: {
                        content: 'This is a page text widget',
                        fontSize: 18,
                        color: '#333333'
                    },
                    updatedAt: new Date().toISOString()
                }}
                slotId="main-content"
                editable={true}
            />
        </div>
    ),

    /**
     * Usage in Object Context
     */
    ObjectExample: () => (
        <div className="example-container">
            <h3>Object Context Example</h3>
            <p>The same widget in object context:</p>
            <ul>
                <li>Follows object type restrictions</li>
                <li>Limited font size range (8-48px)</li>
                <li>Fewer font family options</li>
                <li>Tied to specific widget control</li>
            </ul>

            {/* The widget automatically detects it's in an object context */}
            <UniversalTextWidget
                widget={{
                    id: 'text-widget-2',
                    type: 'text-block',
                    config: {
                        content: 'This is an object text widget',
                        fontSize: 16,
                        color: '#000000'
                    },
                    controlId: 'title-control',
                    updatedAt: new Date().toISOString()
                }}
                slotId="title-slot"
                editable={true}
            />
        </div>
    )
}

export default UniversalTextWidget
