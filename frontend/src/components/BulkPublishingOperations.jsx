/**
 * Bulk Publishing Operations Component
 * Allows scheduling and publishing multiple pages at once
 */

import React, { useState, useEffect } from 'react';
import {
    CheckSquare,
    Square,
    Clock,
    Eye,
    Calendar,
    Users,
    Search,
    Filter,
    CheckCircle,
    AlertTriangle,
    Loader
} from 'lucide-react';

const BulkPublishingOperations = () => {
    const [pages, setPages] = useState([]);
    const [selectedPages, setSelectedPages] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [operation, setOperation] = useState('publish'); // 'publish' or 'schedule'
    const [scheduledDate, setScheduledDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');

    useEffect(() => {
        fetchPages();
    }, []);

    const fetchPages = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/webpages/');
            if (!response.ok) {
                throw new Error('Failed to fetch pages');
            }
            const data = await response.json();
            setPages(data.results || data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredPages = pages.filter(page => {
        const matchesSearch = page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            page.slug.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === 'all' || page.publication_status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const handleSelectAll = () => {
        if (selectedPages.size === filteredPages.length) {
            setSelectedPages(new Set());
        } else {
            setSelectedPages(new Set(filteredPages.map(page => page.id)));
        }
    };

    const handleSelectPage = (pageId) => {
        const newSelected = new Set(selectedPages);
        if (newSelected.has(pageId)) {
            newSelected.delete(pageId);
        } else {
            newSelected.add(pageId);
        }
        setSelectedPages(newSelected);
    };

    const handleBulkOperation = async () => {
        if (selectedPages.size === 0) {
            setError('Please select at least one page');
            return;
        }

        if (operation === 'schedule' && !scheduledDate) {
            setError('Please select a scheduled publication date');
            return;
        }

        try {
            setProcessing(true);
            setError(null);
            setSuccess(null);

            const pageIds = Array.from(selectedPages);
            const endpoint = operation === 'publish' ? '/api/webpages/bulk_publish/' : '/api/webpages/bulk_schedule/';

            const requestData = {
                page_ids: pageIds,
                ...(operation === 'schedule' && {
                    effective_date: scheduledDate,
                    ...(expiryDate && { expiry_date: expiryDate })
                })
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value || ''
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Operation failed');
            }

            const result = await response.json();
            setSuccess(result.message);
            setSelectedPages(new Set());

            // Refresh pages list
            await fetchPages();

        } catch (err) {
            setError(err.message);
        } finally {
            setProcessing(false);
        }
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
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getMinDateTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5); // Minimum 5 minutes from now
        return now.toISOString().slice(0, 16);
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded mb-4"></div>
                    <div className="h-32 bg-gray-200 rounded mb-4"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
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
                        <h2 className="text-xl font-semibold text-gray-900">Bulk Publishing Operations</h2>
                        <p className="text-gray-600 mt-1">Publish or schedule multiple pages at once</p>
                    </div>
                    <div className="text-sm text-gray-500">
                        {selectedPages.size} of {filteredPages.length} selected
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-md flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-md flex items-center">
                        <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                        {success}
                    </div>
                )}

                {/* Filters */}
                <div className="flex items-center space-x-4 mb-4">
                    <div className="flex-1 relative">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search pages..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">All Statuses</option>
                        <option value="unpublished">Unpublished</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="published">Published</option>
                        <option value="expired">Expired</option>
                    </select>
                </div>

                {/* Operation Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                        <h3 className="font-medium text-gray-900">Select Operation</h3>
                        <div className="space-y-2">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    value="publish"
                                    checked={operation === 'publish'}
                                    onChange={(e) => setOperation(e.target.value)}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Publish immediately</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    value="schedule"
                                    checked={operation === 'schedule'}
                                    onChange={(e) => setOperation(e.target.value)}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Schedule for later</span>
                            </label>
                        </div>
                    </div>

                    {operation === 'schedule' && (
                        <div className="space-y-4">
                            <h3 className="font-medium text-gray-900">Schedule Settings</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Publication Date *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={scheduledDate}
                                        onChange={(e) => setScheduledDate(e.target.value)}
                                        min={getMinDateTime()}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Expiry Date (Optional)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={expiryDate}
                                        onChange={(e) => setExpiryDate(e.target.value)}
                                        min={scheduledDate || getMinDateTime()}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Button */}
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleBulkOperation}
                        disabled={processing || selectedPages.size === 0}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        {processing ? (
                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                        ) : operation === 'publish' ? (
                            <Eye className="w-4 h-4 mr-2" />
                        ) : (
                            <Clock className="w-4 h-4 mr-2" />
                        )}
                        {processing
                            ? 'Processing...'
                            : operation === 'publish'
                                ? `Publish ${selectedPages.size} Page${selectedPages.size !== 1 ? 's' : ''}`
                                : `Schedule ${selectedPages.size} Page${selectedPages.size !== 1 ? 's' : ''}`
                        }
                    </button>
                </div>
            </div>

            {/* Pages List */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left">
                                <button
                                    onClick={handleSelectAll}
                                    className="flex items-center text-sm font-medium text-gray-900"
                                >
                                    {selectedPages.size === filteredPages.length && filteredPages.length > 0 ? (
                                        <CheckSquare className="w-4 h-4 mr-2 text-blue-600" />
                                    ) : (
                                        <Square className="w-4 h-4 mr-2 text-gray-600" />
                                    )}
                                    Select All
                                </button>
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Page</th>
                            <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                            <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Effective Date</th>
                            <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Expiry Date</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredPages.map((page) => (
                            <tr
                                key={page.id}
                                className={`hover:bg-gray-50 ${selectedPages.has(page.id) ? 'bg-blue-50' : ''}`}
                            >
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => handleSelectPage(page.id)}
                                        className="text-blue-600 hover:text-blue-700"
                                    >
                                        {selectedPages.has(page.id) ? (
                                            <CheckSquare className="w-4 h-4" />
                                        ) : (
                                            <Square className="w-4 h-4" />
                                        )}
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="font-medium text-gray-900">{page.title}</div>
                                        <div className="text-sm text-gray-500">/{page.slug}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(page.publication_status)}`}>
                                        {page.publication_status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                    {formatDate(page.effective_date)}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                    {formatDate(page.expiry_date)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredPages.length === 0 && (
                    <div className="text-center py-12">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No pages found</h3>
                        <p className="text-gray-600">
                            {searchQuery || statusFilter !== 'all'
                                ? 'Try adjusting your search or filter criteria.'
                                : 'Create some pages to get started with bulk operations.'
                            }
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkPublishingOperations; 