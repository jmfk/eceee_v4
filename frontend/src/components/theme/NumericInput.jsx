/**
 * Numeric Input with Units Component
 * 
 * Input with up/down buttons, unit selector, and keyword options.
 */

import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const NumericInput = ({
    value,
    onChange,
    units = ['rem', 'px', 'em', '%'],
    keywords = [],
    placeholder = '0',
    step = 0.1,
    min,
    max,
    allowUnitless = false,
}) => {
    const [mode, setMode] = useState('numeric'); // 'numeric' or 'keyword'
    const [numericValue, setNumericValue] = useState('1');
    const [unit, setUnit] = useState('rem');
    const [keyword, setKeyword] = useState('');

    // Parse current value on mount and when it changes externally
    useEffect(() => {
        if (!value) {
            setMode('numeric');
            setNumericValue('');
            setUnit(units[0] || 'rem');
            return;
        }

        const strValue = String(value);

        // Check if it's a keyword
        if (keywords.includes(strValue)) {
            setMode('keyword');
            setKeyword(strValue);
            return;
        }

        // Parse numeric value with unit
        const match = strValue.match(/^([-\d.]+)(.*)$/);
        if (match) {
            const [, num, u] = match;
            setMode('numeric');
            setNumericValue(num);
            setUnit(u || (allowUnitless ? '' : (units[0] || 'rem')));
        } else {
            setMode('numeric');
            setNumericValue('');
            setUnit(units[0] || 'rem');
        }
    }, [value, keywords, units, allowUnitless]);

    const handleNumericChange = (newValue, newUnit) => {
        if (newValue === '') {
            onChange('');
            return;
        }

        const fullValue = newUnit ? `${newValue}${newUnit}` : newValue;
        onChange(fullValue);
    };

    const handleIncrement = () => {
        const current = parseFloat(numericValue) || 0;
        const newValue = (current + step).toFixed(2);
        setNumericValue(newValue);
        handleNumericChange(newValue, unit);
    };

    const handleDecrement = () => {
        const current = parseFloat(numericValue) || 0;
        let newValue = current - step;

        if (min !== undefined && newValue < min) {
            newValue = min;
        }

        const finalValue = newValue.toFixed(2);
        setNumericValue(finalValue);
        handleNumericChange(finalValue, unit);
    };

    const handleKeywordChange = (newKeyword) => {
        setKeyword(newKeyword);
        onChange(newKeyword);
    };

    return (
        <div className="space-y-2">
            {/* Mode Toggle */}
            {keywords.length > 0 && (
                <div className="flex gap-2 text-xs">
                    <label className="inline-flex items-center cursor-pointer">
                        <input
                            type="radio"
                            checked={mode === 'numeric'}
                            onChange={() => setMode('numeric')}
                            className="mr-1 h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700">Numeric</span>
                    </label>
                    <label className="inline-flex items-center cursor-pointer">
                        <input
                            type="radio"
                            checked={mode === 'keyword'}
                            onChange={() => setMode('keyword')}
                            className="mr-1 h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700">Keyword</span>
                    </label>
                </div>
            )}

            {/* Numeric Mode */}
            {mode === 'numeric' ? (
                <div className="flex gap-1">
                    {/* Number Input */}
                    <input
                        type="text"
                        value={numericValue}
                        onChange={(e) => {
                            setNumericValue(e.target.value);
                            handleNumericChange(e.target.value, unit);
                        }}
                        placeholder={placeholder}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    {/* Up/Down Buttons */}
                    <div className="flex flex-col">
                        <button
                            type="button"
                            onClick={handleIncrement}
                            className="px-1.5 py-0.5 border border-gray-300 border-b-0 rounded-t hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <ChevronUp className="w-3 h-3 text-gray-600" />
                        </button>
                        <button
                            type="button"
                            onClick={handleDecrement}
                            className="px-1.5 py-0.5 border border-gray-300 rounded-b hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <ChevronDown className="w-3 h-3 text-gray-600" />
                        </button>
                    </div>

                    {/* Unit Selector */}
                    {units.length > 0 && (
                        <select
                            value={unit}
                            onChange={(e) => {
                                setUnit(e.target.value);
                                handleNumericChange(numericValue, e.target.value);
                            }}
                            className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {allowUnitless && <option value="">-</option>}
                            {units.map((u) => (
                                <option key={u} value={u}>
                                    {u}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            ) : (
                /* Keyword Mode */
                <div className="flex flex-wrap gap-2">
                    {keywords.map((kw) => (
                        <label
                            key={kw}
                            className="inline-flex items-center cursor-pointer"
                        >
                            <input
                                type="radio"
                                checked={keyword === kw}
                                onChange={() => handleKeywordChange(kw)}
                                className="mr-1 h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{kw}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NumericInput;

