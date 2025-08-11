import React, { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Grid3X3, Palette, Settings as Cog, Calendar, FolderOpen, Code, ChevronDown } from 'lucide-react'

const tabs = [
    { id: 'layouts', label: 'Layouts', icon: Grid3X3, href: '/settings?tab=layouts' },
    { id: 'themes', label: 'Themes', icon: Palette, href: '/settings?tab=themes' },
    { id: 'versions', label: 'Versions', icon: Cog, href: '/settings?tab=versions' },
    { id: 'publishing', label: 'Publishing Workflow', icon: Calendar, href: '/settings?tab=publishing' },
    { id: 'namespaces', label: 'Namespaces', icon: FolderOpen, href: '/settings?tab=namespaces' },
]

export default function SettingsTabs() {
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const [openDropdown, setOpenDropdown] = useState(false)

    const isSettingsPath = location.pathname === '/settings'
    const activeSettingsTab = searchParams.get('tab') || 'layouts'
    const isSchemasPath = location.pathname.startsWith('/schemas')

    const isActive = (tab) => {
        if (tab.id === 'schemas') return isSchemasPath
        if (!isSettingsPath) return false
        return activeSettingsTab === tab.id
    }

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6" aria-label="Tabs">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        const active = isActive(tab)
                        return (
                            <Link
                                key={tab.id}
                                to={tab.href}
                                className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${active
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                <Icon
                                    className={`mr-2 w-5 h-5 ${active ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`}
                                />
                                {tab.label}
                            </Link>
                        )
                    })}
                    {/* Schemas dropdown inline, left-aligned with other tabs */}
                    <div
                        className="relative"
                        onMouseEnter={() => setOpenDropdown(true)}
                        onMouseLeave={() => setOpenDropdown(false)}
                    >
                        <button
                            onClick={() => setOpenDropdown((v) => !v)}
                            className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${isSchemasPath
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <Code className={`mr-2 w-5 h-5 ${isSchemasPath ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                            Schemas
                            <ChevronDown className="w-4 h-4 ml-1" />
                        </button>
                        {openDropdown && (
                            <div className="absolute left-0 mt-0 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                                <div className="py-1">
                                    <Link
                                        to="/schemas/system"
                                        onClick={() => setOpenDropdown(false)}
                                        className={`block px-4 py-2 text-sm ${location.pathname === '/schemas/system'
                                            ? 'text-primary-600 bg-primary-50'
                                            : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                    >
                                        System Schema
                                    </Link>
                                    <Link
                                        to="/schemas/layout"
                                        onClick={() => setOpenDropdown(false)}
                                        className={`block px-4 py-2 text-sm ${location.pathname === '/schemas/layout'
                                            ? 'text-primary-600 bg-primary-50'
                                            : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                    >
                                        Layout Schemas
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </nav>
            </div>
        </div>
    )
}


