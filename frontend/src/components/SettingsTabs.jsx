import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Grid3X3, Palette, Settings as Cog, Calendar, FolderOpen, Code, ChevronDown, Hash, Database, Package, Menu, List } from 'lucide-react'
import { themesApi } from '../api'
import { objectTypesApi } from '../api/objectStorage'
import { layoutsApi } from '../api/layouts'
import { valueListsApi } from '../api/valueLists'

const tabs = [
    { id: 'layouts', label: 'Layouts', icon: Grid3X3, href: '/settings/layouts' },
    { id: 'themes', label: 'Themes', icon: Palette, href: '/settings/themes' },
    { id: 'widgets', label: 'Widgets', icon: Package, href: '/settings/widgets' },
    { id: 'value-lists', label: 'Value Lists', icon: List, href: '/settings/value-lists' },
    { id: 'object-types', label: 'Object Types', icon: Database, href: '/settings/object-types' },
    { id: 'versions', label: 'Versions', icon: Cog, href: '/settings/versions' },
    { id: 'publishing', label: 'Publishing Workflow', icon: Calendar, href: '/settings/publishing' },
    { id: 'namespaces', label: 'Namespaces', icon: FolderOpen, href: '/settings/namespaces' },
]

export default function SettingsTabs() {
    const location = useLocation()
    const [showDropdown, setShowDropdown] = useState(false)
    const [expandedMenus, setExpandedMenus] = useState(new Set())

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
        core: [],
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
                    href: `/settings/themes?edit=${theme.id}`,
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
        const newExpanded = new Set(expandedMenus)
        if (newExpanded.has(menuId)) {
            newExpanded.delete(menuId)
        } else {
            newExpanded.add(menuId)
        }
        setExpandedMenus(newExpanded)
    }

    // Auto-expand submenu if current page is in it
    useEffect(() => {
        const currentItem = getCurrentItem()
        if (currentItem) {
            // Check which submenu contains the current item
            Object.entries(navigationStructure).forEach(([key, section]) => {
                if (section.items && section.items.some(item => item.href === currentItem.href || location.pathname.startsWith(item.href.split('?')[0]))) {
                    setExpandedMenus(prev => new Set([...prev, section.id]))
                }
            })
        }
    }, [location.pathname])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.settings-dropdown')) {
                setShowDropdown(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Close dropdown when route changes
    useEffect(() => {
        setShowDropdown(false)
    }, [location.pathname])

    const currentItem = getCurrentItem()

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-4">
                {/* Context Label */}
                <div className="mb-3">
                    <h1 className="text-lg font-semibold text-gray-900 flex items-center">
                        {currentItem.icon && (
                            <currentItem.icon className="w-5 h-5 mr-2 text-gray-600" />
                        )}
                        {currentItem.label}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {currentItem.parent === 'schemas' ? 'Schema Management' : 'Settings Management'}
                    </p>
                </div>

                <div className="relative settings-dropdown">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="w-full flex items-center justify-between py-2 px-3 text-left bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    >
                        <span className="text-sm text-gray-700">Navigate to...</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showDropdown && (
                        <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                            <div className="py-2">
                                {/* Layouts Submenu */}
                                <div>
                                    <button
                                        onClick={() => toggleSubmenu('layouts')}
                                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <Grid3X3 className="w-5 h-5 mr-3 flex-shrink-0 text-gray-400" />
                                            <span className="font-medium">Layouts</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedMenus.has('layouts') ? 'rotate-180' : ''}`} />
                                    </button>

                                    {expandedMenus.has('layouts') && (
                                        <div className="bg-gray-50">
                                            {navigationStructure.layouts.items.map((item) => {
                                                const Icon = item.icon
                                                const active = isActive(item)
                                                return (
                                                    <Link
                                                        key={item.id}
                                                        to={item.href}
                                                        onClick={() => setShowDropdown(false)}
                                                        className={`flex items-center px-8 py-2 text-sm transition-colors ${active
                                                            ? 'text-blue-600 bg-blue-50 border-r-2 border-blue-600'
                                                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                                            }`}
                                                    >
                                                        <Icon className={`w-4 h-4 mr-3 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <div className="min-w-0">
                                                                    <p className="font-medium truncate">{item.label}</p>
                                                                    <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                                                </div>
                                                                {item.isLayout && (
                                                                    <div className="flex items-center space-x-1 ml-2">
                                                                        <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                                                            {item.layoutData?.slotCount || 'Layout'}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Themes Submenu */}
                                <div className="border-t border-gray-100">
                                    <button
                                        onClick={() => toggleSubmenu('themes')}
                                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <Palette className="w-5 h-5 mr-3 flex-shrink-0 text-gray-400" />
                                            <span className="font-medium">Themes</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedMenus.has('themes') ? 'rotate-180' : ''}`} />
                                    </button>

                                    {expandedMenus.has('themes') && (
                                        <div className="bg-gray-50">
                                            {navigationStructure.themes.items.map((item) => {
                                                const Icon = item.icon
                                                const active = isActive(item)
                                                return (
                                                    <Link
                                                        key={item.id}
                                                        to={item.href}
                                                        onClick={() => setShowDropdown(false)}
                                                        className={`flex items-center px-8 py-2 text-sm transition-colors ${active
                                                            ? 'text-blue-600 bg-blue-50 border-r-2 border-blue-600'
                                                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                                            }`}
                                                    >
                                                        <Icon className={`w-4 h-4 mr-3 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <div className="min-w-0">
                                                                    <p className="font-medium truncate">{item.label}</p>
                                                                    <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                                                </div>
                                                                {item.isTheme && (
                                                                    <div className="flex items-center space-x-1 ml-2">
                                                                        {(item.themeData?.isActive ?? item.themeData?.is_active) ? (
                                                                            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                                                                                Active
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
                                                                                Inactive
                                                                            </span>
                                                                        )}
                                                                        {(item.themeData?.isDefault ?? item.themeData?.is_default) && (
                                                                            <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                                                                                Default
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Value Lists Submenu */}
                                <div className="border-t border-gray-100">
                                    <button
                                        onClick={() => toggleSubmenu('valueLists')}
                                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <List className="w-5 h-5 mr-3 flex-shrink-0 text-gray-400" />
                                            <span className="font-medium">Value Lists</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedMenus.has('valueLists') ? 'rotate-180' : ''}`} />
                                    </button>

                                    {expandedMenus.has('valueLists') && (
                                        <div className="bg-gray-50">
                                            {navigationStructure.valueLists.items.map((item) => {
                                                const Icon = item.icon
                                                const active = isActive(item)
                                                return (
                                                    <Link
                                                        key={item.id}
                                                        to={item.href}
                                                        onClick={() => setShowDropdown(false)}
                                                        className={`flex items-center px-8 py-2 text-sm transition-colors ${active
                                                            ? 'text-blue-600 bg-blue-50 border-r-2 border-blue-600'
                                                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                                            }`}
                                                    >
                                                        <Icon className={`w-4 h-4 mr-3 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <div className="min-w-0">
                                                                    <p className="font-medium truncate">{item.label}</p>
                                                                    <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                                                </div>
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
                                                            </div>
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Widgets Submenu */}
                                <div className="border-t border-gray-100">
                                    <button
                                        onClick={() => toggleSubmenu('widgets')}
                                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <Package className="w-5 h-5 mr-3 flex-shrink-0 text-gray-400" />
                                            <span className="font-medium">Widgets</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedMenus.has('widgets') ? 'rotate-180' : ''}`} />
                                    </button>

                                    {expandedMenus.has('widgets') && (
                                        <div className="bg-gray-50">
                                            {navigationStructure.widgets.items.map((item) => {
                                                const Icon = item.icon
                                                const active = isActive(item)
                                                return (
                                                    <Link
                                                        key={item.id}
                                                        to={item.href}
                                                        onClick={() => setShowDropdown(false)}
                                                        className={`flex items-center px-8 py-2 text-sm transition-colors ${active
                                                            ? 'text-blue-600 bg-blue-50 border-r-2 border-blue-600'
                                                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                                            }`}
                                                    >
                                                        <Icon className={`w-4 h-4 mr-3 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                                                        <div className="min-w-0">
                                                            <p className="font-medium truncate">{item.label}</p>
                                                            <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Object Types Submenu */}
                                <div className="border-t border-gray-100">
                                    <button
                                        onClick={() => toggleSubmenu('objectTypes')}
                                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <Database className="w-5 h-5 mr-3 flex-shrink-0 text-gray-400" />
                                            <span className="font-medium">Object Types</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedMenus.has('objectTypes') ? 'rotate-180' : ''}`} />
                                    </button>

                                    {expandedMenus.has('objectTypes') && (
                                        <div className="bg-gray-50">
                                            {navigationStructure.objectTypes.items.map((item) => {
                                                const Icon = item.icon
                                                const active = isActive(item)
                                                return (
                                                    <Link
                                                        key={item.id}
                                                        to={item.href}
                                                        onClick={() => setShowDropdown(false)}
                                                        className={`flex items-center px-8 py-2 text-sm transition-colors ${active
                                                            ? 'text-blue-600 bg-blue-50 border-r-2 border-blue-600'
                                                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                                            }`}
                                                    >
                                                        <Icon className={`w-4 h-4 mr-3 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <div className="min-w-0">
                                                                    <p className="font-medium truncate">{item.label}</p>
                                                                    <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                                                </div>
                                                                {item.isObjectType && (
                                                                    <div className="flex items-center space-x-1 ml-2">
                                                                        <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                                                            {item.objectTypeData?.instancesCount || 0} items
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* System Submenu */}
                                <div className="border-t border-gray-100">
                                    <button
                                        onClick={() => toggleSubmenu('system')}
                                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <Cog className="w-5 h-5 mr-3 flex-shrink-0 text-gray-400" />
                                            <span className="font-medium">System</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedMenus.has('system') ? 'rotate-180' : ''}`} />
                                    </button>

                                    {expandedMenus.has('system') && (
                                        <div className="bg-gray-50">
                                            {navigationStructure.system.items.map((item) => {
                                                const Icon = item.icon
                                                const active = isActive(item)
                                                return (
                                                    <Link
                                                        key={item.id}
                                                        to={item.href}
                                                        onClick={() => setShowDropdown(false)}
                                                        className={`flex items-center px-8 py-2 text-sm transition-colors ${active
                                                            ? 'text-blue-600 bg-blue-50 border-r-2 border-blue-600'
                                                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                                            }`}
                                                    >
                                                        <Icon className={`w-4 h-4 mr-3 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                                                        <div className="min-w-0">
                                                            <p className="font-medium truncate">{item.label}</p>
                                                            <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Schemas Submenu */}
                                <div className="border-t border-gray-100">
                                    <button
                                        onClick={() => toggleSubmenu('schemas')}
                                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center">
                                            <Code className="w-5 h-5 mr-3 flex-shrink-0 text-gray-400" />
                                            <span className="font-medium">Schemas</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedMenus.has('schemas') ? 'rotate-180' : ''}`} />
                                    </button>

                                    {expandedMenus.has('schemas') && (
                                        <div className="bg-gray-50">
                                            {navigationStructure.schemas.items.map((item) => {
                                                const Icon = item.icon
                                                const active = isActive(item)
                                                return (
                                                    <Link
                                                        key={item.id}
                                                        to={item.href}
                                                        onClick={() => setShowDropdown(false)}
                                                        className={`flex items-center px-8 py-2 text-sm transition-colors ${active
                                                            ? 'text-blue-600 bg-blue-50 border-r-2 border-blue-600'
                                                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                                            }`}
                                                    >
                                                        <Icon className={`w-4 h-4 mr-3 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                                                        <div className="min-w-0">
                                                            <p className="font-medium truncate">{item.label}</p>
                                                            <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
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
