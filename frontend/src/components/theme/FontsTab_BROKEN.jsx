/**
 * Fonts Tab Component
 * 
 * Google Fonts selector with preview and variant management.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Search, FileJson, FileCode, Eye } from 'lucide-react';
import { POPULAR_GOOGLE_FONTS, buildGoogleFontsUrl, loadGoogleFonts, searchFonts, getFontCategories } from '../../utils/googleFonts';
import CodeEditorPanel from './CodeEditorPanel';

const FontsTab = ({ fonts, onChange }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [showAddFont, setShowAddFont] = useState(false);
    const [showManualAdd, setShowManualAdd] = useState(false);
    const [selectedFont, setSelectedFont] = useState(null);
    const [selectedVariants, setSelectedVariants] = useState(['400']);
    const [viewMode, setViewMode] = useState('visual'); // 'visual', 'json', 'css'

    // Manual font addition state
    const [manualFontFamily, setManualFontFamily] = useState('');
    const [manualVariants, setManualVariants] = useState('400');
    const [isGoogleFont, setIsGoogleFont] = useState(true);
    const [customFontFace, setCustomFontFace] = useState('');

    const googleFonts = fonts?.google_fonts || [];
    const categories = getFontCategories();

    // Filtered font list for selection
    const filteredFonts = useMemo(() => {
        let results = searchQuery ? searchFonts(searchQuery) : POPULAR_GOOGLE_FONTS;

        if (selectedCategory) {
            results = results.filter(f => f.category === selectedCategory);
        }

        return results;
    }, [searchQuery, selectedCategory]);

    // Load Google Fonts for preview
    useEffect(() => {
        if (googleFonts.length > 0) {
            const url = buildGoogleFontsUrl(googleFonts);
            if (url) {
                loadGoogleFonts(url);
            }
        }
    }, [googleFonts]);

    const handleAddFont = () => {
        if (!selectedFont) return;

        const newFont = {
            family: selectedFont.family,
            variants: selectedVariants,
            display: 'swap',
        };

        const updatedFonts = {
            ...fonts,
            google_fonts: [...googleFonts, newFont],
        };

        onChange(updatedFonts);
        setShowAddFont(false);
        setSelectedFont(null);
        setSelectedVariants(['400']);
        setSearchQuery('');
    };

    const handleRemoveFont = (index) => {
        const updatedFonts = {
            ...fonts,
            google_fonts: googleFonts.filter((_, i) => i !== index),
        };
        onChange(updatedFonts);
    };

    const handleVariantToggle = (variant) => {
        if (selectedVariants.includes(variant)) {
            setSelectedVariants(selectedVariants.filter(v => v !== variant));
        } else {
            setSelectedVariants([...selectedVariants, variant].sort());
        }
    };

    const handleManualAdd = () => {
        if (!manualFontFamily.trim()) return;

        const variants = manualVariants.split(',').map(v => v.trim()).filter(Boolean);
        if (variants.length === 0) return;

        const newFont = {
            family: manualFontFamily.trim(),
            variants: variants,
            display: 'swap',
            ...(isGoogleFont ? {} : { custom: true, fontFace: customFontFace }),
        };

        const updatedFonts = {
            ...fonts,
            google_fonts: [...googleFonts, newFont],
        };

        onChange(updatedFonts);

        // Reset form
        setManualFontFamily('');
        setManualVariants('400');
        setIsGoogleFont(true);
        setCustomFontFace('');
        setShowManualAdd(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Google Fonts</h3>
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
                            className={`px-3 py-2 text-xs font-medium border-t border-b border-r ${viewMode === 'json'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                } rounded-r-md`}
                        >
                            <FileJson className="w-3 h-3 inline mr-1" />
                            JSON
                        </button>
                    </div>

                    {viewMode === 'visual' && (
                        <>
                            <button
                                type="button"
                                onClick={() => { setShowAddFont(!showAddFont); setShowManualAdd(false); }}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add from List
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowManualAdd(!showManualAdd); setShowAddFont(false); }}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Manually
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* JSON Editor Mode */}
            {viewMode === 'json' && (
                <CodeEditorPanel
                    data={fonts || {}}
                    onChange={onChange}
                    mode="json"
                    label="Fonts Configuration JSON"
                />
            )}

            {/* Visual Editor Mode */}
            {viewMode === 'visual' && (
                <>
                    {/* Current Fonts List */}
                    {googleFonts.length > 0 && (
                        <div className="space-y-3">
                            {googleFonts.map((font, index) => (
                                <div
                                    key={index}
                                    className="bg-white border border-gray-200 rounded-lg p-4"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h4 className="text-base font-semibold text-gray-900">
                                                    {font.family}
                                                </h4>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFont(index)}
                                                    className="text-red-600 hover:text-red-700"
                                                    title="Remove font"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="mt-1 text-sm text-gray-500">
                                                Variants: {font.variants.join(', ')}
                                            </div>

                                            {/* Font Preview */}
                                            <div
                                                className="mt-3 p-3 bg-gray-50 rounded border border-gray-200"
                                                style={{ fontFamily: `'${font.family}', sans-serif` }}
                                            >
                                                <div className="text-2xl">The quick brown fox jumps over the lazy dog</div>
                                                <div className="text-sm mt-2 text-gray-600">
                                                    ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {googleFonts.length === 0 && !showAddFont && !showManualAdd && (
                        <div className="text-center py-8 text-gray-500">
                            No fonts added yet. Click "Add Font" to get started.
                        </div>
                    )}

                    {/* Add Font Panel */}
                    {showAddFont && (
                        <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-4">
                            <h4 className="font-semibold text-gray-900">Add Google Font</h4>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search fonts..."
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Category Filter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Category
                                </label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Categories</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Font List */}
                            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md bg-white">
                                {filteredFonts.map((font) => (
                                    <button
                                        key={font.family}
                                        type="button"
                                        onClick={() => setSelectedFont(font)}
                                        className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-blue-50 transition-colors ${selectedFont?.family === font.family ? 'bg-blue-100' : ''
                                            }`}
                                    >
                                        <div className="font-medium text-gray-900">{font.family}</div>
                                        <div className="text-xs text-gray-500">{font.category}</div>
                                    </button>
                                ))}
                            </div>

                            {/* Variant Selection */}
                            {selectedFont && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select Variants
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedFont.variants.map((variant) => (
                                            <label
                                                key={variant}
                                                className="inline-flex items-center cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedVariants.includes(variant)}
                                                    onChange={() => handleVariantToggle(variant)}
                                                    className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">{variant}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Font Preview */}
                            {selectedFont && (
                                <div
                                    className="p-3 bg-white rounded border border-gray-200"
                                    style={{ fontFamily: `'${selectedFont.family}', ${selectedFont.category}` }}
                                >
                                    <div className="text-xl">The quick brown fox jumps over the lazy dog</div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleAddFont}
                                    disabled={!selectedFont || selectedVariants.length === 0}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Add Font
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddFont(false);
                                        setSelectedFont(null);
                                        setSearchQuery('');
                                    }}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Manual Add Font Panel */}
                    {showManualAdd && (
                        <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-4">
                            <h4 className="font-semibold text-gray-900">Add Font Manually</h4>

                            {/* Google Font vs Custom Font Toggle */}
                            <div className="flex gap-4">
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={isGoogleFont}
                                        onChange={() => setIsGoogleFont(true)}
                                        className="mr-2 border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">Google Font</span>
                                </label>
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        checked={!isGoogleFont}
                                        onChange={() => setIsGoogleFont(false)}
                                        className="mr-2 border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">Custom Font</span>
                                </label>
                            </div>

                            {/* Font Family Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Font Family Name
                                </label>
                                <input
                                    type="text"
                                    value={manualFontFamily}
                                    onChange={(e) => setManualFontFamily(e.target.value)}
                                    placeholder="e.g., Source Sans 3, Helvetica Neue"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Variants */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Variants (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={manualVariants}
                                    onChange={(e) => setManualVariants(e.target.value)}
                                    placeholder="e.g., 400, 500, 600, 700"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Enter font weights like 400, 500, 600, 700, etc.
                                </p>
                            </div>

                            {/* Custom Font Face CSS (only for custom fonts) */}
                            {!isGoogleFont && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        @font-face CSS (Optional)
                                    </label>
                                    <textarea
                                        value={customFontFace}
                                        onChange={(e) => setCustomFontFace(e.target.value)}
                                        placeholder="@font-face { font-family: 'My Font'; src: url('...'); }"
                                        rows={4}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Optional CSS for loading custom fonts from your own files.
                                    </p>
                                </div>
                            )}

                            {/* Preview */}
                            {manualFontFamily && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Preview
                                    </label>
                                    <div
                                        className="p-3 bg-white rounded border border-gray-200"
                                        style={{ fontFamily: `'${manualFontFamily}', sans-serif` }}
                                    >
                                        <div className="text-xl">The quick brown fox jumps over the lazy dog</div>
                                        <div className="text-sm text-gray-600 mt-2">ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789</div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleManualAdd}
                                    disabled={!manualFontFamily.trim() || !manualVariants.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Add Font
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowManualAdd(false);
                                        setManualFontFamily('');
                                        setManualVariants('400');
                                        setIsGoogleFont(true);
                                        setCustomFontFace('');
                                    }}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default FontsTab;

