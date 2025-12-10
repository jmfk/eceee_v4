import React from 'react'
import { Hash } from 'lucide-react'
import TagManager from '../components/TagManager'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const TagsPage = () => {
    // Set document title
    useDocumentTitle('Tags')
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <div className="flex items-center space-x-3 mb-2">
                    <Hash className="w-8 h-8 text-primary-600" />
                    <div className="text-3xl font-bold text-gray-900" role="heading" aria-level="1">Tags</div>
                </div>
                <div className="text-gray-600">
                    Manage content tags for organizing and categorizing pages, objects, and other content throughout the system.
                </div>
            </div>

            <div className="bg-white rounded-lg shadow">
                <TagManager />
            </div>
        </div>
    )
}

export default TagsPage

