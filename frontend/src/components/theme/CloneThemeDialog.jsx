import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const CloneThemeDialog = ({ isOpen, onClose, onConfirm, themeName, existingNames = [] }) => {
    const [newName, setNewName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && themeName) {
            // Pre-fill with "{original name} (Copy)"
            const defaultName = `${themeName} (Copy)`;
            let finalName = defaultName;
            let counter = 1;

            // Find unique name
            while (existingNames.includes(finalName)) {
                counter++;
                finalName = `${themeName} (Copy ${counter})`;
            }

            setNewName(finalName);
            setError('');
        }
    }, [isOpen, themeName, existingNames]);

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validation
        if (!newName.trim()) {
            setError('Theme name is required');
            return;
        }

        if (existingNames.includes(newName)) {
            setError('A theme with this name already exists');
            return;
        }

        onConfirm(newName);
        onClose();
    };

    const handleNameChange = (e) => {
        setNewName(e.target.value);
        if (error) setError('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Clone Theme</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="px-6 py-4">
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-4">
                                Create a copy of <span className="font-semibold">{themeName}</span>
                            </p>

                            <label htmlFor="themeName" className="block text-sm font-medium text-gray-700 mb-2">
                                New Theme Name
                            </label>
                            <input
                                id="themeName"
                                type="text"
                                value={newName}
                                onChange={handleNameChange}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    error ? 'border-red-300' : 'border-gray-300'
                                }`}
                                placeholder="Enter theme name"
                                autoFocus
                            />
                            {error && (
                                <p className="mt-2 text-sm text-red-600">{error}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Clone Theme
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CloneThemeDialog;

