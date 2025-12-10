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
                <div className="text-3xl font-bold text-gray-900 mb-2" role="heading" aria-level="1">File Field Widget Demo</div>
                <div className="text-gray-600">
                    Demonstration of configurable file field widgets with type filtering
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* General File Input */}
                <div className="space-y-4">
                    <div className="text-xl font-semibold text-gray-800" role="heading" aria-level="2">General File Input</div>

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
                    <div className="text-xl font-semibold text-gray-800" role="heading" aria-level="2">Specialized File Inputs</div>

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
                    <div className="text-xl font-semibold text-gray-800" role="heading" aria-level="2">Custom Configuration</div>

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
                    <div className="text-xl font-semibold text-gray-800" role="heading" aria-level="2">Selected Values</div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <pre className="text-sm text-gray-700 overflow-auto">
                            {JSON.stringify(values, null, 2)}
                        </pre>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-lg font-medium text-blue-900 mb-2" role="heading" aria-level="3">Features Demonstrated</div>
                <div className="text-blue-800 space-y-1 text-sm" role="list">
                    <li>• <span className="font-bold">Configurable file type filtering</span> - Each widget can be configured to accept specific file types</li>
                    <li>• <span className="font-bold">Category-based filtering</span> - Use predefined categories like 'document', 'video', 'audio', 'image'</li>
                    <li>• <span className="font-bold">MIME type filtering</span> - Specify exact MIME types for precise control</li>
                    <li>• <span className="font-bold">File extension filtering</span> - Restrict by specific file extensions (.pdf, .jpg, etc.)</li>
                    <li>• <span className="font-bold">File size constraints</span> - Set minimum and maximum file size limits</li>
                    <li>• <span className="font-bold">Comprehensive validation</span> - Real-time validation with detailed error messages</li>
                    <li>• <span className="font-bold">Single and multiple selection</span> - Support for both single file and multiple file selection</li>
                    <li>• <span className="font-bold">File type icons</span> - Different icons for different file types with color coding</li>
                    <li>• <span className="font-bold">Drag & drop upload</span> - Supports drag and drop with comprehensive validation</li>
                    <li>• <span className="font-bold">Search and pagination</span> - Full search capabilities with media library integration</li>
                    <li>• <span className="font-bold">Expandable interface</span> - Inline expandable picker similar to the image field widget</li>
                </div>
            </div>
        </div>
    )
}

export default FileFieldDemo
