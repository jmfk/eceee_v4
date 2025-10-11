/**
 * PathPatternSelector Component
 * 
 * A dropdown selector for choosing predefined path patterns.
 * Displays pattern metadata including example URLs and extracted variables.
 */

import React, { useState, useEffect } from 'react';
import { fetchPathPatterns } from '../api/pathPatterns';

const PathPatternSelector = ({ value, onChange, disabled = false, className = '', pageId = null }) => {
    const [patterns, setPatterns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        loadPatterns();
    }, [pageId]);

    const loadPatterns = async () => {
        try {
            setLoading(true);
            const data = await fetchPathPatterns(pageId);
            setPatterns(data);
            setError(null);
        } catch (err) {
            console.error('Error loading path patterns:', err);
            setError('Failed to load path patterns');
        } finally {
            setLoading(false);
        }
    };

    const selectedPattern = patterns.find(p => p.key === value);

    const handleChange = (e) => {
        const newValue = e.target.value;
        onChange(newValue === '' ? '' : newValue);
    };

    if (loading) {
        return (
            <div className={`flex items-center space-x-2 ${className}`}>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600">Loading patterns...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`text-sm text-red-600 ${className}`}>
                {error}
            </div>
        );
    }

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Pattern Selector */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Path Pattern
                </label>
                <select
                    value={value || ''}
                    onChange={handleChange}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                    <option value="">No pattern (static page)</option>
                    {patterns.map(pattern => (
                        <option key={pattern.key} value={pattern.key}>
                            {pattern.name}
                        </option>
                    ))}
                </select>
                <p className="mt-1 text-sm text-gray-500">
                    Select a pattern to capture URL variables for dynamic content
                </p>
            </div>

            {/* Selected Pattern Details */}
            {selectedPattern && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-3">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h4 className="text-sm font-semibold text-blue-900">
                                {selectedPattern.name}
                            </h4>
                            <p className="text-sm text-blue-700 mt-1">
                                {selectedPattern.description}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowDetails(!showDetails)}
                            className="ml-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            {showDetails ? 'Hide' : 'Show'} Details
                        </button>
                    </div>

                    <div className="space-y-2">
                        <div>
                            <span className="text-xs font-medium text-blue-900">Example URL:</span>
                            <code className="block mt-1 px-2 py-1 bg-white border border-blue-200 rounded text-sm text-blue-800 break-all">
                                {selectedPattern.contextualizedExample || selectedPattern.exampleUrl}
                            </code>
                            {selectedPattern.contextualizedExample && (
                                <p className="text-xs text-blue-600 mt-1">
                                    Pattern: {selectedPattern.exampleUrl}
                                </p>
                            )}
                        </div>

                        {showDetails && (
                            <>
                                <div>
                                    <span className="text-xs font-medium text-blue-900">Regex Pattern:</span>
                                    <code className="block mt-1 px-2 py-1 bg-white border border-blue-200 rounded text-xs text-gray-700 font-mono break-all">
                                        {selectedPattern.regexPattern}
                                    </code>
                                </div>

                                {selectedPattern.extractedVariables && selectedPattern.extractedVariables.length > 0 && (
                                    <div>
                                        <span className="text-xs font-medium text-blue-900 block mb-2">
                                            Extracted Variables:
                                        </span>
                                        <div className="bg-white border border-blue-200 rounded overflow-hidden">
                                            <table className="min-w-full divide-y divide-blue-200">
                                                <thead className="bg-blue-100">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                                                            Name
                                                        </th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                                                            Type
                                                        </th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                                                            Description
                                                        </th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                                                            Example
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-blue-100">
                                                    {selectedPattern.extractedVariables.map((variable, idx) => (
                                                        <tr key={idx} className="hover:bg-blue-50">
                                                            <td className="px-3 py-2 text-sm font-mono text-gray-900">
                                                                {variable.name}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-gray-600">
                                                                {variable.type}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-gray-700">
                                                                {variable.description}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm font-mono text-gray-600">
                                                                {variable.example}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p className="mt-2 text-xs text-blue-700">
                                            These variables will be available to widgets on this page.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PathPatternSelector;

