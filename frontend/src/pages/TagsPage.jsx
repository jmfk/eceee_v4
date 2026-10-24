import React from 'react'
import '../components/user-tools.css'
import { Hash } from 'lucide-react'
import ClassificationManager from '../components/classification/ClassificationManager'
import ContextualHelpLink from '../components/help/ContextualHelpLink'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const TagsPage = () => {
    // Set document title
    useDocumentTitle('Tags')
    return (
        <div className="container mx-auto px-4 py-6">
            <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                    <Hash className="w-6 h-6 text-blue-600" />
                    <h1 className="text-2xl font-bold text-gray-900">Tags</h1>
                    <ContextualHelpLink topicId="tags" label="Open tags help" />
                </div>
                <div className="text-sm text-gray-600">
                    Organize tags shared by pages, objects and media.
                </div>
            </div>

            <div className="user-tools-panel">
                <ClassificationManager />
            </div>
        </div>
    )
}

export default TagsPage
