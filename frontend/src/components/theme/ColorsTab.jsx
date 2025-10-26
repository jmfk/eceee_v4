/**
 * Colors Tab Component (Simplified Working Version)
 */

import React, { useState } from 'react';
import { Plus, Trash2, Palette } from 'lucide-react';

const ColorsTab = ({ colors, onChange }) => {
  const [newColorName, setNewColorName] = useState('');
  const [newColorValue, setNewColorValue] = useState('#000000');

  const colorEntries = Object.entries(colors || {});

  const handleAddColor = () => {
    if (!newColorName.trim()) return;

    const colorKey = newColorName.trim().toLowerCase().replace(/\s+/g, '-');

    const updatedColors = {
      ...colors,
      [colorKey]: newColorValue,
    };

    onChange(updatedColors);
    setNewColorName('');
    setNewColorValue('#000000');
  };

  const handleUpdateColor = (name, value) => {
    const updatedColors = {
      ...colors,
      [name]: value,
    };
    onChange(updatedColors);
  };

  const handleRenameColor = (oldName, newName) => {
    if (!newName.trim() || oldName === newName) return;

    const colorKey = newName.trim().toLowerCase().replace(/\s+/g, '-');

    // Check if new name already exists
    if (colors[colorKey] && colorKey !== oldName) {
      alert('A color with this name already exists');
      return;
    }

    const updatedColors = { ...colors };
    const colorValue = updatedColors[oldName];
    delete updatedColors[oldName];
    updatedColors[colorKey] = colorValue;

    onChange(updatedColors);
  };

  const handleRemoveColor = (name) => {
    const updatedColors = { ...colors };
    delete updatedColors[name];
    onChange(updatedColors);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Named Colors</h3>
      </div>

      {/* Add Color Form */}
      <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-4">
        <h4 className="font-semibold text-gray-900">Add Color</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color Name
            </label>
            <input
              type="text"
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              placeholder="e.g., primary"
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
                className="h-10 w-16 rounded border border-gray-300"
              />
              <input
                type="text"
                value={newColorValue}
                onChange={(e) => setNewColorValue(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddColor}
          disabled={!newColorName.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="w-4 h-4 inline mr-2" />
          Add Color
        </button>
      </div>

      {/* Colors List */}
      {colorEntries.length > 0 ? (
        <div className="space-y-2">
          {colorEntries.map(([name, value]) => (
            <div
              key={name}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3"
            >
              <div
                className="w-10 h-10 rounded border border-gray-300"
                style={{ backgroundColor: value }}
              />
              <input
                type="text"
                value={name}
                onBlur={(e) => handleRenameColor(name, e.target.value)}
                className="flex-1 px-2 py-1 font-medium text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <input
                  type="color"
                  value={value}
                  onChange={(e) => handleUpdateColor(name, e.target.value)}
                  className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
                  title="Pick color"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handleUpdateColor(name, e.target.value)}
                  className="w-24 px-2 py-1 text-sm border border-gray-300 rounded"
                  placeholder="#000000"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveColor(name)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <Palette className="w-12 h-12 mx-auto text-gray-400 mb-2" />
          <p className="text-gray-500">No colors defined yet.</p>
        </div>
      )}
    </div>
  );
};

export default ColorsTab;

