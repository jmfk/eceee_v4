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
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <Hash className="w-8 h-8 text-blue-600" />
                    <h1 className="text-3xl font-bold text-gray-900">Tags</h1>
                    <ContextualHelpLink topicId="tags" label="Open tags help" />
                </div>
                <div className="text-gray-600">
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
