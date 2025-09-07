/**
 * HTML Element Style Editor Component
 * 
 * Provides a visual interface for editing HTML element styles in themes.
 * Supports common HTML elements and their CSS properties.
 */

import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { themesApi } from '../api'
import { Plus, Trash2, ChevronDown, ChevronUp, Type, Palette, Layout, Eye } from 'lucide-react'

const HtmlElementStyleEditor = ({ htmlElements = {}, onChange, showPreview = false }) => {
    const [expandedElements, setExpandedElements] = useState(new Set(['h1', 'p']))
    const [selectedElement, setSelectedElement] = useState('')

    // Fetch HTML elements schema
    const { data: schema } = useQuery({
        queryKey: ['theme-html-elements-schema'],
        queryFn: () => themesApi.getHtmlElementsSchema(),
        staleTime: 10 * 60 * 1000, // 10 minutes
    })

    const supportedElements = schema?.supported_elements || [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'div', 'span',
        'a', 'a:hover', 'a:focus', 'a:active',
        'ul', 'ol', 'li',
        'blockquote',
        'code', 'pre',
        'strong', 'em', 'small',
        'hr',
        'table', 'th', 'td', 'tr'
    ]

    const commonProperties = schema?.common_properties || [
        'color', 'background-color', 'background',
        'font-size', 'font-weight', 'font-family', 'font-style',
        'line-height', 'letter-spacing',
        'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
        'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
        'border', 'border-top', 'border-bottom', 'border-left', 'border-right',
        'border-radius', 'border-color', 'border-width', 'border-style',
        'text-align', 'text-decoration', 'text-transform',
        'display', 'position', 'width', 'height', 'max-width', 'min-width',
        'transition', 'transform', 'opacity', 'box-shadow'
    ]

    const elementCategories = {
        'Headings': ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        'Text': ['p', 'div', 'span', 'strong', 'em', 'small'],
        'Links': ['a', 'a:hover', 'a:focus', 'a:active'],
        'Lists': ['ul', 'ol', 'li'],
        'Code': ['code', 'pre'],
        'Other': ['blockquote', 'hr', 'table', 'th', 'td', 'tr']
    }

    const toggleElement = (element) => {
        const newExpanded = new Set(expandedElements)
        if (newExpanded.has(element)) {
            newExpanded.delete(element)
        } else {
            newExpanded.add(element)
        }
        setExpandedElements(newExpanded)
    }

    const addElement = () => {
        if (selectedElement && !htmlElements[selectedElement]) {
            onChange({
                ...htmlElements,
                [selectedElement]: {}
            })
            setExpandedElements(new Set([...expandedElements, selectedElement]))
            setSelectedElement('')
        }
    }

    const removeElement = (element) => {
        const newElements = { ...htmlElements }
        delete newElements[element]
        onChange(newElements)

        const newExpanded = new Set(expandedElements)
        newExpanded.delete(element)
        setExpandedElements(newExpanded)
    }

    const updateElementStyle = (element, property, value) => {
        const currentStyles = htmlElements[element] || {}
        const newStyles = value ?
            { ...currentStyles, [property]: value } :
            Object.fromEntries(Object.entries(currentStyles).filter(([key]) => key !== property))

        onChange({
            ...htmlElements,
            [element]: newStyles
        })
    }

    const addProperty = (element, property, value) => {
        if (property && value) {
            updateElementStyle(element, property, value)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">HTML Element Styles</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Define custom styles for HTML elements like headings, paragraphs, links, and lists
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                        {Object.keys(htmlElements).length} elements styled
                    </span>
                </div>
            </div>

            {/* Add Element */}
            <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                    <select
                        value={selectedElement}
                        onChange={(e) => setSelectedElement(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="">Select an HTML element to style...</option>
                        {Object.entries(elementCategories).map(([category, elements]) => (
                            <optgroup key={category} label={category}>
                                {elements
                                    .filter(element => supportedElements.includes(element))
                                    .filter(element => !htmlElements[element])
                                    .map(element => (
                                        <option key={element} value={element}>
                                            {element}
                                        </option>
                                    ))
                                }
                            </optgroup>
                        ))}
                    </select>
                    <button
                        onClick={addElement}
                        disabled={!selectedElement}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Elements List */}
            <div className="space-y-4">
                {Object.entries(htmlElements).map(([element, styles]) => (
                    <div key={element} className="border border-gray-200 rounded-lg">
                        {/* Element Header */}
                        <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                            onClick={() => toggleElement(element)}
                        >
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                    {expandedElements.has(element) ?
                                        <ChevronUp className="w-4 h-4 text-gray-500" /> :
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                    }
                                    <Type className="w-4 h-4 text-purple-600" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-900">
                                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">{element}</code>
                                    </h4>
                                    <p className="text-sm text-gray-500">
                                        {Object.keys(styles).length} {Object.keys(styles).length === 1 ? 'property' : 'properties'} defined
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    removeElement(element)
                                }}
                                className="text-red-600 hover:text-red-700"
                                title="Remove element styles"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Element Styles */}
                        {expandedElements.has(element) && (
                            <div className="border-t border-gray-200 p-4 bg-gray-50">
                                <StylePropertiesEditor
                                    element={element}
                                    styles={styles}
                                    commonProperties={commonProperties}
                                    onUpdateStyle={(property, value) => updateElementStyle(element, property, value)}
                                    onAddProperty={(property, value) => addProperty(element, property, value)}
                                />
                            </div>
                        )}
                    </div>
                ))}

                {Object.keys(htmlElements).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        <Type className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No HTML Elements Styled</h3>
                        <p className="text-gray-500">
                            Add HTML elements above to define custom styles for your theme
                        </p>
                    </div>
                )}
            </div>

            {/* Preview */}
            {showPreview && Object.keys(htmlElements).length > 0 && (
                <div className="border-t pt-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">HTML Elements Preview</h4>
                    <HtmlElementsPreview htmlElements={htmlElements} />
                </div>
            )}
        </div>
    )
}

