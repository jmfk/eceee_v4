import React from 'react'
import { FolderOpen } from 'lucide-react'
import ObjectBrowser from '../components/ObjectBrowser'

const ObjectStoragePage = () => {
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                <FolderOpen className="h-6 w-6 mr-3" />
                                Object Browser
                            </h1>
                            <p className="text-gray-600 mt-1">
                                Browse and manage object instances across all types
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto">
                <ObjectBrowser />
            </div>
        </div>
    )
}

export default ObjectStoragePage