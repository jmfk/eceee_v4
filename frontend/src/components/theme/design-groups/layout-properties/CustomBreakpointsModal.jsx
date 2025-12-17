/**
 * Custom Breakpoints Modal
 * 
 * Modal dialog for managing custom breakpoints:
 * - Add new custom breakpoints
 * - Edit existing custom breakpoints
 * - Remove custom breakpoints
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Check } from 'lucide-react';

const CustomBreakpointsModal = ({
    isOpen,
    onClose,
    partProps,
    breakpoints,
    onAddBreakpoint,
    onRemoveBreakpoint,
    onUpdateBreakpoint,
    groupIndex,
    part,
}) => {
    const [newBreakpoint, setNewBreakpoint] = useState('');
    const [error, setError] = useState('');
    const [editingBreakpoint, setEditingBreakpoint] = useState(null);
    const [editValue, setEditValue] = useState('');

    // Get all custom breakpoints (numeric strings)
    const customBreakpoints = Object.keys(partProps || {})
        .filter(bp => !isNaN(bp) && bp !== 'default')
        .sort((a, b) => parseInt(a) - parseInt(b));

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setNewBreakpoint('');
            setError('');
            setEditingBreakpoint(null);
            setEditValue('');
        }
    }, [isOpen]);

    // Validate breakpoint value
    const validateBreakpoint = (value, excludeCurrent = null) => {
        const numValue = parseInt(value);
        
        if (!value || value.trim() === '') {
            return 'Please enter a value';
        }
        
        if (isNaN(numValue) || numValue <= 0) {
            return 'Must be a positive number';
        }
        
        if (numValue < 1 || numValue > 9999) {
            return 'Must be between 1 and 9999';
        }
        
        // Check for duplicates
        const existing = customBreakpoints.filter(bp => bp !== excludeCurrent);
        if (existing.includes(value)) {
            return 'Breakpoint already exists';
        }
        
        // Check if it conflicts with theme breakpoint values
        const themeValues = Object.values(breakpoints);
        if (themeValues.includes(numValue)) {
            return 'Conflicts with standard breakpoint';
        }
        
        return null;
    };

    // Handle adding new breakpoint
    const handleAdd = () => {
        const validationError = validateBreakpoint(newBreakpoint);
        
        if (validationError) {
            setError(validationError);
            return;
        }
        
        onAddBreakpoint(newBreakpoint);
        setNewBreakpoint('');
        setError('');
    };

    // Handle starting edit
    const handleStartEdit = (bp) => {
        setEditingBreakpoint(bp);
        setEditValue(bp);
        setError('');
    };

    // Handle saving edit
    const handleSaveEdit = () => {
        if (editValue === editingBreakpoint) {
            // No change
            setEditingBreakpoint(null);
            setEditValue('');
            return;
        }

        const validationError = validateBreakpoint(editValue, editingBreakpoint);
        
        if (validationError) {
            setError(validationError);
            return;
        }
        
        onUpdateBreakpoint(editingBreakpoint, editValue);
        setEditingBreakpoint(null);
        setEditValue('');
        setError('');
    };

    // Handle cancel edit
    const handleCancelEdit = () => {
        setEditingBreakpoint(null);
        setEditValue('');
        setError('');
    };

    // Handle remove
    const handleRemove = (bp) => {
        const hasProperties = partProps[bp] && Object.keys(partProps[bp]).length > 0;
        
        if (hasProperties) {
            if (window.confirm(`This breakpoint has ${Object.keys(partProps[bp]).length} properties. Remove it?`)) {
                onRemoveBreakpoint(bp);
            }
        } else {
            onRemoveBreakpoint(bp);
        }
    };

    // Handle Enter key
    const handleKeyDown = (e, action) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            action();
        } else if (e.key === 'Escape') {
            if (editingBreakpoint) {
                handleCancelEdit();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black bg-opacity-50"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Custom Breakpoints
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {/* Add New Breakpoint */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Add New Breakpoint (pixels)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newBreakpoint}
                                onChange={(e) => {
                                    setNewBreakpoint(e.target.value);
                                    setError('');
                                }}
                                onKeyDown={(e) => handleKeyDown(e, handleAdd)}
                                placeholder="e.g., 500, 1440"
                                className={`flex-1 px-3 py-2 text-sm border rounded-md ${
                                    error && !editingBreakpoint ? 'border-red-500' : 'border-gray-300'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            />
                            <button
                                onClick={handleAdd}
                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                            >
                                <Plus size={16} />
                                Add
                            </button>
                        </div>
                        {error && !editingBreakpoint && (
                            <p className="mt-1 text-sm text-red-600">{error}</p>
                        )}
                    </div>

                    {/* Existing Custom Breakpoints */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Existing Custom Breakpoints
                        </label>
                        
                        {customBreakpoints.length === 0 ? (
                            <p className="text-sm text-gray-500 italic py-4 text-center">
                                No custom breakpoints yet. Add one above.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {customBreakpoints.map(bp => (
                                    <div 
                                        key={bp}
                                        className="flex items-center gap-2 p-3 bg-gray-50 rounded-md border border-gray-200"
                                    >
                                        {editingBreakpoint === bp ? (
                                            <>
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => {
                                                        setEditValue(e.target.value);
                                                        setError('');
                                                    }}
                                                    onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                                                    className={`flex-1 px-2 py-1 text-sm border rounded ${
                                                        error ? 'border-red-500' : 'border-gray-300'
                                                    } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={handleSaveEdit}
                                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                    title="Save"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                                    title="Cancel"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex-1">
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {bp}px
                                                    </span>
                                                    {partProps[bp] && Object.keys(partProps[bp]).length > 0 && (
                                                        <span className="ml-2 text-xs text-gray-500">
                                                            ({Object.keys(partProps[bp]).length} {Object.keys(partProps[bp]).length === 1 ? 'property' : 'properties'})
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleStartEdit(bp)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title="Edit breakpoint value"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleRemove(bp)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Remove breakpoint"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {error && editingBreakpoint && (
                            <p className="mt-2 text-sm text-red-600">{error}</p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomBreakpointsModal;

