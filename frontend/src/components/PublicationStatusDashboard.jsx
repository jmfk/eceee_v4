/**
 * Publication Status Dashboard Component
 * Displays overview of publication status across all pages
 */

import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import {
    Calendar,
    Clock,
    Eye,
    EyeOff,
    FileText,
    BarChart3,
    AlertTriangle,
    CheckCircle,
    Timer,
    Archive
} from 'lucide-react';

const PublicationStatusDashboard = () => {
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPublicationStatus();
    }, []);

    const fetchPublicationStatus = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/v1/webpages/pages/publicationStatus/');
            const data = response.data;
            setStatusData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status) => {
        const icons = {
            unpublished: FileText,
            scheduled: Clock,
            published: Eye,
            expired: Archive
        };
        return icons[status] || FileText;
    };

    const getStatusColor = (status) => {
        const colors = {
            unpublished: 'text-gray-600 bg-gray-100',
            scheduled: 'text-blue-600 bg-blue-100',
            published: 'text-green-600 bg-green-100',
            expired: 'text-red-600 bg-red-100'
        };
        return colors[status] || 'text-gray-600 bg-gray-100';
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatRelativeDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = (date - now) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return `in ${Math.round(diffInHours)} hours`;
        } else {
            const diffInDays = Math.round(diffInHours / 24);
            return `in ${diffInDays} day${diffInDays !== 1 ? 's' : ''}`;
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded mb-4"></div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-20 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                    <div className="h-40 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center py-12">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <div className="text-lg font-medium text-gray-900 mb-2" role="heading" aria-level="3">Error Loading Dashboard</div>
                    <div className="text-gray-600 mb-4">{error}</div>
                    <button
                        onClick={fetchPublicationStatus}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="text-2xl font-bold text-gray-900" role="heading" aria-level="2">Publication Status Dashboard</div>
                        <div className="text-gray-600 mt-1">Overview of content publication across your site</div>
                    </div>
                    <button
                        onClick={fetchPublicationStatus}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                    >
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Refresh
                    </button>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(statusData.statusCounts).map(([status, count]) => {
                        const Icon = getStatusIcon(status);
                        return (
                            <div key={status} className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-gray-600 capitalize">
                                            {status.replace('_', ' ')}
                                        </div>
                                        <div className="text-2xl font-bold text-gray-900">{count}</div>
                                    </div>
                                    <div className={`p-2 rounded-full ${getStatusColor(status)}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Total Pages */}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-900">Total Pages</span>
                        <span className="text-lg font-bold text-blue-900">{statusData.totalPages}</span>
                    </div>
                </div>
            </div>

            {/* Upcoming Scheduled Pages */}
            {statusData.upcomingScheduled.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center mb-4">
                        <Clock className="w-5 h-5 text-blue-600 mr-2" />
                        <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Upcoming Scheduled Publications</div>
                    </div>
                    <div className="space-y-3">
                        {statusData.upcomingScheduled.map((page) => (
                            <div key={page.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                <div>
                                    <div className="font-medium text-gray-900" role="heading" aria-level="4">{page.title}</div>
                                    <div className="text-sm text-gray-600">/{page.slug}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium text-blue-900">
                                        {formatDate(page.effectiveDate)}
                                    </div>
                                    <div className="text-xs text-blue-600">
                                        {formatRelativeDate(page.effectiveDate)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recently Expired Pages */}
            {statusData.recentlyExpired.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center mb-4">
                        <Archive className="w-5 h-5 text-red-600 mr-2" />
                        <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Recently Expired Pages</div>
                    </div>
                    <div className="space-y-3">
                        {statusData.recentlyExpired.map((page) => (
                            <div key={page.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                <div>
                                    <div className="font-medium text-gray-900" role="heading" aria-level="4">{page.title}</div>
                                    <div className="text-sm text-gray-600">/{page.slug}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium text-red-900">
                                        Expired: {formatDate(page.expiryDate)}
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        Needs Review
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-lg font-semibold text-gray-900 mb-4" role="heading" aria-level="3">Quick Actions</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                        <CheckCircle className="w-8 h-8 text-green-600 mb-2" />
                        <div className="font-medium text-gray-900" role="heading" aria-level="4">Bulk Publish</div>
                        <div className="text-sm text-gray-600">Publish multiple pages at once</div>
                    </button>
                    <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                        <Timer className="w-8 h-8 text-blue-600 mb-2" />
                        <div className="font-medium text-gray-900" role="heading" aria-level="4">Schedule Content</div>
                        <div className="text-sm text-gray-600">Schedule pages for future publication</div>
                    </button>
                    <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                        <Calendar className="w-8 h-8 text-purple-600 mb-2" />
                        <div className="font-medium text-gray-900" role="heading" aria-level="4">Publication Calendar</div>
                        <div className="text-sm text-gray-600">View timeline of all publications</div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PublicationStatusDashboard; 