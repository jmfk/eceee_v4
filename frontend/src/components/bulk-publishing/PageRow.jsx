/**
 * Page Row Component for Bulk Publishing Table
 * Renders individual page rows with selection and status information
 */

import React from 'react';
import { CheckSquare, Square } from 'lucide-react';

const PageRow = ({
    page,
    isSelected,
    onSelectPage,
    getStatusColor,
    formatDate
}) => {
    return (
        <tr
            key={page.id}
            className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
        >
            <td className="px-6 py-4">
                <button
                    onClick={() => onSelectPage(page.id)}
                    className="text-blue-600 hover:text-blue-700"
                >
                    {isSelected ? (
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
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(page.publicationStatus)}`}>
                    {page.publicationStatus}
                </span>
            </td>
            <td className="px-6 py-4 text-sm text-gray-900">
                {formatDate(page.effectiveDate)}
            </td>
            <td className="px-6 py-4 text-sm text-gray-900">
                {formatDate(page.expiryDate)}
            </td>
        </tr>
    );
};

export default PageRow; 