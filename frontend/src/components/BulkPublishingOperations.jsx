/**
 * Bulk Publishing Operations Component (Refactored)
 * 
 * This component has been refactored following OOP principles:
 * - Single Responsibility: Each sub-component has one clear purpose
 * - Open/Closed: Easy to extend with new operation types or filters
 * - Smaller, focused components under 100 lines (Sandi Metz Rule #1)
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import SearchAndFilter from './bulk-publishing/SearchAndFilter';
import BulkOperationControls from './bulk-publishing/BulkOperationControls';
import PageSelectionTable from './bulk-publishing/PageSelectionTable';

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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 animate-spin border-2 border-blue-600 border-t-transparent rounded-full mr-3"></div>
                <span className="text-gray-600">Loading pages...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-gray-200 pb-4">
                <h1 className="text-2xl font-bold text-gray-900">Bulk Publishing Operations</h1>
                <p className="mt-2 text-gray-600">
                    Select multiple pages to publish immediately or schedule for future publication.
                </p>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex">
                        <AlertTriangle className="w-5 h-5 text-red-400 mr-3 mt-0.5" />
                        <div className="text-red-700">{error}</div>
                    </div>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                    <div className="flex">
                        <CheckCircle className="w-5 h-5 text-green-400 mr-3 mt-0.5" />
                        <div className="text-green-700">{success}</div>
                    </div>
                </div>
            )}

            {/* Refactored Components - Following Single Responsibility Principle */}
            <SearchAndFilter
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
            />

            <BulkOperationControls
                operation={operation}
                setOperation={setOperation}
                scheduledDate={scheduledDate}
                setScheduledDate={setScheduledDate}
                expiryDate={expiryDate}
                setExpiryDate={setExpiryDate}
                selectedPages={selectedPages}
                processing={processing}
                onBulkOperation={handleBulkOperation}
            />

            <PageSelectionTable
                filteredPages={filteredPages}
                selectedPages={selectedPages}
                onSelectAll={handleSelectAll}
                onSelectPage={handleSelectPage}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                getStatusColor={getStatusColor}
                formatDate={formatDate}
            />
        </div>
    );
};

export default BulkPublishingOperations; 