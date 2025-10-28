/**
 * MetadataConfirmationStep - Confirm page title and tags before importing
 * This is a step within the import dialog, not a separate modal
 */

import React, { useState, useEffect } from 'react';
import { Tag, Edit2, Check, Plus } from 'lucide-react';

const MetadataConfirmationStep = ({
    metadata,
    onTitleChange,
    onTagsChange,
    onSaveToPageChange,
}) => {
    const [editedTitle, setEditedTitle] = useState(metadata?.title || '');
    const [tagSelections, setTagSelections] = useState({});
    const [customTagInput, setCustomTagInput] = useState('');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [customTags, setCustomTags] = useState([]);
    const [saveToPage, setSaveToPage] = useState(false); // Default OFF

    // Initialize tag selections (all checked by default)
    useEffect(() => {
        if (metadata?.suggestedTags) {
            const selections = {};
            metadata.suggestedTags.forEach((tag) => {
                selections[tag.name] = true; // All checked by default
            });
            setTagSelections(selections);
        }
    }, [metadata]);

    // Update parent when title changes
    useEffect(() => {
        if (onTitleChange) {
            onTitleChange(editedTitle);
        }
    }, [editedTitle, onTitleChange]);

    // Update parent when tag selections change
    useEffect(() => {
        const selectedTagNames = [
            ...Object.entries(tagSelections)
                .filter(([_, isSelected]) => isSelected)
                .map(([name, _]) => name),
            ...customTags,
        ];
        if (onTagsChange) {
            onTagsChange(selectedTagNames);
        }
    }, [tagSelections, customTags, onTagsChange]);

    // Update parent when saveToPage changes
    useEffect(() => {
        if (onSaveToPageChange) {
            onSaveToPageChange(saveToPage);
        }
    }, [saveToPage, onSaveToPageChange]);

    const handleToggleTag = (tagName) => {
        setTagSelections((prev) => ({
            ...prev,
            [tagName]: !prev[tagName],
        }));
    };

    const handleAddCustomTag = () => {
        const trimmed = customTagInput.trim();
        if (trimmed && !customTags.includes(trimmed)) {
            setCustomTags([...customTags, trimmed]);
            setCustomTagInput('');
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCustomTag();
        }
    };

    const handleRemoveCustomTag = (tagName) => {
        setCustomTags(customTags.filter((t) => t !== tagName));
    };

    const suggestedTags = metadata?.suggestedTags || [];
    const confidence = metadata?.confidence || 0;

    return (
        <div className="space-y-6">
            {/* Save to Page Checkbox */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={saveToPage}
                        onChange={(e) => setSaveToPage(e.target.checked)}
                        className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                        <div className="font-medium text-gray-900">
                            Save title and tags to page
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                            When enabled, the page title and tags will be saved to the database.
                            Unchecked by default - metadata is only used for imported content and images.
                        </div>
                    </div>
                </label>
            </div>

            {/* Page Title */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Page Title
                </label>
                {isEditingTitle ? (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter page title"
                            autoFocus
                        />
                        <button
                            onClick={() => setIsEditingTitle(false)}
                            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            <Check className="w-5 h-5" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                        <span className="text-gray-900">{editedTitle || '(No title)'}</span>
                        <button
                            onClick={() => setIsEditingTitle(true)}
                            className="text-blue-600 hover:text-blue-700 transition-colors"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Tags Section */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">
                        Suggested Tags
                    </label>
                    {confidence > 0 && (
                        <span className="text-xs text-gray-500">
                            AI Confidence: {Math.round(confidence * 100)}%
                        </span>
                    )}
                </div>

                {/* Suggested Tags with Checkboxes */}
                {suggestedTags.length > 0 ? (
                    <div className="mb-4">
                        <div className="space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                            {suggestedTags.map((tag) => {
                                const isSelected = tagSelections[tag.name] || false;
                                return (
                                    <label
                                        key={tag.name}
                                        className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleTag(tag.name)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <div className="flex-1 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Tag className="w-4 h-4 text-gray-500" />
                                                <span className="text-sm font-medium text-gray-900">
                                                    {tag.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {tag.exists ? (
                                                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                                        Existing ({tag.usageCount} uses)
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                        New
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                        No tags suggested by AI. You can add custom tags below.
                    </div>
                )}

                {/* Custom Tags List */}
                {customTags.length > 0 && (
                    <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">Custom Tags Added:</p>
                        <div className="flex flex-wrap gap-2">
                            {customTags.map((tagName) => (
                                <span
                                    key={tagName}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-700 border border-purple-300"
                                >
                                    <Tag className="w-3.5 h-3.5" />
                                    {tagName}
                                    <button
                                        onClick={() => handleRemoveCustomTag(tagName)}
                                        className="ml-1 text-purple-600 hover:text-purple-800 font-bold"
                                        title="Remove custom tag"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add Custom Tag */}
                <div>
                    <p className="text-xs text-gray-500 mb-2">Add Custom Tag:</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={customTagInput}
                            onChange={(e) => setCustomTagInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Enter tag name"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <button
                            onClick={handleAddCustomTag}
                            disabled={!customTagInput.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add
                        </button>
                    </div>
                </div>
            </div>

            {/* AI Reasoning */}
            {metadata?.reasoning && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <p className="text-xs font-medium text-blue-900 mb-1">AI Analysis:</p>
                    <p className="text-sm text-blue-700">{metadata.reasoning}</p>
                </div>
            )}
        </div>
    );
};

export default MetadataConfirmationStep;

