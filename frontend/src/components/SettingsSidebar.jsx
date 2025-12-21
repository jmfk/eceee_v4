import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
    LayoutDashboard,
    Grid3X3,
    Palette,
    Settings as Cog,
    Calendar,
    FolderOpen,
    Code,
    ChevronDown,
    List,
    Users,
    Package,
    Database,
    ChevronRight
} from 'lucide-react'
import { themesApi } from '../api'
import { objectTypesApi } from '../api/objectStorage'
import { layoutsApi } from '../api/layouts'
import { valueListsApi } from '../api/valueLists'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsSidebar() {
    const location = useLocation()
    const { user } = useAuth()
    const [expandedSections, setExpandedSections] = useState({
        layouts: true,
        themes: true,
        system: true,
        data: true,
        schemas: false
    })

    const toggleSection = (sectionId) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }))
    }

    // Fetching data for sub-items (ported from SettingsTabs)
    const { data: layouts = [] } = useQuery({
        queryKey: ['layouts'],
        queryFn: async () => {
            try {
                const response = await layoutsApi.list()
                return Array.isArray(response) ? response : response?.data || response?.results || []
            } catch (error) {
                console.error('Error fetching layouts:', error)
                return []
            }
        },
        staleTime: 5 * 60 * 1000,
    })

    const { data: themes = [] } = useQuery({
        queryKey: ['themes'],
        queryFn: async () => {
            try {
                const response = await themesApi.list()
                return Array.isArray(response) ? response : response?.data || response?.results || []
            } catch (error) {
                console.error('Error fetching themes:', error)
                return []
            }
        },
        staleTime: 5 * 60 * 1000,
    })

    const isActive = (path) => {
        if (!path) return false
        // Handle exact match or parent match for sub-items
        return location.pathname === path || (path !== '/settings' && location.pathname.startsWith(path))
    }

    const NavItem = ({ item, depth = 0 }) => {
        const Icon = item.icon
        const active = isActive(item.href)
        const hasChildren = item.items && item.items.length > 0
        const isExpanded = expandedSections[item.id]

        return (
            <div className="flex flex-col">
                {item.href ? (
                    <Link
                        to={item.href}
                        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${active
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        style={{ paddingLeft: `${(depth + 1) * 1}rem` }}
                    >
                        {Icon && <Icon className={`w-4 h-4 mr-3 ${active ? 'text-blue-600' : 'text-gray-400'}`} />}
                        <span className="truncate">{item.label}</span>
                    </Link>
                ) : (
                    <button
                        onClick={() => toggleSection(item.id)}
                        className="flex items-center justify-between px-4 py-2 text-sm font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded-md transition-colors mt-4 first:mt-0"
                        style={{ paddingLeft: `${(depth + 1) * 1}rem` }}
                    >
                        <div className="flex items-center">
                            {Icon && <Icon className="w-4 h-4 mr-3" />}
                            <span>{item.label}</span>
                        </div>
                        {hasChildren && (
                            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                        )}
                    </button>
                )}

                {hasChildren && isExpanded && (
                    <div className="mt-1 space-y-1">
                        {item.items.map(subItem => (
                            <NavItem key={subItem.id} item={subItem} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    const navigation = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            href: '/settings'
        },
        {
            id: 'system',
            label: 'System',
            icon: Cog,
            items: [
                ...(user?.isSuperuser ? [{ id: 'users', label: 'Users', icon: Users, href: '/settings/users' }] : []),
                { id: 'versions', label: 'Versions', icon: Cog, href: '/settings/versions' },
                { id: 'publishing', label: 'Publishing', icon: Calendar, href: '/settings/publishing' },
                { id: 'namespaces', label: 'Namespaces', icon: FolderOpen, href: '/settings/namespaces' },
            ]
        },
        {
            id: 'layouts',
            label: 'Layouts',
            icon: Grid3X3,
            items: [
                { id: 'layouts-overview', label: 'All Layouts', icon: Grid3X3, href: '/settings/layouts' },
                ...layouts.slice(0, 10).map(layout => ({
                    id: `layout-${layout.name}`,
                    label: layout.displayName || layout.name,
                    icon: Grid3X3,
                    href: `/settings/layouts?edit=${layout.name}`
                }))
            ]
        },
        {
            id: 'themes',
            label: 'Themes',
            icon: Palette,
            items: [
                { id: 'themes-overview', label: 'All Themes', icon: Palette, href: '/settings/themes' },
                ...themes.map(theme => ({
                    id: `theme-${theme.id}`,
                    label: theme.name,
                    icon: Palette,
                    href: `/settings/themes/${theme.id}`
                }))
            ]
        },
        {
            id: 'data',
            label: 'Data Structures',
            icon: Database,
            items: [
                { id: 'object-types', label: 'Object Types', icon: Database, href: '/settings/object-types' },
                { id: 'value-lists', label: 'Value Lists', icon: List, href: '/settings/value-lists' },
                { id: 'widgets', label: 'Widgets', icon: Package, href: '/settings/widgets' },
            ]
        },
        {
            id: 'schemas',
            label: 'Schemas',
            icon: Code,
            items: [
                { id: 'system-schema', label: 'System Schema', icon: Code, href: '/schemas/system' },
                { id: 'layout-schemas', label: 'Layout Schemas', icon: Code, href: '/schemas/layout' },
            ]
        }
    ]

    return (
        <aside className="w-64 bg-white border-r border-gray-200 h-full flex flex-col overflow-y-auto py-6">
            <div className="px-4 mb-6">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Settings</h2>
            </div>
            <nav className="flex-1 px-2 space-y-1">
                {navigation.map(section => (
                    <NavItem key={section.id} item={section} />
                ))}
            </nav>
        </aside>
    )
}

