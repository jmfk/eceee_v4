import React, { useState } from 'react'
import TagInput from './TagInput'

/**
 * Demo component for testing TagInput functionality
 * This can be used for testing and development purposes
 */
const TagInputDemo = () => {
    const [imageTagValue, setImageTagValue] = useState('')
    const [fileTagValue, setFileTagValue] = useState('')

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-8">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">TagInput Demo</h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-md font-medium mb-3">Image Property Tags</h3>
                        <TagInput
                            label="Auto-Tags for Uploads"
                            value={imageTagValue}
                            onChange={setImageTagValue}
                            placeholder="category, product-images, gallery"
                            helpText="Tags that will be automatically added to uploaded images. New tags will be created if they don't exist."
                        />
                        <div className="mt-2 text-sm text-gray-600">
                            <strong>Current value:</strong> {imageTagValue || '(empty)'}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-md font-medium mb-3">File Property Tags</h3>
                        <TagInput
                            label="Auto-Tags for Uploads"
                            value={fileTagValue}
                            onChange={setFileTagValue}
                            placeholder="documents, attachments, files"
                            helpText="Tags that will be automatically added to uploaded files. New tags will be created if they don't exist."
                        />
                        <div className="mt-2 text-sm text-gray-600">
                            <strong>Current value:</strong> {fileTagValue || '(empty)'}
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <h3 className="text-md font-medium mb-3">Test Actions</h3>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => setImageTagValue('test-tag, another-tag, new-category')}
                                className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                Set Image Tags
                            </button>
                            <button
                                onClick={() => setFileTagValue('document, attachment, important')}
                                className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                            >
                                Set File Tags
                            </button>
                            <button
                                onClick={() => {
                                    setImageTagValue('')
                                    setFileTagValue('')
                                }}
                                className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TagInputDemo
