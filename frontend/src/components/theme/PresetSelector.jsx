/**
 * Preset Selector Component
 * 
 * Reusable component for selecting and inserting pre-built style templates.
 * Displays a grid of preset cards with previews and descriptions.
 */

import React, { useState, useMemo } from 'react';
import { Search, Plus, Eye, X } from 'lucide-react';
import { getPresetsByCategory } from '../../constants/stylePresets';

const PresetSelector = ({
    categories = [],
    onInsert,
    onClose,
    className = ''
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(categories[0] || 'all');
    const [previewPreset, setPreviewPreset] = useState(null);
    const [insertMode, setInsertMode] = useState('replace'); // 'replace' or 'append'

    // Get all presets for selected categories
    const allPresets = useMemo(() => {
        if (selectedCategory === 'all') {
            return categories.flatMap(cat => getPresetsByCategory(cat));
        }
        return getPresetsByCategory(selectedCategory);
    }, [selectedCategory, categories]);

    // Filter presets by search term
    const filteredPresets = useMemo(() => {
        if (!searchTerm.trim()) return allPresets;

        const term = searchTerm.toLowerCase();
        return allPresets.filter(preset =>
            preset.name.toLowerCase().includes(term) ||
            preset.description.toLowerCase().includes(term)
        );
    }, [allPresets, searchTerm]);

    const handleInsert = (preset) => {
        if (onInsert) {
            onInsert(preset.template, preset.css, insertMode);
        }
        if (onClose) {
            onClose();
        }
    };

    const categoryLabels = {
        lightbox: 'Lightbox',
        buttons: 'Buttons',
        gallery: 'Gallery',
        carousel: 'Carousel',
        component: 'Component'
    };

    return (
        <div className={`preset-selector ${className}`}>
            {/* Header */}
            <div className="preset-header">
                <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Insert Preset Template</div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Search and Filter */}
            <div className="preset-controls">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search presets..."
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                </div>

                {categories.length > 1 && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-3 py-2 text-sm rounded-md transition-colors ${selectedCategory === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            All
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-2 text-sm rounded-md transition-colors ${selectedCategory === cat
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {categoryLabels[cat] || cat}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Insert Mode Toggle */}
            <div className="preset-mode">
                <label className="text-sm font-medium text-gray-700">Insert mode:</label>
                <div className="flex gap-2">
                    <button
                        onClick={() => setInsertMode('replace')}
                        className={`px-3 py-1 text-sm rounded transition-colors ${insertMode === 'replace'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Replace
                    </button>
                    <button
                        onClick={() => setInsertMode('append')}
                        className={`px-3 py-1 text-sm rounded transition-colors ${insertMode === 'append'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Append
                    </button>
                </div>
                <span className="text-xs text-gray-500">
                    {insertMode === 'replace'
                        ? 'Will replace current template and CSS'
                        : 'Will add to end of current content'}
                </span>
            </div>

            {/* Preset Grid */}
            <div className="preset-grid">
                {filteredPresets.length > 0 ? (
                    filteredPresets.map(preset => (
                        <PresetCard
                            key={preset.id}
                            preset={preset}
                            onInsert={handleInsert}
                            onPreview={setPreviewPreset}
                        />
                    ))
                ) : (
                    <div className="preset-empty">
                        <div className="text-gray-500 text-sm">
                            {searchTerm ? 'No presets match your search' : 'No presets available'}
                        </div>
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {previewPreset && (
                <PresetPreview
                    preset={previewPreset}
                    onClose={() => setPreviewPreset(null)}
                    onInsert={() => handleInsert(previewPreset)}
                />
            )}

            <style>{`
        .preset-selector {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: white;
          border-radius: 8px;
        }
        .preset-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e5e7eb;
        }
        .preset-controls {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .preset-mode {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: #f9fafb;
          border-radius: 6px;
        }
        .preset-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
          max-height: 60vh;
          overflow-y: auto;
          padding: 0.5rem;
        }
        .preset-empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 3rem;
        }
      `}</style>
        </div>
    );
};

// Preset Card Component
const PresetCard = ({ preset, onInsert, onPreview }) => {
    const getCategoryColor = (category) => {
        const colors = {
            lightbox: 'bg-purple-100 text-purple-700',
            buttons: 'bg-green-100 text-green-700',
            gallery: 'bg-blue-100 text-blue-700',
            carousel: 'bg-orange-100 text-orange-700',
            component: 'bg-pink-100 text-pink-700'
        };
        return colors[category] || 'bg-gray-100 text-gray-700';
    };

    return (
        <div className="preset-card">
            <div className="preset-card-header">
                <div className="preset-card-title" role="heading" aria-level="4">{preset.name}</div>
                <span className={`preset-card-badge ${getCategoryColor(preset.category)}`}>
                    {preset.category}
                </span>
            </div>

            <div className="preset-card-description">{preset.description}</div>

            <div className="preset-card-actions">
                <button
                    onClick={() => onPreview(preset)}
                    className="preset-btn preset-btn-secondary"
                    title="Preview code"
                >
                    <Eye className="w-4 h-4" />
                    Preview
                </button>
                <button
                    onClick={() => onInsert(preset)}
                    className="preset-btn preset-btn-primary"
                >
                    <Plus className="w-4 h-4" />
                    Insert
                </button>
            </div>

            <style>{`
        .preset-card {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: white;
          transition: all 0.2s;
        }
        .preset-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        }
        .preset-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .preset-card-title {
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
          flex: 1;
        }
        .preset-card-badge {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-weight: 500;
          flex-shrink: 0;
        }
        .preset-card-description {
          font-size: 0.875rem;
          color: #6b7280;
          margin: 0;
          line-height: 1.4;
        }
        .preset-card-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: auto;
        }
        .preset-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.75rem;
          border: none;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .preset-btn-primary {
          background: #3b82f6;
          color: white;
          flex: 1;
        }
        .preset-btn-primary:hover {
          background: #2563eb;
        }
        .preset-btn-secondary {
          background: #f3f4f6;
          color: #4b5563;
        }
        .preset-btn-secondary:hover {
          background: #e5e7eb;
        }
      `}</style>
        </div>
    );
};

// Preset Preview Modal
const PresetPreview = ({ preset, onClose, onInsert }) => {
    const [activeTab, setActiveTab] = useState('template');

    return (
        <div className="preset-preview-overlay" onClick={onClose}>
            <div className="preset-preview-modal" onClick={(e) => e.stopPropagation()}>
                <div className="preset-preview-header">
                    <div>
                        <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">{preset.name}</div>
                        <div className="text-sm text-gray-500">{preset.description}</div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        aria-label="Close preview"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="preset-preview-tabs">
                    <button
                        onClick={() => setActiveTab('template')}
                        className={`preset-tab ${activeTab === 'template' ? 'active' : ''}`}
                    >
                        Template
                    </button>
                    <button
                        onClick={() => setActiveTab('css')}
                        className={`preset-tab ${activeTab === 'css' ? 'active' : ''}`}
                    >
                        CSS
                    </button>
                </div>

                <div className="preset-preview-content">
                    <pre className="preset-code">
                        <code>{activeTab === 'template' ? preset.template : preset.css}</code>
                    </pre>
                </div>

                <div className="preset-preview-footer">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onInsert}
                        className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Insert This Preset
                    </button>
                </div>
            </div>

            <style>{`
        .preset-preview-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 2rem;
        }
        .preset-preview-modal {
          background: white;
          border-radius: 12px;
          max-width: 800px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .preset-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }
        .preset-preview-tabs {
          display: flex;
          gap: 0.5rem;
          padding: 0 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }
        .preset-tab {
          padding: 0.75rem 1rem;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: #6b7280;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .preset-tab:hover {
          color: #374151;
        }
        .preset-tab.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }
        .preset-preview-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          background: #f9fafb;
        }
        .preset-code {
          margin: 0;
          padding: 1rem;
          background: #1f2937;
          color: #f3f4f6;
          border-radius: 8px;
          font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
          font-size: 0.875rem;
          line-height: 1.5;
          overflow-x: auto;
        }
        .preset-preview-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1.5rem;
          border-top: 1px solid #e5e7eb;
        }
      `}</style>
        </div>
    );
};

export default PresetSelector;

