import React from 'react'
import { Hash } from 'lucide-react'
import ClassificationManager from '../components/classification/ClassificationManager'
import ContextualHelpLink from '../components/help/ContextualHelpLink'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const TagsPage = () => {
    // Set document title
    useDocumentTitle('Classification')
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <div className="flex items-center space-x-3 mb-2">
                    <Hash className="w-8 h-8 text-primary-600" />
                    <div className="text-3xl font-bold text-gray-900" role="heading" aria-level="1">Classification</div>
                    <ContextualHelpLink topicId="tags" label="Open classification help" />
                </div>
                <div className="text-gray-600">
                    Manage classification types, terms and proposals shared by content and media.
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6">
                <ClassificationManager />
            </div>
        </div>
    )
}

export default TagsPage
