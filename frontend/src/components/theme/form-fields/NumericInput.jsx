/**
 * Numeric Input - Simple text input for CSS values with units
 */

import React from 'react';

const NumericInput = ({ value, onChange, property, label, className = '' }) => {
    return (
        <div className={className}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}

            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder="e.g., 16px, 1.5rem, 1.5"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );
};

export default NumericInput;

