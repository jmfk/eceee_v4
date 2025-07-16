/**
 * Search and Filter Component for Bulk Publishing Operations
 * Handles search query and status filtering for pages
 */

import React from 'react';
import { Search, Filter } from 'lucide-react';

const SearchAndFilter = ({
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter
}) => {
    return (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Search */}
            <div className="flex-1">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search pages by title or slug..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center">
                <Filter className="w-4 h-4 text-gray-400 mr-2" />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="all">All Statuses</option>
                    <option value="unpublished">Unpublished</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                    <option value="expired">Expired</option>
                </select>
            </div>
        </div>
    );
};

export default SearchAndFilter; 