/**
 * Breakpoints Tab Component
 * 
 * UI for editing theme breakpoint configuration.
 * Provides visual editor with validation for responsive breakpoints.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Monitor, Tablet, Smartphone, Tv, RotateCcw, AlertCircle } from 'lucide-react';
import { getBreakpoints } from '../../utils/themeUtils';

const BreakpointsTab = ({ breakpoints, onChange }) => {
    const currentBreakpoints = breakpoints || {};
    const effectiveBreakpoints = getBreakpoints({ breakpoints: currentBreakpoints });
    
    const [errors, setErrors] = useState({});
    const [inputValues, setInputValues] = useState({});
    const debounceTimerRef = useRef(null);

    const breakpointConfig = [
        {
            key: 'sm',
            label: 'Small (Mobile)',
            description: 'Small devices and mobile phones',
            icon: Smartphone,
            default: 640,
        },
        {
            key: 'md',
            label: 'Medium (Tablet)',
            description: 'Tablets and small laptops',
            icon: Tablet,
            default: 768,
        },
        {
            key: 'lg',
            label: 'Large (Desktop)',
            description: 'Desktops and large screens',
            icon: Monitor,
            default: 1024,
        },
        {
            key: 'xl',
            label: 'Extra Large',
            description: 'Large desktops and displays',
            icon: Tv,
            default: 1280,
        },
    ];

    const validateBreakpoints = useCallback((newBreakpoints) => {
        const validationErrors = {};
        const order = ['sm', 'md', 'lg', 'xl'];
        
        // Check each value is positive
        for (const key of order) {
            if (newBreakpoints[key] !== undefined) {
                if (!Number.isInteger(newBreakpoints[key]) || newBreakpoints[key] <= 0) {
                    validationErrors[key] = 'Must be a positive integer';
                }
            }
        }

        // Check ascending order
        for (let i = 0; i < order.length - 1; i++) {
            const curr = order[i];
            const next = order[i + 1];
            
            if (newBreakpoints[curr] !== undefined && newBreakpoints[next] !== undefined) {
                if (newBreakpoints[curr] >= newBreakpoints[next]) {
                    validationErrors[next] = `Must be greater than ${curr} (${newBreakpoints[curr]}px)`;
                }
            }
        }

        return validationErrors;
    }, []);

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const performValidation = useCallback((newInputValues) => {
        // Convert input values to numeric breakpoints
        const newBreakpoints = {};
        for (const key in newInputValues) {
            const numValue = newInputValues[key] === '' ? undefined : parseInt(newInputValues[key], 10);
            if (numValue !== undefined && !isNaN(numValue)) {
                newBreakpoints[key] = numValue;
            }
        }

        // Validate combined breakpoints
        const validationErrors = validateBreakpoints({ ...effectiveBreakpoints, ...newBreakpoints });
        setErrors(validationErrors);

        // If valid, update parent
        if (Object.keys(validationErrors).length === 0) {
            onChange(newBreakpoints);
        }
    }, [effectiveBreakpoints, validateBreakpoints, onChange]);

    const handleChange = useCallback((key, value) => {
        // Update input values immediately for responsive typing
        const newInputValues = { ...inputValues, [key]: value };
        
        // Handle empty value
        if (value === '') {
            const updated = { ...newInputValues };
            delete updated[key];
            setInputValues(updated);
        } else {
            setInputValues(newInputValues);
        }

        // Clear previous debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Set new debounce timer for validation
        debounceTimerRef.current = setTimeout(() => {
            performValidation(value === '' ? (() => {
                const updated = { ...newInputValues };
                delete updated[key];
                return updated;
            })() : newInputValues);
        }, 500);
    }, [inputValues, performValidation]);

    const handleBlur = useCallback((key) => {
        // Clear any pending debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Immediately validate on blur
        performValidation(inputValues);
    }, [inputValues, performValidation]);

    const handleReset = () => {
        setErrors({});
        setInputValues({});
        onChange({});
    };

    const isDefault = Object.keys(currentBreakpoints).length === 0;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Responsive Breakpoints</div>
                    <div className="text-sm text-gray-600 mt-1">
                        Configure responsive breakpoint values for this theme. Leave empty to use defaults.
                    </div>
                </div>
                <button
                    onClick={handleReset}
                    disabled={isDefault}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                        isDefault
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title="Reset to defaults"
                >
                    <RotateCcw className="w-4 h-4" />
                    Reset to Defaults
                </button>
            </div>

            {/* Breakpoint Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {breakpointConfig.map(({ key, label, description, icon: Icon, default: defaultValue }) => {
                    const value = effectiveBreakpoints[key];
                    const isCustom = currentBreakpoints[key] !== undefined;
                    const hasError = errors[key];

                    return (
                        <div
                            key={key}
                            className={`border rounded-lg p-4 transition-all ${
                                hasError
                                    ? 'border-red-300 bg-red-50'
                                    : isCustom
                                    ? 'border-blue-300 bg-blue-50'
                                    : 'border-gray-200 bg-white'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-md ${
                                    hasError ? 'bg-red-100' : isCustom ? 'bg-blue-100' : 'bg-gray-100'
                                }`}>
                                    <Icon className={`w-5 h-5 ${
                                        hasError ? 'text-red-600' : isCustom ? 'text-blue-600' : 'text-gray-600'
                                    }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="font-medium text-gray-900" role="heading" aria-level="4">{label}</div>
                                        {isCustom && !hasError && (
                                            <span className="text-xs text-blue-600 font-medium">Custom</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-600 mb-3">{description}</div>
                                    
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                value={inputValues[key] !== undefined ? inputValues[key] : (currentBreakpoints[key] || '')}
                                                onChange={(e) => handleChange(key, e.target.value)}
                                                onBlur={() => handleBlur(key)}
                                                placeholder={`${defaultValue}`}
                                                min="1"
                                                step="1"
                                                className={`w-full px-3 py-2 pr-10 border rounded-md text-sm transition-colors ${
                                                    hasError
                                                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                                                        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                                }`}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                                                px
                                            </span>
                                        </div>
                                    </div>

                                    {hasError && (
                                        <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
                                            <AlertCircle className="w-3 h-3" />
                                            {errors[key]}
                                        </div>
                                    )}

                                    {!hasError && !isCustom && (
                                        <div className="text-xs text-gray-500 mt-2">
                                            Using default: {defaultValue}px
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Visual Breakpoint Scale */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="text-sm font-medium text-gray-900 mb-3" role="heading" aria-level="4">Breakpoint Scale</div>
                <div className="relative">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                        <span>0px</span>
                        <span>{effectiveBreakpoints.xl}px+</span>
                    </div>
                    <div className="relative h-8 bg-gradient-to-r from-blue-200 via-blue-300 to-blue-400 rounded-md overflow-hidden">
                        {/* Breakpoint markers */}
                        {Object.keys(effectiveBreakpoints)
                            .sort((a, b) => effectiveBreakpoints[a] - effectiveBreakpoints[b])
                            .map((key) => {
                                const value = effectiveBreakpoints[key];
                                const maxValue = effectiveBreakpoints.xl;
                                const position = (value / maxValue) * 100;

                                return (
                                    <div
                                        key={key}
                                        className="absolute top-0 bottom-0 w-px bg-gray-700"
                                        style={{ left: `${position}%` }}
                                    >
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-gray-700 whitespace-nowrap">
                                            {key}: {value}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>

            {/* Help Text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                        <div className="font-medium mb-1">How Breakpoints Work</div>
                        <div className="space-y-1 text-blue-800" role="list">
                            <div className="flex items-start gap-2"><span className="text-blue-600">•</span><span>Breakpoints define max-width values for responsive media queries</span></div>
                            <div className="flex items-start gap-2"><span className="text-blue-600">•</span><span>Larger screens inherit styles from smaller breakpoints</span></div>
                            <div className="flex items-start gap-2"><span className="text-blue-600">•</span><span>Values must be in ascending order (sm &lt; md &lt; lg &lt; xl)</span></div>
                            <div className="flex items-start gap-2"><span className="text-blue-600">•</span><span>Leave fields empty to use theme defaults ({breakpointConfig.map(b => `${b.key}: ${b.default}px`).join(', ')})</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BreakpointsTab;

