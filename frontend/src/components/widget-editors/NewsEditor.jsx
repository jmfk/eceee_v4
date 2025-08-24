import { useState } from 'react'
import { Calendar, User, Tag, Image as ImageIcon, Eye, FolderOpen, ExternalLink } from 'lucide-react'
import BaseWidgetEditor from './BaseWidgetEditor'
import MediaPicker from '../media/MediaPicker'

/**
 * NewsEditor - Specialized editor for News widgets
 * 
 * Features:
 * - Article title and content editing
 * - Author and publication date fields
 * - Category selection
 * - Featured image management with MediaPicker integration and URL support
 * - Meta information controls
 * - Live article preview
 * - Media library integration with automatic metadata
 */
const NewsEditor = ({ config, onChange, errors, widgetType, namespace }) => {
    const [showPreview, setShowPreview] = useState(false)
    const [imageSource, setImageSource] = useState(config?.media_file_id ? 'library' : 'url')
    const [showMediaPicker, setShowMediaPicker] = useState(false)

    const categoryOptions = [
        { value: 'general', label: 'General' },
        { value: 'business', label: 'Business' },
        { value: 'technology', label: 'Technology' },
        { value: 'sports', label: 'Sports' },
        { value: 'health', label: 'Health' },
        { value: 'politics', label: 'Politics' }
    ]

    // Handle media selection from MediaPicker
    const handleMediaSelect = (selectedFiles) => {
        if (selectedFiles && selectedFiles.length > 0) {
            const selectedFile = selectedFiles[0]
            onChange({
                ...config,
                featuredImage: selectedFile.file_url,
                media_file_id: selectedFile.id // Store reference to media file
            })
        }
        setShowMediaPicker(false)
    }

    // Format date for input field
    const formatDateForInput = (dateString) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        return date.toISOString().split('T')[0]
    }

    const renderNewsPreview = () => {
        const previewConfig = config || {}

        return (
            <article className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                {/* Featured Image */}
                {previewConfig.featuredImage && (
                    <div className="aspect-w-16 aspect-h-9">
                        <img
                            src={previewConfig.featuredImage}
                            alt={previewConfig.title || 'Featured image'}
                            className="w-full h-48 object-cover"
                            onError={(e) => {
                                e.target.style.display = 'none'
                            }}
                        />
                    </div>
                )}

                <div className="p-6">
                    {/* Article Header */}
                    <div className="mb-4">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {previewConfig.title || 'Article Title'}
                        </h2>

                        {/* Meta Information */}
                        {previewConfig.showMeta !== false && (
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                {previewConfig.author && (
                                    <div className="flex items-center space-x-1">
                                        <User className="w-4 h-4" />
                                        <span>By {previewConfig.author}</span>
                                    </div>
                                )}
                                {previewConfig.publicationDate && (
                                    <div className="flex items-center space-x-1">
                                        <Calendar className="w-4 h-4" />
                                        <span>{new Date(previewConfig.publicationDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                                {previewConfig.category && (
                                    <div className="flex items-center space-x-1">
                                        <Tag className="w-4 h-4" />
                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                            {previewConfig.category.charAt(0).toUpperCase() + previewConfig.category.slice(1)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    {previewConfig.summary && (
                        <div className="mb-4">
                            <p className="text-lg text-gray-700 font-medium leading-relaxed">
                                {previewConfig.summary}
                            </p>
                        </div>
                    )}

                    {/* Article Content */}
                    <div className="prose max-w-none">
                        <div
                            dangerouslySetInnerHTML={{
                                __html: previewConfig.content || '<p>Article content will appear here...</p>'
                            }}
                        />
                    </div>
                </div>
            </article>
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
                renderTextArea,
                renderSelectField,
                renderCheckboxField,
                renderDateField,
                renderUrlField
            }) => (
                <>
                    {/* Article Title */}
                    {renderTextField('title', 'Article Title', {
                        placeholder: 'Enter the main headline for your article'
                    })}

                    {/* Article Summary/Lead */}
                    {renderTextArea('summary', 'Summary (Optional)', {
                        placeholder: 'Brief summary or lead paragraph that appears prominently',
                        rows: 3
                    })}

                    {/* Article Content */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Article Content *
                        </label>
                        <textarea
                            value={localConfig.content || ''}
                            onChange={(e) => handleFieldChange('content', e.target.value)}
                            placeholder="Enter the full article content. HTML tags are supported for formatting."
                            rows={10}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.content ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                                }`}
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>HTML formatting supported: &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;br&gt;, &lt;a&gt;</span>
                            <span>{(localConfig.content || '').length} characters</span>
                        </div>
                        {errors.content && (
                            <div className="flex items-center space-x-1 text-red-600">
                                <span className="text-xs">{errors.content}</span>
                            </div>
                        )}
                    </div>

                    {/* Author Information */}
                    {renderTextField('author', 'Author (Optional)', {
                        placeholder: 'Author name'
                    })}

                    {/* Publication Date */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Publication Date (Optional)
                        </label>
                        <input
                            type="date"
                            value={formatDateForInput(localConfig.publicationDate)}
                            onChange={(e) => handleFieldChange('publicationDate', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.publicationDate ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                                }`}
                        />
                        {!localConfig.publicationDate && (
                            <div className="text-xs text-gray-500">
                                Leave empty to use current date
                            </div>
                        )}
                        {errors.publicationDate && (
                            <div className="flex items-center space-x-1 text-red-600">
                                <span className="text-xs">{errors.publicationDate}</span>
                            </div>
                        )}
                    </div>

                    {/* Featured Image */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Featured Image (Optional)
                        </label>

                        {/* Image Source Selection */}
                        <div className="flex space-x-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="image-source"
                                    value="url"
                                    checked={imageSource === 'url'}
                                    onChange={(e) => setImageSource(e.target.value)}
                                    className="mr-2"
                                />
                                URL
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="image-source"
                                    value="library"
                                    checked={imageSource === 'library'}
                                    onChange={(e) => setImageSource(e.target.value)}
                                    className="mr-2"
                                />
                                Media Library
                            </label>
                        </div>

                        {/* URL Input */}
                        {imageSource === 'url' && (
                            <div className="space-y-2">
                                {renderUrlField('featuredImage', 'Image URL', {
                                    placeholder: 'https://example.com/image.jpg'
                                })}
                                {localConfig.featuredImage && (
                                    <div className="flex items-center space-x-2 text-xs text-gray-600">
                                        <ExternalLink className="w-3 h-3" />
                                        <a
                                            href={localConfig.featuredImage}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-blue-600"
                                        >
                                            View original image
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Media Library Selection */}
                        {imageSource === 'library' && (
                            <div className="space-y-4">
                                <button
                                    type="button"
                                    onClick={() => setShowMediaPicker(true)}
                                    className="w-full flex items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                                >
                                    <FolderOpen className="w-6 h-6 text-gray-400" />
                                    <span className="text-gray-600">
                                        {localConfig.media_file_id ? 'Change Featured Image from Library' : 'Select Featured Image from Library'}
                                    </span>
                                </button>

                                {localConfig.media_file_id && (
                                    <div className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg">
                                        <p className="font-medium text-green-800">Selected from Media Library</p>
                                        <p>This image is managed in your media library and will stay up-to-date automatically.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Image Preview */}
                        {localConfig.featuredImage && (
                            <div className="mt-2">
                                <div className="text-xs text-gray-600 mb-1">Image Preview:</div>
                                <img
                                    src={localConfig.featuredImage}
                                    alt="Featured image preview"
                                    className="w-full max-w-md h-32 object-cover rounded border"
                                    onError={(e) => {
                                        e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280">Image not found</text></svg>'
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Article Category */}
                    {renderSelectField('category', 'Category', categoryOptions)}

                    {/* Meta Display Settings */}
                    {renderCheckboxField(
                        'showMeta',
                        'Show meta information',
                        'Display author, publication date, and category information'
                    )}

                    {/* Live Preview Toggle */}
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                            Article Preview
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

                    {/* Article Preview */}
                    {showPreview && (
                        <div className="space-y-2">
                            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                {renderNewsPreview()}
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>• Preview shows how the article will appear to readers</p>
                                <p>• Featured image appears at the top if provided</p>
                                <p>• Meta information can be toggled on/off</p>
                            </div>
                        </div>
                    )}

                    {/* News Article Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                            <ImageIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-blue-900">News Article Best Practices</h4>
                                <ul className="text-xs text-blue-800 space-y-1">
                                    <li>• Write compelling headlines that grab attention</li>
                                    <li>• Include a concise summary to entice readers</li>
                                    <li>• Use high-quality featured images when possible</li>
                                    <li>• Structure content with paragraphs for readability</li>
                                    <li>• Include author bylines for credibility</li>
                                    <li>• Categorize articles for better organization</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Media Picker Modal */}
                    {showMediaPicker && (
                        <MediaPicker
                            mode="modal"
                            multiple={false}
                            fileTypes={['image']}
                            namespace={namespace}
                            onSelect={handleMediaSelect}
                            onClose={() => setShowMediaPicker(false)}
                        />
                    )}
                </>
            )}
        </BaseWidgetEditor>
    )
}

export default NewsEditor 