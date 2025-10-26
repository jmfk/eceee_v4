/**
 * Numeric Input - Number input with stepper controls and unit selector
 */

import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const CSS_UNITS = {
    length: ['px', 'em', 'rem', '%', 'vh', 'vw', 'pt'],
    time: ['s', 'ms'],
    none: [''],
};

const PROPERTY_UNITS = {
    fontSize: CSS_UNITS.length,
    lineHeight: [...CSS_UNITS.length, ''], // Can be unitless
    letterSpacing: CSS_UNITS.length,
    margin: CSS_UNITS.length,
    marginTop: CSS_UNITS.length,
    marginBottom: CSS_UNITS.length,
    marginLeft: CSS_UNITS.length,
    marginRight: CSS_UNITS.length,
    padding: CSS_UNITS.length,
    paddingTop: CSS_UNITS.length,
    paddingBottom: CSS_UNITS.length,
    paddingLeft: CSS_UNITS.length,
    paddingRight: CSS_UNITS.length,
    borderWidth: CSS_UNITS.length,
    borderRadius: CSS_UNITS.length,
    width: CSS_UNITS.length,
    height: CSS_UNITS.length,
    transition: CSS_UNITS.time,
};

const STEP_SIZES = {
    px: 1,
    em: 0.1,
    rem: 0.1,
    '%': 1,
    vh: 1,
    vw: 1,
    pt: 1,
    s: 0.1,
    ms: 50,
    '': 0.1,
};

const parseValue = (value) => {
    if (!value) return { number: '', unit: '' };
    const match = String(value).match(/^([-\d.]+)([a-z%]*)$/i);
    if (match) {
        return {
            number: match[1],
            unit: match[2] || '',
        };
    }
    return { number: value, unit: '' };
};

const NumericInput = ({ value, onChange, property, label, className = '' }) => {
    const { number, unit } = parseValue(value);
    const [numValue, setNumValue] = useState(number);
    const [unitValue, setUnitValue] = useState(unit);

    const availableUnits = PROPERTY_UNITS[property] || CSS_UNITS.length;
    const step = STEP_SIZES[unitValue] || 1;

    useEffect(() => {
        const parsed = parseValue(value);
        setNumValue(parsed.number);
        setUnitValue(parsed.unit);
    }, [value]);

    const handleNumberChange = (newNumber) => {
        setNumValue(newNumber);
        if (newNumber === '') {
            onChange('');
        } else {
            onChange(`${newNumber}${unitValue}`);
        }
    };

    const handleUnitChange = (newUnit) => {
        setUnitValue(newUnit);
        if (numValue !== '') {
            onChange(`${numValue}${newUnit}`);
        }
    };

    const increment = () => {
        const current = parseFloat(numValue) || 0;
        const newValue = (current + step).toFixed(step < 1 ? 1 : 0);
        handleNumberChange(newValue);
    };

    const decrement = () => {
        const current = parseFloat(numValue) || 0;
        const newValue = (current - step).toFixed(step < 1 ? 1 : 0);
        handleNumberChange(newValue);
    };

    return (
        <div className={className}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}

            <div className="flex gap-1">
                {/* Number Input */}
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={numValue}
                        onChange={(e) => handleNumberChange(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {/* Stepper Buttons */}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col">
                        <button
                            type="button"
                            onClick={increment}
                            className="p-0.5 hover:bg-gray-100 rounded"
                        >
                            <ChevronUp className="w-3 h-3 text-gray-600" />
                        </button>
                        <button
                            type="button"
                            onClick={decrement}
                            className="p-0.5 hover:bg-gray-100 rounded"
                        >
                            <ChevronDown className="w-3 h-3 text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* Unit Selector */}
                {availableUnits.length > 1 && (
                    <select
                        value={unitValue}
                        onChange={(e) => handleUnitChange(e.target.value)}
                        className="px-2 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        {availableUnits.map((unit) => (
                            <option key={unit || 'none'} value={unit}>
                                {unit || '–'}
                            </option>
                        ))}
                    </select>
                )}
            </div>
        </div>
    );
};

export default NumericInput;

