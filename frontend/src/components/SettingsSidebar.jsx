import { canAccessCmsPath } from '../utils/cmsNavigation'
import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
    LayoutDashboard,
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
    Beaker,
    Globe2,
    ChevronRight
} from 'lucide-react'
import { themesApi } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { cmsText } from '../utils/cmsCopy'
import { useSupportContext } from './support/useSupportContext'

export default function SettingsSidebar({ onNavigate }) {
    const location = useLocation()
    const { user, language } = useAuth()
    const support = useSupportContext()
    const scopedTenant = new URLSearchParams(location.search).get('tenant')
    const scopedHref = (href) => scopedTenant && ['/settings/support', '/settings/roles'].includes(href)
        ? `${href}?tenant=${encodeURIComponent(scopedTenant)}` : href
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [expandedSections, setExpandedSections] = useState({
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

    const { data: themes = [] } = useQuery({
        queryKey: ['themes'],
        enabled: canAccessCmsPath(user, '/settings/themes'),
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
                        to={scopedHref(item.href)}
                        onClick={onNavigate}
                        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${active
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                            }`}
                        style={{ paddingLeft: `${(depth + 1) * 1}rem` }}
                    >
                        {Icon && <Icon className={`w-4 h-4 mr-3 ${active ? 'text-blue-600' : 'text-gray-400'}`} />}
                        <span className="truncate">{item.translate === false ? item.label : cmsText(item.label, language)}</span>
                    </Link>
                ) : (
                    <button
                        onClick={() => toggleSection(item.id)}
                        className="flex items-center justify-between px-4 py-2 text-sm font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded-md transition-colors mt-4 first:mt-0"
                        style={{ paddingLeft: `${(depth + 1) * 1}rem` }}
                    >
                        <div className="flex items-center">
                            {Icon && <Icon className="w-4 h-4 mr-3" />}
                            <span>{cmsText(item.label, language)}</span>
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
            id: 'experiments',
            label: 'A/B Testing',
            icon: Beaker,
            href: '/settings/experiments'
        },
        {
            id: 'system',
            label: 'System',
            icon: Cog,
            items: [
                { id: 'support', label: 'Support', icon: Users, href: '/settings/support' },
                { id: 'roles', label: 'Användare och behörigheter', icon: Users, href: '/settings/roles' },
                ...(user?.isSuperuser ? [{ id: 'users', label: 'System accounts', icon: Users, href: '/settings/users' }] : []),
                { id: 'versions', label: 'Versions', icon: Cog, href: '/settings/versions' },
                { id: 'publishing', label: 'Publishing', icon: Calendar, href: '/settings/publishing' },
                { id: 'namespaces', label: 'Namespaces', icon: FolderOpen, href: '/settings/namespaces' },
                ...((user?.permissions?.includes('integrations.manage') || user?.isSuperuser)
                    ? [{ id: 'remote-sites', label: 'Remote Sites', icon: Globe2, href: '/settings/remote-sites' }]
                    : []),
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
                    translate: false,
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
                { id: 'data-connections', label: 'Data Connections', icon: Database, href: '/settings/data-connections' },
                { id: 'content-migration', label: 'Content Migration', icon: Database, href: '/settings/content-migration' },
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

    const visibleNavigation = navigation.flatMap((item) => {
        if (item.href) return canAccessCmsPath(user, item.href) ? [item] : []
        const items = item.items.filter((child) => canAccessCmsPath(user, child.href) || (child.href === '/settings/support' && support.data?.canSupport))
        return items.length ? [{ ...item, items }] : []
    })

    return (
        <aside className={`${isCollapsed ? 'w-14' : 'w-64'} h-full shrink-0 border-r border-gray-200 bg-white transition-[width] duration-200 ease-out flex flex-col`}>
            <div className={`flex h-16 shrink-0 items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
                {!isCollapsed && <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Settings</h2>}
                <button
                    type="button"
                    onClick={() => setIsCollapsed((collapsed) => !collapsed)}
                    aria-label={cmsText(isCollapsed ? 'Expand settings menu' : 'Collapse settings menu', language)}
                    aria-expanded={!isCollapsed}
                    aria-controls="settings-navigation"
                    title={cmsText(isCollapsed ? 'Expand settings menu' : 'Collapse settings menu', language)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rotate-180" />}
                </button>
            </div>
            {!isCollapsed && <nav id="settings-navigation" aria-label="Settings" className="flex-1 overflow-y-auto px-2 pb-6 space-y-1">
                    {visibleNavigation.map(section => (
                        <NavItem key={section.id} item={section} />
                    ))}
                </nav>}
        </aside>
    )
}