// Style Properties Editor Component
const StylePropertiesEditor = ({ element, styles, commonProperties, onUpdateStyle, onAddProperty }) => {
    const [newProperty, setNewProperty] = useState('')
    const [newValue, setNewValue] = useState('')

    const handleAddProperty = () => {
        if (newProperty && newValue) {
            onAddProperty(newProperty, newValue)
            setNewProperty('')
            setNewValue('')
        }
    }

    const handleRemoveProperty = (property) => {
        onUpdateStyle(property, '')
    }

    const isColorProperty = (property) => {
        return property.includes('color') || property === 'background'
    }

    const isNumericProperty = (property) => {
        return ['font-size', 'line-height', 'margin', 'padding', 'border-width', 'width', 'height'].some(p => property.includes(p))
    }

    return (
        <div className="space-y-4">
            {/* Existing Properties */}
            <div className="space-y-3">
                {Object.entries(styles).map(([property, value]) => (
                    <div key={property} className="flex items-center space-x-3">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {property}
                            </label>
                            <div className="flex items-center space-x-2">
                                {isColorProperty(property) && (
                                    <input
                                        type="color"
                                        value={typeof value === 'string' && value.startsWith('#') ? value : '#000000'}
                                        onChange={(e) => onUpdateStyle(property, e.target.value)}
                                        className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                                    />
                                )}
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => onUpdateStyle(property, e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-mono"
                                    placeholder={isNumericProperty(property) ? "e.g., 16px, 1.5rem" : "CSS value"}
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => handleRemoveProperty(property)}
                            className="text-red-600 hover:text-red-700 mt-6"
                            title="Remove property"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Add New Property */}
            <div className="border-t pt-4">
                <div className="flex items-end space-x-3">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Add CSS Property
                        </label>
                        <select
                            value={newProperty}
                            onChange={(e) => setNewProperty(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="">Select property...</option>
                            {commonProperties
                                .filter(prop => !styles[prop])
                                .map(prop => (
                                    <option key={prop} value={prop}>{prop}</option>
                                ))
                            }
                            <option value="custom">Custom property...</option>
                        </select>
                        {newProperty === 'custom' && (
                            <input
                                type="text"
                                placeholder="Enter custom CSS property"
                                value={newProperty === 'custom' ? '' : newProperty}
                                onChange={(e) => setNewProperty(e.target.value)}
                                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        )}
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Value
                        </label>
                        <input
                            type="text"
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="CSS value"
                        />
                    </div>
                    <button
                        onClick={handleAddProperty}
                        disabled={!newProperty || !newValue}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}

// HTML Elements Preview Component
const HtmlElementsPreview = ({ htmlElements }) => {
    // Generate CSS from htmlElements
    const generatePreviewCSS = () => {
        let css = ''
        Object.entries(htmlElements).forEach(([element, styles]) => {
            css += `.theme-preview ${element} {\n`
            Object.entries(styles).forEach(([property, value]) => {
                css += `  ${property}: ${value};\n`
            })
            css += '}\n\n'
        })
        return css
    }

    useEffect(() => {
        // Inject preview CSS
        const styleId = 'html-elements-preview-styles'
        let styleElement = document.getElementById(styleId)

        if (!styleElement) {
            styleElement = document.createElement('style')
            styleElement.id = styleId
            document.head.appendChild(styleElement)
        }

        styleElement.textContent = generatePreviewCSS()

        return () => {
            // Cleanup on unmount
            const element = document.getElementById(styleId)
            if (element) {
                element.remove()
            }
        }
    }, [htmlElements])

    return (
        <div className="theme-preview border rounded-lg p-6 bg-white">
            <h1>Sample Heading 1</h1>
            <h2>Sample Heading 2</h2>
            <h3>Sample Heading 3</h3>
            <p>This is a sample paragraph with some <a href="#">linked text</a> to demonstrate how the theme styles different HTML elements. This paragraph contains <strong>bold text</strong>, <em>italic text</em>, and <small>small text</small>.</p>

            <ul>
                <li>First list item</li>
                <li>Second list item with more content</li>
                <li>Third list item</li>
            </ul>

            <ol>
                <li>First numbered item</li>
                <li>Second numbered item</li>
                <li>Third numbered item</li>
            </ol>

            <blockquote>
                This is a sample blockquote to demonstrate quote styling in the theme.
            </blockquote>

            <p>Here's some <code>inline code</code> and a code block:</p>
            <pre><code>{`function example() {
    return "Hello, World!";
}`}</code></pre>

            <hr />

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tr>
                    <th>Header 1</th>
                    <th>Header 2</th>
                    <th>Header 3</th>
                </tr>
                <tr>
                    <td>Cell 1</td>
                    <td>Cell 2</td>
                    <td>Cell 3</td>
                </tr>
            </table>
        </div>
    )
}

export default HtmlElementStyleEditor
