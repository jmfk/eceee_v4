/**
 * PathPreviewInput Component
 * 
 * Allows editors to simulate different URL paths to preview how path variables
 * will be extracted and passed to widgets.
 */

import React, { useState, useEffect } from 'react';
import { validatePathPattern } from '../utils/pathParser';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const PathPreviewInput = ({
    pathPatternKey,
    value,
    onChange,
    disabled = false,
    className = ''
}) => {
    const [validationResult, setValidationResult] = useState(null);
    const [isValidating, setIsValidating] = useState(false);

    // Validate path whenever it changes
    useEffect(() => {
        const validateCurrentPath = async () => {
            if (!pathPatternKey || !value) {
                setValidationResult(null);
                return;
            }

            setIsValidating(true);
            try {
                const result = await validatePathPattern(pathPatternKey, value);
                setValidationResult(result);
            } catch (error) {
                setValidationResult({
                    valid: false,
                    error: 'Validation failed'
                });
            } finally {
                setIsValidating(false);
            }
        };

        // Debounce validation
        const timeoutId = setTimeout(validateCurrentPath, 300);
        return () => clearTimeout(timeoutId);
    }, [pathPatternKey, value]);

    const handleChange = (e) => {
        onChange(e.target.value);
    };

    // Don't render if no pattern is set
    if (!pathPatternKey) {
        return null;
    }

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Path Input */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preview Path
                </label>
                <div className="relative">
                    <input
                        type="text"
                        value={value || ''}
                        onChange={handleChange}
                        disabled={disabled}
                        placeholder="Enter path to preview (e.g., my-article/)"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                    {/* Validation Icon */}
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        {isValidating ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        ) : validationResult?.valid ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : validationResult?.valid === false ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                        ) : null}
                    </div>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                    Simulate different URL paths to preview extracted variables
                </div>
            </div>

            {/* Validation Results */}
            {validationResult && (
                <div className={`rounded-md p-4 ${validationResult.valid
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                    {validationResult.valid ? (
                        <>
                            <div className="flex items-center mb-2">
                                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                                <div className="text-sm font-semibold text-green-900" role="heading" aria-level="4">
                                    Path Valid
                                </div>
                            </div>
                            {validationResult.variables && Object.keys(validationResult.variables).length > 0 && (
                                <div className="mt-3">
                                    <div className="text-xs font-medium text-green-900 mb-2">
                                        Extracted Variables:
                                    </div>
                                    <div className="bg-white border border-green-200 rounded overflow-hidden">
                                        <table className="min-w-full divide-y divide-green-200">
                                            <thead className="bg-green-100">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-green-900 uppercase tracking-wider">
                                                        Variable
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-green-900 uppercase tracking-wider">
                                                        Value
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-green-100">
                                                {Object.entries(validationResult.variables).map(([key, value]) => (
                                                    <tr key={key} className="hover:bg-green-50">
                                                        <td className="px-3 py-2 text-sm font-mono text-gray-900">
                                                            {key}
                                                        </td>
                                                        <td className="px-3 py-2 text-sm font-mono text-gray-700">
                                                            {value}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="mt-2 text-xs text-green-700">
                                        These variables are available to widgets as <code className="px-1 py-0.5 bg-green-100 rounded">context.pathVariables</code>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="flex items-center">
                                <XCircle className="h-5 w-5 text-red-600 mr-2" />
                                <div>
                                    <div className="text-sm font-semibold text-red-900" role="heading" aria-level="4">
                                        Invalid Path
                                    </div>
                                    <div className="text-sm text-red-700 mt-1">
                                        {validationResult.error || 'Path does not match the selected pattern'}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Info Box when no validation yet */}
            {!validationResult && value && !isValidating && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-700">
                            Enter a path to validate it against the selected pattern
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PathPreviewInput;

