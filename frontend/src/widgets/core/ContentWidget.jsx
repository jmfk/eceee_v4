/**
 * ContentWidget - Core shared widget implementation
 * 
 * This is the shared implementation that can be used by both PageEditor and ObjectEditor.
 * Framework-specific behaviors are handled by the editor frameworks, not here.
 */
import React, { useState, useEffect, useRef } from 'react'
import { FileText, Type, AlignLeft } from 'lucide-react'

/**
 * Clean up HTML content by removing unsupported tags and attributes
 */
const cleanHTML = (html) => {
    const tempDiv = document.createElement('p')
    tempDiv.innerHTML = html

    // Remove unsupported tags
    const unsupportedTags = ['script', 'style', 'link', 'meta', 'iframe', 'embed', 'object', 'img', 'video', 'audio', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'form', 'input', 'button', 'select', 'textarea']
    unsupportedTags.forEach(tag => {
        const elements = tempDiv.querySelectorAll(tag)
        elements.forEach(el => el.remove())
    })

    // Remove all attributes except basic ones
    const allowedAttributes = ['href']
    const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_ELEMENT)
    const elements = []
    let node
    while (node = walker.nextNode()) {
        elements.push(node)
    }

    elements.forEach(el => {
        const attrs = Array.from(el.attributes)
        attrs.forEach(attr => {
            if (!allowedAttributes.includes(attr.name)) {
                el.removeAttribute(attr.name)
            }
        })
    })

    return tempDiv.innerHTML
}

/**
 * ContentWidget Component - Shared Implementation
 * 
 * This component provides the core functionality for text content widgets.
 * It's designed to be framework-agnostic and reusable across different editors.
 */
const ContentWidget = ({
    config = {},
    mode = 'preview',
    onConfigChange,
    themeId,
    widgetId,
    slotName,
    widgetType
}) => {
    // Extract configuration with defaults
    const {
        title = '',
        content = 'Click to edit content...',
        titleTag = 'h3',
        showTitle = true,
        alignment = 'left',
        style = 'normal',
        customCss = '',
        template = 'default'
    } = config

    // State for editor mode
    const [isEditing, setIsEditing] = useState(false)
    const [editTitle, setEditTitle] = useState(title)
    const [editContent, setEditContent] = useState(content)
    const editorRef = useRef(null)

    // Handle configuration changes
    const handleConfigChange = (newConfig) => {
        if (onConfigChange && typeof onConfigChange === 'function') {
            onConfigChange(newConfig)
        }
    }

    // Handle edit mode toggle
    const handleEditToggle = () => {
        if (mode === 'editor') {
            setIsEditing(!isEditing)
            if (!isEditing) {
                setEditTitle(title)
                setEditContent(content)
            }
        }
    }

    // Handle save changes
    const handleSave = () => {
        handleConfigChange({
            ...config,
            title: editTitle,
            content: editContent
        })
        setIsEditing(false)
    }

    // Handle cancel changes
    const handleCancel = () => {
        setEditTitle(title)
        setEditContent(content)
        setIsEditing(false)
    }

    // Handle click to edit in editor mode
    const handleClick = () => {
        if (mode === 'editor' && !isEditing) {
            handleEditToggle()
        }
    }

    // Render title element
    const renderTitle = () => {
        if (!showTitle || !title) return null

        const TitleTag = titleTag
        return (
            <TitleTag className={`widget-title ${alignment === 'center' ? 'text-center' : alignment === 'right' ? 'text-right' : 'text-left'}`}>
                {title}
            </TitleTag>
        )
    }

    // Render content with proper sanitization
    const renderContent = () => {
        if (!content) return null

        const sanitizedContent = cleanHTML(content)
        return (
            <div
                className={`widget-content ${alignment === 'center' ? 'text-center' : alignment === 'right' ? 'text-right' : 'text-left'}`}
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />
        )
    }

    // Editor mode rendering
    if (mode === 'editor' && isEditing) {
        return (
            <div className="content-widget-editor p-4 border border-blue-300 rounded bg-blue-50">
                <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title
                    </label>
                    <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter widget title..."
                    />
                </div>

                <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Content
                    </label>
                    <textarea
                        ref={editorRef}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter widget content..."
                    />
                </div>

                <div className="flex justify-end space-x-2">
                    <button
                        onClick={handleCancel}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-3 py-1 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
                    >
                        Save
                    </button>
                </div>
            </div>
        )
    }

    // Preview/Display mode rendering
    const containerClasses = [
        'content-widget',
        style === 'card' ? 'p-4 border border-gray-200 rounded-lg bg-white shadow-sm' : '',
        style === 'highlight' ? 'p-4 bg-blue-50 border-l-4 border-blue-500' : '',
        mode === 'editor' ? 'cursor-pointer hover:bg-gray-50 min-h-[60px] p-3 border border-dashed border-gray-300 rounded' : '',
        customCss
    ].filter(Boolean).join(' ')

    return (
        <div
            className={containerClasses}
            onClick={handleClick}
            style={customCss ? { cssText: customCss } : undefined}
        >
            {mode === 'editor' && (!title && !content) && (
                <div className="flex items-center justify-center text-gray-400 min-h-[40px]">
                    <FileText className="h-5 w-5 mr-2" />
                    <span>Click to add content</span>
                </div>
            )}

            {renderTitle()}
            {renderContent()}

            {mode === 'editor' && (title || content) && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Type className="h-4 w-4 text-gray-400" />
                </div>
            )}
        </div>
    )
}

// === WIDGET METADATA ===
ContentWidget.displayName = 'ContentWidget'
ContentWidget.widgetType = 'core_widgets.ContentWidget'

// Default configuration
ContentWidget.defaultConfig = {
    title: '',
    content: 'Click to edit content...',
    titleTag: 'h3',
    showTitle: true,
    alignment: 'left',
    style: 'normal',
    customCss: '',
    template: 'default'
}

// Widget metadata for registry
ContentWidget.metadata = {
    name: 'Content Block',
    description: 'Rich text content with optional title and styling options',
    category: 'content',
    icon: FileText,
    tags: ['text', 'content', 'rich-text', 'title'],
    menuItems: [
        { action: 'edit', label: 'Edit Content', icon: 'edit' },
        { action: 'style', label: 'Change Style', icon: 'palette' },
        { action: 'alignment', label: 'Text Alignment', icon: 'align-left' }
    ]
}

// Action handlers (framework-specific implementations will override these)
ContentWidget.actionHandlers = {
    edit: (widgetInstance, layoutRenderer) => {
        // Default edit handler - can be overridden by framework
        console.log('ContentWidget edit action', widgetInstance)
    },
    style: (widgetInstance, layoutRenderer) => {
        // Default style handler - can be overridden by framework
        console.log('ContentWidget style action', widgetInstance)
    },
    alignment: (widgetInstance, layoutRenderer) => {
        // Default alignment handler - can be overridden by framework
        console.log('ContentWidget alignment action', widgetInstance)
    }
}

export default ContentWidget
