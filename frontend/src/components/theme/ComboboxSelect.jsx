/**
 * Combobox Select Component
 * 
 * Searchable select component using Headless UI for font/color selection.
 */

import React, { useState, Fragment } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';

const ComboboxSelect = ({
    value,
    onChange,
    options = [],
    placeholder = 'Select an option',
    displayValue = (option) => option?.label || option?.value || '',
    filterFunction = null,
    renderOption = null,
    allowCustom = false,
    className = '',
}) => {
    const [query, setQuery] = useState('');

    // Find the selected option object
    const selectedOption = options.find(opt =>
        (opt.value === value) || (typeof opt === 'string' && opt === value)
    );

    // Filter options based on query
    const filteredOptions =
        query === ''
            ? options
            : filterFunction
                ? options.filter(opt => filterFunction(opt, query))
                : options.filter((opt) => {
                    const searchValue = typeof opt === 'string' ? opt : (opt.label || opt.value || '');
                    return searchValue.toLowerCase().includes(query.toLowerCase());
                });

    const handleChange = (newValue) => {
        if (typeof newValue === 'string') {
            onChange(newValue);
        } else {
            onChange(newValue?.value || newValue);
        }
    };

    return (
        <Combobox value={selectedOption || value} onChange={handleChange}>
            <div className={`relative ${className}`}>
                <div className="relative">
                    <Combobox.Input
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        displayValue={(selected) => {
                            if (!selected) return '';
                            if (typeof selected === 'string') return selected;
                            return displayValue(selected);
                        }}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={placeholder}
                    />
                    <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    </Combobox.Button>
                </div>

                <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                    afterLeave={() => setQuery('')}
                >
                    <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        {filteredOptions.length === 0 && query !== '' ? (
                            <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                                {allowCustom ? (
                                    <div>
                                        No matches found.
                                        <button
                                            onClick={() => {
                                                onChange(query);
                                                setQuery('');
                                            }}
                                            className="ml-2 text-blue-600 hover:text-blue-700"
                                        >
                                            Use "{query}"
                                        </button>
                                    </div>
                                ) : (
                                    'No matches found.'
                                )}
                            </div>
                        ) : (
                            filteredOptions.map((option, idx) => (
                                <Combobox.Option
                                    key={typeof option === 'string' ? option : option.value || idx}
                                    className={({ active }) =>
                                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-900'
                                        }`
                                    }
                                    value={option}
                                >
                                    {({ selected, active }) => (
                                        <>
                                            {renderOption ? (
                                                renderOption(option, { selected, active })
                                            ) : (
                                                <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                                    {typeof option === 'string' ? option : displayValue(option)}
                                                </span>
                                            )}
                                            {selected ? (
                                                <span
                                                    className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-blue-600'
                                                        }`}
                                                >
                                                    <Check className="h-4 w-4" aria-hidden="true" />
                                                </span>
                                            ) : null}
                                        </>
                                    )}
                                </Combobox.Option>
                            ))
                        )}
                    </Combobox.Options>
                </Transition>
            </div>
        </Combobox>
    );
};

export default ComboboxSelect;

