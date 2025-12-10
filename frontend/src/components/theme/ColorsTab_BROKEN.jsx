/**
 * Colors Tab Component
 * 
 * Named color palette editor with color pickers.
 */

import React, { useState } from 'react';
import { Plus, Trash2, Palette, FileJson, FileCode, Eye } from 'lucide-react';
import { isValidColor, generateColorsCSS } from '../../utils/themeUtils';
import CodeEditorPanel from './CodeEditorPanel';

const ColorsTab = ({ colors, onChange }) => {
    const [newColorName, setNewColorName] = useState('');
    const [newColorValue, setNewColorValue] = useState('#000000');
    const [showAddColor, setShowAddColor] = useState(false);
    const [viewMode, setViewMode] = useState('visual'); // 'visual', 'json', 'css'

    const colorEntries = Object.entries(colors || {});

    const handleAddColor = () => {
        if (!newColorName.trim() || !isValidColor(newColorValue)) {
            return;
        }

        // Convert spaces to hyphens and lowercase
        const colorKey = newColorName.trim().toLowerCase().replace(/\s+/g, '-');

        const updatedColors = {
            ...colors,
            [colorKey]: newColorValue,
        };

        onChange(updatedColors);
        setNewColorName('');
        setNewColorValue('#000000');
        setShowAddColor(false);
    };

    const handleUpdateColor = (name, value) => {
        const updatedColors = {
            ...colors,
            [name]: value,
        };
        onChange(updatedColors);
    };

    const handleRemoveColor = (name) => {
        const updatedColors = { ...colors };
        delete updatedColors[name];
        onChange(updatedColors);
    };

    const handleRenameColor = (oldName, newName) => {
        if (oldName === newName || !newName.trim()) return;

        const colorKey = newName.trim().toLowerCase().replace(/\s+/g, '-');

        // Check if new name already exists
        if (colors[colorKey] && colorKey !== oldName) {
            alert('A color with this name already exists');
            return;
        }

        const updatedColors = {};
        Object.entries(colors).forEach(([key, value]) => {
            if (key === oldName) {
                updatedColors[colorKey] = value;
            } else {
                updatedColors[key] = value;
            }
        });

        onChange(updatedColors);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Named Colors</div>
                <div className="flex gap-2">
                    {/* View Mode Toggle */}
                    <div className="inline-flex rounded-md shadow-sm" role="group">
                        <button
                            type="button"
                            onClick={() => setViewMode('visual')}
                            className={`px-3 py-2 text-xs font-medium border ${viewMode === 'visual'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                } rounded-l-md`}
                        >
                            <Eye className="w-3 h-3 inline mr-1" />
                            Visual
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('json')}
                            className={`px-3 py-2 text-xs font-medium border-t border-b ${viewMode === 'json'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <FileJson className="w-3 h-3 inline mr-1" />
                            JSON
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('css')}
                            className={`px-3 py-2 text-xs font-medium border ${viewMode === 'css'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                } rounded-r-md`}
                        >
                            <FileCode className="w-3 h-3 inline mr-1" />
                            CSS
                        </button>
                    </div>

                    {viewMode === 'visual' && (
                        <button
                            type="button"
                            onClick={() => setShowAddColor(!showAddColor)}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Color
                        </button>
                    )}
                </div>
            </div>

            <div className="text-sm text-gray-600">
                Define named colors that can be referenced throughout your theme.
                Use these in typography, component styles, and custom CSS.
            </div>

            {/* JSON/CSS Editor Modes */}
            {viewMode === 'json' && (
                <CodeEditorPanel
                    data={colors || {}}
                    onChange={onChange}
                    mode="json"
                    label="Colors JSON"
                />
            )}

            {viewMode === 'css' && (
                <CodeEditorPanel
                    data={colors || {}}
                    mode="css"
                    label="CSS Variables Preview"
                    readOnly={true}
                    generateCSS={(data) => generateColorsCSS(data, ':root')}
                />
            )}

            {/* Visual Editor Mode */}
            {viewMode === 'visual' && (
                <>
                    {/* Add Color Panel */}
                    {showAddColor && (
                        <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-4">
                            <div className="font-semibold text-gray-900" role="heading" aria-level="4">Add New Color</div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Color Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newColorName}
                                        onChange={(e) => setNewColorName(e.target.value)}
                                        placeholder="e.g., primary, accent, text-dark"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Color Value
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={newColorValue}
                                            onChange={(e) => setNewColorValue(e.target.value)}
                                            className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={newColorValue}
                                            onChange={(e) => setNewColorValue(e.target.value)}
                                            placeholder="#000000"
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleAddColor}
                                    disabled={!newColorName.trim() || !isValidColor(newColorValue)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Add Color
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddColor(false);
                                        setNewColorName('');
                                        setNewColorValue('#000000');
                                    }}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Colors List */}
                    {colorEntries.length > 0 ? (
                        <div className="space-y-2">
                            {colorEntries.map(([name, value]) => (
                                <ColorRow
                                    key={name}
                                    name={name}
                                    value={value}
                                    onUpdate={(newValue) => handleUpdateColor(name, newValue)}
                                    onRename={(newName) => handleRenameColor(name, newName)}
                                    onRemove={() => handleRemoveColor(name)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                            <Palette className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                            <div className="text-gray-500">
                                No colors defined yet. Click "Add Color" to create your color palette.
                            </div>
                        </div>
                    )}

                    {/* Color Preview */}
                    {colorEntries.length > 0 && (
                        <div>
                            <div className="text-sm font-medium text-gray-700 mb-3" role="heading" aria-level="4">Color Preview</div>
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                {colorEntries.map(([name, value]) => (
                                    <div key={name} className="text-center">
                                        <div
                                            className="w-full h-16 rounded-lg border border-gray-300 shadow-sm"
                                            style={{ backgroundColor: value }}
                                            title={`${name}: ${value}`}
                                        />
                                        <div className="mt-1 text-xs text-gray-600 truncate" title={name}>
                                            {name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// Color Row Component
const ColorRow = ({ name, value, onUpdate, onRename, onRemove }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(name);

    const handleNameBlur = () => {
        if (editedName !== name) {
            onRename(editedName);
        }
        setIsEditingName(false);
    };

    return (
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300">
            {/* Color Preview */}
            <div
                className="w-10 h-10 rounded border border-gray-300 flex-shrink-0"
                style={{ backgroundColor: value }}
            />

            {/* Color Name */}
            <div className="flex-1 min-w-0">
                {isEditingName ? (
                    <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onBlur={handleNameBlur}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleNameBlur();
                            if (e.key === 'Escape') {
                                setEditedName(name);
                                setIsEditingName(false);
                            }
                        }}
                        autoFocus
                        className="w-full px-2 py-1 text-sm font-medium border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                ) : (
                    <div
                        onClick={() => setIsEditingName(true)}
                        className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 truncate"
                        title="Click to rename"
                    >
                        {name}
                    </div>
                )}
            </div>

            {/* Color Value */}
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onUpdate(e.target.value)}
                    className="h-8 w-12 rounded border border-gray-300 cursor-pointer"
                />
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onUpdate(e.target.value)}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Remove Button */}
            <button
                type="button"
                onClick={onRemove}
                className="text-red-600 hover:text-red-700 flex-shrink-0"
                title="Remove color"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
};

export default ColorsTab;

