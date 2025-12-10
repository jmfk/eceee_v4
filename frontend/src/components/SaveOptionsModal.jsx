import React, { useState } from 'react';
import { X, Save, Plus, GitBranch } from 'lucide-react';

/**
 * SaveOptionsModal - Allows users to choose save strategy
 * 
 * Options:
 * 1. Update Current Version - Modifies existing draft version
 * 2. Save as New Version - Creates new version with optional description
 */
const SaveOptionsModal = ({
    isOpen,
    onClose,
    onSave,
    currentVersion,
    isNewPage = false
}) => {
    const [saveOption, setSaveOption] = useState('update'); // 'update' or 'new'
    const [versionDescription, setVersionDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await onSave({
                option: saveOption,
                description: versionDescription || undefined
            });
            onClose();
        } catch (error) {
            console.error('Save failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setSaveOption('update');
            setVersionDescription('');
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="2">
                        Save Options
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Current Version Info */}
                    {currentVersion && !isNewPage && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                            <div className="text-sm text-blue-800">
                                <span className="font-bold">Current Version:</span> v{currentVersion.versionNumber}
                                {currentVersion.description && (
                                    <div className="text-blue-600 mt-1">
                                        "{currentVersion.description}"
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Save Options */}
                    <div className="space-y-3">
                        {/* Update Current Version */}
                        {!isNewPage && (
                            <label className="flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50">
                                <input
                                    type="radio"
                                    name="saveOption"
                                    value="update"
                                    checked={saveOption === 'update'}
                                    onChange={(e) => setSaveOption(e.target.value)}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <Save className="w-4 h-4 text-blue-600" />
                                        <span className="font-medium text-gray-900">
                                            Update Current Version
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        Modify the existing version v{currentVersion?.versionNumber || '?'}.
                                        Changes will overwrite current content.
                                    </div>
                                </div>
                            </label>
                        )}

                        {/* Save as New Version */}
                        <label className="flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50">
                            <input
                                type="radio"
                                name="saveOption"
                                value="new"
                                checked={saveOption === 'new' || isNewPage}
                                onChange={(e) => setSaveOption(e.target.value)}
                                className="mt-1"
                                disabled={isNewPage}
                            />
                            <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                    <Plus className="w-4 h-4 text-green-600" />
                                    <span className="font-medium text-gray-900">
                                        Save as New Version
                                    </span>
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                    Create a new version preserving the current one.
                                    Good for major changes or experiments.
                                </div>
                            </div>
                        </label>
                    </div>

                    {/* Version Description (for new versions) */}
                    {(saveOption === 'new' || isNewPage) && (
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Version Description (Optional)
                            </label>
                            <input
                                type="text"
                                value={versionDescription}
                                onChange={(e) => setVersionDescription(e.target.value)}
                                placeholder="Describe what changed in this version..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isLoading}
                            />
                            <div className="text-xs text-gray-500 mt-1">
                                Help others understand what's new in this version
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-center space-x-3 p-6 border-t bg-gray-50">
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center space-x-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                {saveOption === 'update' ? (
                                    <Save className="w-4 h-4" />
                                ) : (
                                    <GitBranch className="w-4 h-4" />
                                )}
                                <span>
                                    {saveOption === 'update' ? 'Update Version' : 'Create Version'}
                                </span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SaveOptionsModal;