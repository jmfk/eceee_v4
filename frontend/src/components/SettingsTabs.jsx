import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Grid3X3, Palette, Settings as Cog, Calendar, FolderOpen, Code, ChevronDown, Hash, Database, Package, Menu, List, Users } from 'lucide-react'
import { themesApi } from '../api'
import { objectTypesApi } from '../api/objectStorage'
import { layoutsApi } from '../api/layouts'
import { valueListsApi } from '../api/valueLists'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsTabs() {
    const location = useLocation()
    const [openSubmenu, setOpenSubmenu] = useState(null)
    const { user } = useAuth()

    const isSettingsPath = location.pathname.startsWith('/settings')
    const isSchemasPath = location.pathname.startsWith('/schemas')

    // Fetch layouts for the layouts submenu
    const { data: layouts = [] } = useQuery({
        queryKey: ['layouts'],
        queryFn: async () => {
            try {
                const response = await layoutsApi.list()

                // Handle different response structures
                let layoutData = []
                if (Array.isArray(response)) {
                    layoutData = response
                } else if (response?.data && Array.isArray(response.data)) {
                    layoutData = response.data
                } else if (response?.results && Array.isArray(response.results)) {
                    layoutData = response.results
                } else if (response?.layouts && Array.isArray(response.layouts)) {
                    layoutData = response.layouts
                } else {
                    console.warn('Unexpected layouts API response structure:', response)
                    layoutData = []
                }

                return layoutData
            } catch (error) {
                console.error('Error fetching layouts:', error)
                return []
            }
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    // Fetch themes for the themes submenu
    const { data: themes = [] } = useQuery({
        queryKey: ['themes'],
        queryFn: async () => {
            try {
                const response = await themesApi.list()
                let themeData = null
                if (Array.isArray(response)) {
                    themeData = response
                } else if (response?.data && Array.isArray(response.data)) {
                    themeData = response.data
                } else if (response?.results && Array.isArray(response.results)) {
                    themeData = response.results
                } else {
                    themeData = []
                }
                return themeData || []
            } catch (error) {
                console.error('Error fetching themes:', error)
                return []
            }
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    // Fetch object types for the object types submenu
    const { data: objectTypes = [] } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: async () => {
            try {
                const response = await objectTypesApi.list()
                return response.data || []
            } catch (error) {
                console.error('Error fetching object types:', error)
                return []
            }
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    // Fetch value lists for the value lists submenu
    const { data: valueLists = [] } = useQuery({
        queryKey: ['value-lists'],
        queryFn: async () => {
            try {
                const response = await valueListsApi.list()
                return response.results || response.data || []
            } catch (error) {
                console.error('Error fetching value lists:', error)
                return []
            }
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    })

    // For widgets, we'll use a static list since they're code-based
    const coreWidgets = [
        { id: 'content-widget', label: 'Content Widget', description: 'Rich text and HTML content' },
        { id: 'image-widget', label: 'Image Widget', description: 'Images, galleries, and carousels' },
        { id: 'table-widget', label: 'Table Widget', description: 'Data tables and grids' },
        { id: 'header-widget', label: 'Header Widget', description: 'Page headers and banners' },
        { id: 'footer-widget', label: 'Footer Widget', description: 'Page footers' },
        { id: 'navigation-widget', label: 'Navigation Widget', description: 'Navigation menus' },
        { id: 'sidebar-widget', label: 'Sidebar Widget', description: 'Sidebar content areas' },
        { id: 'forms-widget', label: 'Forms Widget', description: 'Contact and data forms' }
    ]

    // Organized navigation structure with submenus
    const navigationStructure = {
        core: [
            ...(user?.isSuperuser ? [{ id: 'users', label: 'Users', icon: Users, href: '/settings/users', description: 'User management' }] : []),
            { id: 'versions', label: 'Versions', icon: Cog, href: '/settings/versions', description: 'Version history' },
            { id: 'publishing', label: 'Publishing', icon: Calendar, href: '/settings/publishing', description: 'Publishing workflow' },
            { id: 'namespaces', label: 'Namespaces', icon: FolderOpen, href: '/settings/namespaces', description: 'Content namespaces' },
        ],
        layouts: {
            id: 'layouts',
            label: 'Layouts',
            icon: Grid3X3,
            items: [
                { id: 'layouts-overview', label: 'Layout Manager', icon: Grid3X3, href: '/settings/layouts', description: 'Manage all layouts' },
                ...(Array.isArray(layouts) ? layouts.map(layout => ({
                    id: `layout-${layout.name}`,
                    label: layout.displayName || layout.name,
                    icon: Grid3X3,
                    href: `/settings/layouts?edit=${layout.name}`,
                    description: layout.description || 'Edit this layout',
                    isLayout: true,
                    layoutData: layout
                })) : [])
            ]
        },
        themes: {
            id: 'themes',
            label: 'Themes',
            icon: Palette,
            items: [
                { id: 'themes-overview', label: 'Theme Manager', icon: Palette, href: '/settings/themes', description: 'Manage all themes' },
                ...(Array.isArray(themes) ? themes.map(theme => ({
                    id: `theme-${theme.id}`,
                    label: theme.name,
                    icon: Palette,
                    href: `/settings/themes/${theme.id}`,
                    description: theme.description || 'Edit this theme',
                    isTheme: true,
                    themeData: theme
                })) : [])
            ]
        },
        valueLists: {
            id: 'valueLists',
            label: 'Value Lists',
            icon: List,
            items: [
                { id: 'value-lists-overview', label: 'Value List Manager', icon: List, href: '/settings/value-lists', description: 'Manage all value lists' },
                ...(Array.isArray(valueLists) ? valueLists.map(valueList => ({
                    id: `value-list-${valueList.id}`,
                    label: valueList.name,
                    icon: List,
                    href: `/settings/value-lists?edit=${valueList.id}`,
                    description: valueList.description || `Edit ${valueList.name}`,
                    isValueList: true,
                    valueListData: valueList
                })) : [])
            ]
        },
        widgets: {
            id: 'widgets',
            label: 'Widgets',
            icon: Package,
            items: [
                { id: 'widgets-overview', label: 'Widget Manager', icon: Package, href: '/settings/widgets', description: 'Manage all widgets' },
                ...(Array.isArray(coreWidgets) ? coreWidgets.map(widget => ({
                    id: widget.id,
                    label: widget.label,
                    icon: Package,
                    href: `/settings/widgets?edit=${widget.id}`,
                    description: widget.description,
                    isWidget: true
                })) : [])
            ]
        },
        objectTypes: {
            id: 'objectTypes',
            label: 'Object Types',
            icon: Database,
            items: [
                { id: 'object-types-overview', label: 'Object Type Manager', icon: Database, href: '/settings/object-types', description: 'Manage all object types' },
                ...(Array.isArray(objectTypes) ? objectTypes.map(objectType => ({
                    id: `object-type-${objectType.id}`,
                    label: objectType.label || objectType.name,
                    icon: Database,
                    href: `/settings/object-types?edit=${objectType.id}`,
                    description: objectType.description || `Edit ${objectType.label || objectType.name}`,
                    isObjectType: true,
                    objectTypeData: objectType
                })) : [])
            ]
        },
        system: {
            id: 'system',
            label: 'System',
            icon: Cog,
            items: [
                { id: 'versions', label: 'Versions', icon: Cog, href: '/settings/versions', description: 'Version control' },
                { id: 'publishing', label: 'Publishing Workflow', icon: Calendar, href: '/settings/publishing', description: 'Content publishing' },
                { id: 'namespaces', label: 'Namespaces', icon: FolderOpen, href: '/settings/namespaces', description: 'Content organization' },
            ]
        },
        schemas: {
            id: 'schemas',
            label: 'Schemas',
            icon: Code,
            items: [
                { id: 'system-schema', label: 'System Schema', icon: Code, href: '/schemas/system', description: 'Core system data structures' },
                { id: 'layout-schemas', label: 'Layout Schemas', icon: Code, href: '/schemas/layout', description: 'Page layout configurations' },
            ]
        }
    }

    // Flatten all items for easy lookup
    const allNavItems = [
        ...navigationStructure.core,
        ...navigationStructure.layouts.items,
        ...navigationStructure.themes.items,
        ...navigationStructure.valueLists.items,
        ...navigationStructure.widgets.items,
        ...navigationStructure.objectTypes.items,
        ...navigationStructure.system.items,
        ...navigationStructure.schemas.items
    ]

    const isActive = (item) => {
        if (item.href) {
            return location.pathname === item.href
        }
        return false
    }

    const getCurrentItem = () => {
        return allNavItems.find(item => isActive(item)) || allNavItems[0]
    }

    const toggleSubmenu = (menuId) => {
        setOpenSubmenu(prev => prev === menuId ? null : menuId)
    }

    // Close submenu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.settings-menubar')) {
                setOpenSubmenu(null)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Close submenu when route changes
    useEffect(() => {
        setOpenSubmenu(null)
    }, [location.pathname])

    const menuSections = [
        { ...navigationStructure.layouts, id: 'layouts' },
        { ...navigationStructure.themes, id: 'themes' },
        { ...navigationStructure.valueLists, id: 'valueLists' },
        { ...navigationStructure.widgets, id: 'widgets' },
        { ...navigationStructure.objectTypes, id: 'objectTypes' },
        { ...navigationStructure.system, id: 'system' },
        { ...navigationStructure.schemas, id: 'schemas' }
    ]

    return (
        <div className="bg-white rounded-lg shadow settings-menubar">
            {/* Horizontal Menubar */}
            <nav className="border-b border-gray-200">
                <div className="flex">
                    {/* Render core items as simple links */}
                    {navigationStructure.core.map((item) => {
                        const Icon = item.icon
                        const active = isActive(item)

                        return (
                            <Link
                                key={item.id}
                                to={item.href}
                                className={`flex items-center px-4 py-3 text-sm font-medium transition-colors border-b-2 ${active
                                    ? 'text-blue-600 bg-blue-50 border-blue-600'
                                    : 'text-gray-700 hover:bg-gray-50 border-transparent hover:border-gray-300'
                                    }`}
                            >
                                <Icon className="w-4 h-4 mr-2" />
                                {item.label}
                            </Link>
                        )
                    })}

                    {/* Render sections with dropdowns */}
                    {menuSections.map((section) => {
                        const Icon = section.icon
                        const isOpen = openSubmenu === section.id

                        return (
                            <div key={section.id} className="relative">
                                <button
                                    onClick={() => toggleSubmenu(section.id)}
                                    className={`flex items-center px-4 py-3 text-sm font-medium transition-colors border-b-2 ${isOpen
                                        ? 'text-blue-600 bg-blue-50 border-blue-600'
                                        : 'text-gray-700 hover:bg-gray-50 border-transparent hover:border-gray-300'
                                        }`}
                                >
                                    <Icon className="w-4 h-4 mr-2" />
                                    {section.label}
                                    <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isOpen && (
                                    <div className="absolute top-full left-0 mt-0 bg-white border border-gray-200 rounded-b-lg shadow-lg z-50 min-w-[280px] max-h-[500px] overflow-y-auto">
                                        <div className="py-2">
                                            {section.items.map((item) => {
                                                const ItemIcon = item.icon
                                                const active = isActive(item)

                                                return (
                                                    <Link
                                                        key={item.id}
                                                        to={item.href}
                                                        className={`flex items-center px-4 py-2 text-sm transition-colors ${active
                                                            ? 'text-blue-600 bg-blue-50 border-r-2 border-blue-600'
                                                            : 'text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <ItemIcon className={`w-4 h-4 mr-3 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <div className="min-w-0">
                                                                    <p className="font-medium truncate">{item.label}</p>
                                                                    {item.description && (
                                                                        <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                                                    )}
                                                                </div>
                                                                {/* Badges for specific item types */}
                                                                {item.isLayout && item.layoutData?.slotCount && (
                                                                    <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded ml-2">
                                                                        {item.layoutData.slotCount}
                                                                    </span>
                                                                )}
                                                                {item.isTheme && (
                                                                    <div className="flex items-center space-x-1 ml-2">
                                                                        {(item.themeData?.isActive ?? item.themeData?.is_active) && (
                                                                            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                                                                                Active
                                                                            </span>
                                                                        )}
                                                                        {(item.themeData?.isDefault ?? item.themeData?.is_default) && (
                                                                            <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                                                                                Default
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {item.isValueList && (
                                                                    <div className="flex items-center space-x-1 ml-2">
                                                                        <span className={`px-1.5 py-0.5 text-xs rounded ${item.valueListData?.is_active
                                                                            ? 'bg-green-100 text-green-700'
                                                                            : 'bg-gray-100 text-gray-700'
                                                                            }`}>
                                                                            {item.valueListData?.value_type}
                                                                        </span>
                                                                        <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                                                            {item.valueListData?.item_count || 0}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {item.isObjectType && (
                                                                    <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded ml-2">
                                                                        {item.objectTypeData?.instancesCount || 0} items
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </nav>
        </div>
    )

    // Helper function to get tab descriptions
    function getTabDescription(tabId) {
        const descriptions = {
            'layouts': 'Page layout templates',
            'themes': 'Visual styling and colors',
            'widgets': 'Reusable content components',
            'tags': 'Content organization',
            'object-types': 'Dynamic content types',
            'versions': 'Version control',
            'publishing': 'Content publishing',
            'namespaces': 'Content organization'
        }
        return descriptions[tabId] || 'Settings management'
    }
}
