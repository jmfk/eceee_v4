/**
 * Page Selection Table Component
 * Displays paginated table of pages with selection functionality
 */

import React from 'react';
import { CheckSquare, Square, Users } from 'lucide-react';
import PageRow from './PageRow';

const PageSelectionTable = ({
    filteredPages,
    selectedPages,
    onSelectAll,
    onSelectPage,
    searchQuery,
    statusFilter,
    getStatusColor,
    formatDate
}) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left">
                            <button
                                onClick={onSelectAll}
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
                        <PageRow
                            key={page.id}
                            page={page}
                            isSelected={selectedPages.has(page.id)}
                            onSelectPage={onSelectPage}
                            getStatusColor={getStatusColor}
                            formatDate={formatDate}
                        />
                    ))}
                </tbody>
            </table>

            {filteredPages.length === 0 && (
                <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <div className="text-lg font-medium text-gray-900 mb-2" role="heading" aria-level="3">No pages found</div>
                    <div className="text-gray-600">
                        {searchQuery || statusFilter !== 'all'
                            ? 'Try adjusting your search or filter criteria.'
                            : 'Create some pages to get started with bulk operations.'
                        }
                    </div>
                </div>
            )}
        </div>
    );
};

export default PageSelectionTable; 