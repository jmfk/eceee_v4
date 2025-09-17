import React, { useState } from 'react'
import { FileInput, DocumentInput, VideoInput, AudioInput, ImageInput } from './index'

/**
 * FileFieldDemo Component
 * 
 * Demonstration component showing the different file field widgets
 * and their configurable file type filtering capabilities.
 */
const FileFieldDemo = ({ namespace = 'demo' }) => {
    const [values, setValues] = useState({
        anyFile: null,
        multipleFiles: [],
        documents: null,
        videos: null,
        audio: null,
        images: null,
        customPDFOnly: null,
        smallImages: []
    })

    const handleChange = (field) => (value) => {
        setValues(prev => ({
            ...prev,
            [field]: value
        }))
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">File Field Widget Demo</h1>
                <p className="text-gray-600">
                    Demonstration of configurable file field widgets with type filtering
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* General File Input */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">General File Input</h2>

                    <FileInput
                        label="Any File Type"
                        description="Accepts documents, images, videos, and audio files"
                        value={values.anyFile}
                        onChange={handleChange('anyFile')}
                        namespace={namespace}
                        required
                    />

                    <FileInput
                        label="Multiple Files"
                        description="Select multiple files of any supported type"
                        value={values.multipleFiles}
                        onChange={handleChange('multipleFiles')}
                        namespace={namespace}
                        multiple
                        maxItems={5}
                    />
                </div>

                {/* Specialized File Inputs */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">Specialized File Inputs</h2>

                    <DocumentInput
                        label="Document Only"
                        description="Only accepts PDF, Word, Excel, PowerPoint, and text files"
                        value={values.documents}
                        onChange={handleChange('documents')}
                        namespace={namespace}
                    />

                    <VideoInput
                        label="Video Only"
                        description="Only accepts MP4, WebM, and other video formats"
                        value={values.videos}
                        onChange={handleChange('videos')}
                        namespace={namespace}
                    />

                    <AudioInput
                        label="Audio Only"
                        description="Only accepts MP3, WAV, and other audio formats"
                        value={values.audio}
                        onChange={handleChange('audio')}
                        namespace={namespace}
                    />
                </div>

                {/* Custom Configuration */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">Custom Configuration</h2>

                    <ImageInput
                        label="Images (for comparison)"
                        description="Traditional image input using ExpandableImageField"
                        value={values.images}
                        onChange={handleChange('images')}
                        namespace={namespace}
                    />

                    <FileInput
                        label="PDF Files Only (Max 5MB)"
                        description="Custom configuration with MIME type, extension, and size constraints"
                        value={values.customPDFOnly}
                        onChange={handleChange('customPDFOnly')}
                        namespace={namespace}
                        allowedMimeTypes={['application/pdf']}
                        allowedExtensions=".pdf"
                        maxFileSize={5}
                        minFileSize={10}
                        fileTypeLabel="PDF Document"
                    />

                    <FileInput
                        label="Small Images Only"
                        description="Images under 2MB with specific extensions"
                        value={values.smallImages}
                        onChange={handleChange('smallImages')}
                        namespace={namespace}
                        allowedFileTypes={['image']}
                        allowedExtensions=".jpg, .jpeg, .png, .webp"
                        maxFileSize={2}
                        multiple={true}
                        maxItems={3}
                        fileTypeLabel="Small Image"
                    />
                </div>

                {/* Selected Values Display */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">Selected Values</h2>
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <pre className="text-sm text-gray-700 overflow-auto">
                            {JSON.stringify(values, null, 2)}
                        </pre>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-blue-900 mb-2">Features Demonstrated</h3>
                <ul className="text-blue-800 space-y-1 text-sm">
                    <li>• <strong>Configurable file type filtering</strong> - Each widget can be configured to accept specific file types</li>
                    <li>• <strong>Category-based filtering</strong> - Use predefined categories like 'document', 'video', 'audio', 'image'</li>
                    <li>• <strong>MIME type filtering</strong> - Specify exact MIME types for precise control</li>
                    <li>• <strong>File extension filtering</strong> - Restrict by specific file extensions (.pdf, .jpg, etc.)</li>
                    <li>• <strong>File size constraints</strong> - Set minimum and maximum file size limits</li>
                    <li>• <strong>Comprehensive validation</strong> - Real-time validation with detailed error messages</li>
                    <li>• <strong>Single and multiple selection</strong> - Support for both single file and multiple file selection</li>
                    <li>• <strong>File type icons</strong> - Different icons for different file types with color coding</li>
                    <li>• <strong>Drag & drop upload</strong> - Supports drag and drop with comprehensive validation</li>
                    <li>• <strong>Search and pagination</strong> - Full search capabilities with media library integration</li>
                    <li>• <strong>Expandable interface</strong> - Inline expandable picker similar to the image field widget</li>
                </ul>
            </div>
        </div>
    )
}

export default FileFieldDemo
