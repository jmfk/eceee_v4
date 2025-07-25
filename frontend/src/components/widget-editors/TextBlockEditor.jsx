import { useState, useRef } from 'react'
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, Eye } from 'lucide-react'
import BaseWidgetEditor from './BaseWidgetEditor'

/**
 * TextBlockEditor - Specialized editor for TextBlock widgets
 * 
 * Features:
 * - Rich text formatting buttons
 * - Live preview
 * - Text alignment controls
 * - Character counter
 */
const TextBlockEditor = ({ config, onChange, errors, widgetType }) => {
    const [showPreview, setShowPreview] = useState(false)
    const contentRef = useRef(null)

    const alignmentOptions = [
        { value: 'left', label: 'Left', icon: AlignLeft },
        { value: 'center', label: 'Center', icon: AlignCenter },
        { value: 'right', label: 'Right', icon: AlignRight },
        { value: 'justify', label: 'Justify', icon: AlignRight }
    ]

    const styleOptions = [
        { value: 'normal', label: 'Normal' },
        { value: 'bold', label: 'Bold' },
        { value: 'italic', label: 'Italic' }
    ]

    const insertFormatting = (tag) => {
        const textarea = contentRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const selectedText = textarea.value.substring(start, end)
        const beforeText = textarea.value.substring(0, start)
        const afterText = textarea.value.substring(end)

        let newText
        switch (tag) {
            case 'bold':
                newText = `${beforeText}<strong>${selectedText || 'bold text'}</strong>${afterText}`
                break
            case 'italic':
                newText = `${beforeText}<em>${selectedText || 'italic text'}</em>${afterText}`
                break
            case 'p':
                newText = `${beforeText}<p>${selectedText || 'paragraph text'}</p>${afterText}`
                break
            case 'h3':
                newText = `${beforeText}<h3>${selectedText || 'heading text'}</h3>${afterText}`
                break
            default:
                newText = textarea.value
        }

        onChange({ ...config, content: newText })

        // Restore focus and selection
        setTimeout(() => {
            textarea.focus()
            const newCursorPos = start + newText.length - textarea.value.length + (selectedText ? 0 : tag.length + 2)
            textarea.setSelectionRange(newCursorPos, newCursorPos)
        }, 0)
    }

    const renderPreview = () => {
        const previewConfig = config || {}
        return (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 min-h-32">
                <div className={`text-${previewConfig.alignment || 'left'} ${previewConfig.style === 'bold' ? 'font-bold' :
                        previewConfig.style === 'italic' ? 'italic' : ''
                    }`}>
                    {previewConfig.title && (
                        <h3 className="text-lg font-semibold mb-2">{previewConfig.title}</h3>
                    )}
                    <div
                        className="prose max-w-none"
                        dangerouslySetInnerHTML={{
                            __html: previewConfig.content || '<p>Your text content will appear here...</p>'
                        }}
                    />
                </div>
            </div>
        )
    }

    return (
        <BaseWidgetEditor
            config={config}
            onChange={onChange}
            errors={errors}
            widgetType={widgetType}
        >
            {({
                config: localConfig,
                handleFieldChange,
                renderTextField,
                renderSelectField
            }) => (
                <>
                    {/* Title Field */}
                    {renderTextField('title', 'Title (Optional)', {
                        placeholder: 'Enter an optional title for your text block'
                    })}

                    {/* Content Field with Rich Text Controls */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700">
                                Content *
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowPreview(!showPreview)}
                                className="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-800"
                            >
                                <Eye className="w-3 h-3" />
                                <span>{showPreview ? 'Hide' : 'Show'} Preview</span>
                            </button>
                        </div>

                        {/* Rich Text Formatting Toolbar */}
                        <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded-t-lg border border-b-0 border-gray-300">
                            <button
                                type="button"
                                onClick={() => insertFormatting('bold')}
                                className="p-1 rounded hover:bg-gray-200"
                                title="Bold"
                            >
                                <Bold className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => insertFormatting('italic')}
                                className="p-1 rounded hover:bg-gray-200"
                                title="Italic"
                            >
                                <Italic className="w-4 h-4" />
                            </button>
                            <div className="w-px h-4 bg-gray-300" />
                            <button
                                type="button"
                                onClick={() => insertFormatting('h3')}
                                className="px-2 py-1 text-xs rounded hover:bg-gray-200"
                                title="Heading"
                            >
                                H3
                            </button>
                            <button
                                type="button"
                                onClick={() => insertFormatting('p')}
                                className="px-2 py-1 text-xs rounded hover:bg-gray-200"
                                title="Paragraph"
                            >
                                P
                            </button>
                        </div>

                        <textarea
                            ref={contentRef}
                            value={localConfig.content || ''}
                            onChange={(e) => handleFieldChange('content', e.target.value)}
                            placeholder="Enter your content here. You can use HTML tags for formatting."
                            rows={8}
                            className={`w-full px-3 py-2 border rounded-b-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.content ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                                }`}
                        />

                        {/* Character Counter */}
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>HTML tags supported: &lt;strong&gt;, &lt;em&gt;, &lt;p&gt;, &lt;h3&gt;, &lt;br&gt;</span>
                            <span>{(localConfig.content || '').length} characters</span>
                        </div>

                        {errors.content && (
                            <div className="flex items-center space-x-1 text-red-600">
                                <span className="text-xs">{errors.content}</span>
                            </div>
                        )}
                    </div>

                    {/* Alignment Field */}
                    {renderSelectField('alignment', 'Text Alignment', alignmentOptions)}

                    {/* Style Field */}
                    {renderSelectField('style', 'Text Style', styleOptions)}

                    {/* Live Preview */}
                    {showPreview && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Live Preview
                            </label>
                            {renderPreview()}
                        </div>
                    )}
                </>
            )}
        </BaseWidgetEditor>
    )
}

export default TextBlockEditor 