import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Grid3X3,
    Palette,
    Package,
    Database,
    Users,
    FileText,
    Calendar,
    History,
    ArrowRight,
    Activity,
    CheckCircle2,
    AlertCircle,
    Settings as Cog
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { layoutsApi } from '../api/layouts'
import { themesApi } from '../api'
import { objectTypesApi } from '../api/objectStorage'
import { api } from '../api/client'

const StatCard = ({ title, count, icon: Icon, color, link, description }) => (
    <Link
        to={link}
        className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
    >
        <div className="flex items-start justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <h3 className="text-3xl font-bold mt-1 text-gray-900">{count}</h3>
                <p className="text-xs text-gray-400 mt-1">{description}</p>
            </div>
            <div className={`p-3 rounded-lg ${color} bg-opacity-10 text-opacity-100`}>
                <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
            </div>
        </div>
        <div className="mt-4 flex items-center text-sm text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Manage {title} <ArrowRight className="w-4 h-4 ml-1" />
        </div>
    </Link>
)

const SettingsDashboard = () => {
    // Fetch counts
    const { data: layouts = [] } = useQuery({
        queryKey: ['layouts'],
        queryFn: async () => {
            const response = await layoutsApi.list()
            return Array.isArray(response) ? response : response?.results || []
        }
    })

    const { data: themes = [] } = useQuery({
        queryKey: ['themes'],
        queryFn: async () => {
            const response = await themesApi.list()
            return Array.isArray(response) ? response : response?.results || []
        }
    })

    const { data: objectTypes = [] } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: async () => {
            const response = await objectTypesApi.list()
            return response.data || []
        }
    })

    const { data: pagesResponse } = useQuery({
        queryKey: ['pages'],
        queryFn: async () => {
            const response = await api.get('/api/v1/webpages/pages/')
            return response.data
        }
    })

    const { data: healthStatus } = useQuery({
        queryKey: ['health'],
        queryFn: async () => {
            const response = await api.get('/health/')
            return response.data
        },
        refetchInterval: 30000 // Refresh every 30s
    })

    const stats = [
        {
            title: 'Pages',
            count: pagesResponse?.count || 0,
            icon: FileText,
            color: 'bg-blue-500',
            link: '/pages',
            description: 'Total managed web pages'
        },
        {
            title: 'Layouts',
            count: layouts.length,
            icon: Grid3X3,
            color: 'bg-purple-500',
            link: '/settings/layouts',
            description: 'Page layout templates'
        },
        {
            title: 'Themes',
            count: themes.length,
            icon: Palette,
            color: 'bg-pink-500',
            link: '/settings/themes',
            description: 'Visual style configurations'
        },
        {
            title: 'Object Types',
            count: objectTypes.length,
            icon: Database,
            color: 'bg-indigo-500',
            link: '/settings/object-types',
            description: 'Custom data structures'
        }
    ]

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Settings Dashboard</h1>
                    <p className="text-gray-500">System overview and quick management</p>
                </div>
                <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border border-gray-100 shadow-sm">
                    <Activity className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-gray-700">System Status:</span>
                    <span className="text-sm text-green-600 flex items-center">
                        {healthStatus?.status === 'healthy' ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Healthy
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-4 h-4 mr-1 text-yellow-500" />
                                <span className="text-yellow-600">Checking...</span>
                            </>
                        )}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <StatCard key={index} {...stat} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Quick Actions */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <Activity className="w-5 h-5 mr-2 text-blue-500" />
                        Quick Actions
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Link to="/pages/new" className="p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100">
                            <h4 className="font-semibold text-gray-900">Create New Page</h4>
                            <p className="text-xs text-gray-500 mt-1">Start building a new content page</p>
                        </Link>
                        <Link to="/settings/users" className="p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100">
                            <h4 className="font-semibold text-gray-900">Manage Users</h4>
                            <p className="text-xs text-gray-500 mt-1">Add or edit system administrators</p>
                        </Link>
                        <Link to="/settings/publishing" className="p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100">
                            <h4 className="font-semibold text-gray-900">Publishing Workflow</h4>
                            <p className="text-xs text-gray-500 mt-1">Check scheduled content tasks</p>
                        </Link>
                        <Link to="/schemas/system" className="p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors border border-transparent hover:border-blue-100">
                            <h4 className="font-semibold text-gray-900">System Schemas</h4>
                            <p className="text-xs text-gray-500 mt-1">Configure core data fields</p>
                        </Link>
                    </div>
                </div>

                {/* System Info */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <Cog className="w-5 h-5 mr-2 text-gray-500" />
                        System Information
                    </h2>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-gray-50">
                            <span className="text-sm text-gray-500">Backend Version</span>
                            <span className="text-sm font-mono font-medium text-gray-900">{healthStatus?.version || '1.0.0'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-50">
                            <span className="text-sm text-gray-500">Service Name</span>
                            <span className="text-sm font-medium text-gray-900">{healthStatus?.service || 'eceee-v4-backend'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-gray-50">
                            <span className="text-sm text-gray-500">Last Health Check</span>
                            <span className="text-sm font-medium text-gray-900 flex items-center">
                                <History className="w-3 h-3 mr-1" />
                                Just now
                            </span>
                        </div>
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="flex items-start">
                                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 mr-3" />
                                <div>
                                    <h4 className="text-sm font-semibold text-blue-900">Maintenance Tip</h4>
                                    <p className="text-xs text-blue-700 mt-1">Regularly review version history to keep the database size optimized.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SettingsDashboard

