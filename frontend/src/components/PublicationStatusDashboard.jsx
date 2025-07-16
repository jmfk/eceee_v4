/**
 * Publication Status Dashboard Component
 * Displays overview of publication status across all pages
 */

import React, { useState, useEffect } from 'react';
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
            const response = await fetch('/api/v1/webpages/pages/publication_status/');
            if (!response.ok) {
                throw new Error('Failed to fetch publication status');
            }
            const data = await response.json();
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
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Dashboard</h3>
                    <p className="text-gray-600 mb-4">{error}</p>
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
                        <h2 className="text-2xl font-bold text-gray-900">Publication Status Dashboard</h2>
                        <p className="text-gray-600 mt-1">Overview of content publication across your site</p>
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
                    {Object.entries(statusData.status_counts).map(([status, count]) => {
                        const Icon = getStatusIcon(status);
                        return (
                            <div key={status} className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600 capitalize">
                                            {status.replace('_', ' ')}
                                        </p>
                                        <p className="text-2xl font-bold text-gray-900">{count}</p>
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
                        <span className="text-lg font-bold text-blue-900">{statusData.total_pages}</span>
                    </div>
                </div>
            </div>

            {/* Upcoming Scheduled Pages */}
            {statusData.upcoming_scheduled.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center mb-4">
                        <Clock className="w-5 h-5 text-blue-600 mr-2" />
                        <h3 className="text-lg font-semibold text-gray-900">Upcoming Scheduled Publications</h3>
                    </div>
                    <div className="space-y-3">
                        {statusData.upcoming_scheduled.map((page) => (
                            <div key={page.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-gray-900">{page.title}</h4>
                                    <p className="text-sm text-gray-600">/{page.slug}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-blue-900">
                                        {formatDate(page.effective_date)}
                                    </p>
                                    <p className="text-xs text-blue-600">
                                        {formatRelativeDate(page.effective_date)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recently Expired Pages */}
            {statusData.recently_expired.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center mb-4">
                        <Archive className="w-5 h-5 text-red-600 mr-2" />
                        <h3 className="text-lg font-semibold text-gray-900">Recently Expired Pages</h3>
                    </div>
                    <div className="space-y-3">
                        {statusData.recently_expired.map((page) => (
                            <div key={page.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-gray-900">{page.title}</h4>
                                    <p className="text-sm text-gray-600">/{page.slug}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-red-900">
                                        Expired: {formatDate(page.expiry_date)}
                                    </p>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                        <CheckCircle className="w-8 h-8 text-green-600 mb-2" />
                        <h4 className="font-medium text-gray-900">Bulk Publish</h4>
                        <p className="text-sm text-gray-600">Publish multiple pages at once</p>
                    </button>
                    <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                        <Timer className="w-8 h-8 text-blue-600 mb-2" />
                        <h4 className="font-medium text-gray-900">Schedule Content</h4>
                        <p className="text-sm text-gray-600">Schedule pages for future publication</p>
                    </button>
                    <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                        <Calendar className="w-8 h-8 text-purple-600 mb-2" />
                        <h4 className="font-medium text-gray-900">Publication Calendar</h4>
                        <p className="text-sm text-gray-600">View timeline of all publications</p>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PublicationStatusDashboard; 