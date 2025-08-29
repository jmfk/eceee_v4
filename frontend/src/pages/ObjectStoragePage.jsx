import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, FileText, Settings, FolderOpen } from 'lucide-react'
import ObjectTypeManager from '../components/ObjectTypeManager'
import ObjectBrowser from '../components/ObjectBrowser'

const ObjectStoragePage = () => {
    const [activeTab, setActiveTab] = useState('types')
    const navigate = useNavigate()

    const tabs = [
        {
            id: 'types',
            label: 'Object Types',
            icon: Database,
            description: 'Manage dynamic content types and schemas'
        },
        {
            id: 'instances',
            label: 'Object Browser',
            icon: FolderOpen,
            description: 'Browse and manage object instances'
        },
        {
            id: 'settings',
            label: 'Settings',
            icon: Settings,
            description: 'Configure object storage system'
        }
    ]

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                <Database className="h-6 w-6 mr-3" />
                                Object Storage System
                            </h1>
                            <p className="text-gray-600 mt-1">
                                Manage non-hierarchical content with dynamic schemas
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-6">
                    <nav className="flex space-x-8">
                        {tabs.map((tab) => {
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors ${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    <Icon className="h-4 w-4 mr-2" />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </nav>
                </div>
            </div>

            {/* Tab Content */}
            <div className="max-w-7xl mx-auto">
                {activeTab === 'types' && <ObjectTypeManager />}
                {activeTab === 'instances' && <ObjectBrowser />}
                {activeTab === 'settings' && <ObjectStorageSettings />}
            </div>
        </div>
    )
}

// ObjectBrowser is now imported from components

// Placeholder for Object Storage Settings
const ObjectStorageSettings = () => {
    return (
        <div className="p-6">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <h3 className="text-lg font-medium text-green-900 mb-2">Object Storage Settings</h3>
                <p className="text-green-800">
                    Settings panel for configuring object storage system behavior,
                    validation rules, and integration options.
                </p>
            </div>
        </div>
    )
}

export default ObjectStoragePage
