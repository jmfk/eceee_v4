/**
 * Publication Timeline Component
 * Visual timeline of publication periods showing scheduled, published, and expired content
 */

import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import {
    Calendar,
    Clock,
    Eye,
    Archive,
    ChevronLeft,
    ChevronRight,
    Filter,
    ZoomIn,
    ZoomOut,
    RefreshCw
} from 'lucide-react';

const PublicationTimeline = () => {
    const [timelineData, setTimelineData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('month'); // 'week', 'month', 'quarter'
    const [selectedStatuses, setSelectedStatuses] = useState(['scheduled', 'published', 'expired']);

    useEffect(() => {
        fetchTimelineData();
    }, [currentDate, viewMode]);

    const fetchTimelineData = async () => {
        try {
            setLoading(true);

            // Calculate date range based on view mode
            const startDate = getViewStartDate();
            const endDate = getViewEndDate();

            const response = await api.get(`/api/v1/webpages/pages/?effectiveDate__gte=${startDate.toISOString()}&effectiveDate__lte=${endDate.toISOString()}`);
            const data = response.data;
            setTimelineData(data.results || data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getViewStartDate = () => {
        const date = new Date(currentDate);
        switch (viewMode) {
            case 'week':
                const startOfWeek = date.getDate() - date.getDay();
                return new Date(date.setDate(startOfWeek));
            case 'month':
                return new Date(date.getFullYear(), date.getMonth(), 1);
            case 'quarter':
                const quarter = Math.floor(date.getMonth() / 3);
                return new Date(date.getFullYear(), quarter * 3, 1);
            default:
                return new Date(date.getFullYear(), date.getMonth(), 1);
        }
    };

    const getViewEndDate = () => {
        const date = new Date(currentDate);
        switch (viewMode) {
            case 'week':
                const endOfWeek = date.getDate() - date.getDay() + 6;
                return new Date(date.setDate(endOfWeek));
            case 'month':
                return new Date(date.getFullYear(), date.getMonth() + 1, 0);
            case 'quarter':
                const quarter = Math.floor(date.getMonth() / 3);
                return new Date(date.getFullYear(), quarter * 3 + 3, 0);
            default:
                return new Date(date.getFullYear(), date.getMonth() + 1, 0);
        }
    };

    const navigateTime = (direction) => {
        const newDate = new Date(currentDate);
        switch (viewMode) {
            case 'week':
                newDate.setDate(newDate.getDate() + (direction * 7));
                break;
            case 'month':
                newDate.setMonth(newDate.getMonth() + direction);
                break;
            case 'quarter':
                newDate.setMonth(newDate.getMonth() + (direction * 3));
                break;
        }
        setCurrentDate(newDate);
    };

    const formatDateRange = () => {
        const start = getViewStartDate();
        const end = getViewEndDate();

        if (viewMode === 'week') {
            if (start.getMonth() === end.getMonth()) {
                return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
            } else {
                return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            }
        } else if (viewMode === 'month') {
            return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else {
            const quarter = Math.floor(start.getMonth() / 3) + 1;
            return `Q${quarter} ${start.getFullYear()}`;
        }
    };

    const getStatusIcon = (status) => {
        const icons = {
            scheduled: Clock,
            published: Eye,
            expired: Archive
        };
        return icons[status] || Clock;
    };

    const getStatusColor = (status) => {
        const colors = {
            scheduled: 'bg-blue-500',
            published: 'bg-green-500',
            expired: 'bg-red-500'
        };
        return colors[status] || 'bg-gray-500';
    };

    const generateTimelineDays = () => {
        const start = getViewStartDate();
        const end = getViewEndDate();
        const days = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            days.push(new Date(d));
        }

        return days;
    };

    const getPagesByDate = (date) => {
        const dateStr = date.toISOString().split('T')[0];
        return timelineData.filter(page => {
            const effectiveDate = page.effectiveDate ? page.effectiveDate.split('T')[0] : null;
            const expiryDate = page.expiryDate ? page.expiryDate.split('T')[0] : null;

            return (effectiveDate === dateStr || expiryDate === dateStr) &&
                selectedStatuses.includes(page.publicationStatus);
        });
    };

    const isToday = (date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const toggleStatus = (status) => {
        setSelectedStatuses(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded mb-4"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Timeline</h3>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={fetchTimelineData}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Publication Timeline</h2>
                        <p className="text-gray-600 mt-1">Visual timeline of content publication periods</p>
                    </div>
                    <button
                        onClick={fetchTimelineData}
                        className="px-3 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                        title="Refresh Timeline"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                    {/* Navigation */}
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => navigateTime(-1)}
                            className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <h3 className="text-lg font-medium text-gray-900 min-w-0 flex-1">
                            {formatDateRange()}
                        </h3>
                        <button
                            onClick={() => navigateTime(1)}
                            className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* View Mode Selector */}
                    <div className="flex items-center space-x-2">
                        {['week', 'month', 'quarter'].map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${viewMode === mode
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Status Filter */}
                <div className="flex items-center space-x-2 mt-4">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Show:</span>
                    {['scheduled', 'published', 'expired'].map((status) => (
                        <button
                            key={status}
                            onClick={() => toggleStatus(status)}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${selectedStatuses.includes(status)
                                ? `${getStatusColor(status)} text-white`
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Timeline Grid */}
            <div className="p-6">
                <div className="grid grid-cols-7 gap-2">
                    {/* Day Headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                            {day}
                        </div>
                    ))}

                    {/* Timeline Days */}
                    {generateTimelineDays().map((date, index) => {
                        const pagesOnDate = getPagesByDate(date);
                        const isCurrentDay = isToday(date);

                        return (
                            <div
                                key={index}
                                className={`min-h-24 border border-gray-200 rounded p-2 ${isCurrentDay ? 'bg-blue-50 border-blue-200' : 'bg-white'
                                    }`}
                            >
                                <div className={`text-sm font-medium mb-1 ${isCurrentDay ? 'text-blue-900' : 'text-gray-900'
                                    }`}>
                                    {date.getDate()}
                                </div>

                                <div className="space-y-1">
                                    {pagesOnDate.map((page) => {
                                        const Icon = getStatusIcon(page.publicationStatus);
                                        return (
                                            <div
                                                key={page.id}
                                                className={`p-1 rounded text-xs text-white ${getStatusColor(page.publicationStatus)} flex items-center`}
                                                title={`${page.title} - ${page.publicationStatus}`}
                                            >
                                                <Icon className="w-3 h-3 mr-1 flex-shrink-0" />
                                                <span className="truncate">{page.title}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="mt-6 flex items-center justify-center space-x-6">
                    {[
                        { status: 'scheduled', label: 'Scheduled for Publication', icon: Clock },
                        { status: 'published', label: 'Published', icon: Eye },
                        { status: 'expired', label: 'Expired', icon: Archive }
                    ].map(({ status, label, icon: Icon }) => (
                        <div key={status} className="flex items-center">
                            <div className={`w-3 h-3 rounded ${getStatusColor(status)} mr-2`}></div>
                            <span className="text-sm text-gray-600">{label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PublicationTimeline; 