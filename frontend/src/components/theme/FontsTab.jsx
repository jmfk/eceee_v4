/**
 * Fonts Tab Component with Google Fonts Integration
 */

import React, { useState } from 'react';
import { Plus, Trash2, Search, Edit3, ChevronDown, ChevronRight } from 'lucide-react';
import { POPULAR_GOOGLE_FONTS, searchFonts, getFontCategories } from '../../utils/googleFonts';
import CopyButton from './CopyButton';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';

const FontsTab = ({ fonts, onChange, onDirty }) => {
    const [showAddFont, setShowAddFont] = useState(false);
    const [showManualAdd, setShowManualAdd] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedFont, setSelectedFont] = useState(null);
    const [selectedVariants, setSelectedVariants] = useState(['400']);
    const [editingFont, setEditingFont] = useState(null);
    const [expandedFonts, setExpandedFonts] = useState({});
    const { addNotification } = useGlobalNotifications();

    // Manual font addition
    const [manualFontFamily, setManualFontFamily] = useState('');
    const [manualVariants, setManualVariants] = useState('400');

    const googleFonts = fonts?.googleFonts || [];
    const categories = getFontCategories();

    // Filtered fonts for selection
    const filteredFonts = searchQuery
        ? searchFonts(searchQuery).filter(f => !selectedCategory || f.category === selectedCategory)
        : POPULAR_GOOGLE_FONTS.filter(f => !selectedCategory || f.category === selectedCategory);

    const handleAddFont = () => {
        if (!selectedFont) return;

        const newFont = {
            family: selectedFont.family,
            variants: selectedVariants,
            display: 'swap',
        };

        const updatedFonts = {
            ...fonts,
            googleFonts: [...googleFonts, newFont],
        };

        onChange(updatedFonts);
        if (onDirty) onDirty();

        setShowAddFont(false);
        setSelectedFont(null);
        setSelectedVariants(['400']);
        setSearchQuery('');
    };

    const handleManualAdd = () => {
        if (!manualFontFamily.trim()) return;

        const variants = manualVariants.split(',').map(v => v.trim()).filter(Boolean);
        if (variants.length === 0) return;

        const newFont = {
            family: manualFontFamily.trim(),
            variants: variants,
            display: 'swap',
        };

        const updatedFonts = {
            ...fonts,
            googleFonts: [...googleFonts, newFont],
        };

        onChange(updatedFonts);
        if (onDirty) onDirty();

        setManualFontFamily('');
        setManualVariants('400');
        setShowManualAdd(false);
    };

    const handleRemoveFont = (index) => {
        onChange({
            ...fonts,
            googleFonts: googleFonts.filter((_, i) => i !== index),
        });
        if (onDirty) onDirty();
    };

    const handleVariantToggle = (variant) => {
        if (selectedVariants.includes(variant)) {
            setSelectedVariants(selectedVariants.filter(v => v !== variant));
        } else {
            setSelectedVariants([...selectedVariants, variant].sort());
        }
    };

    const handleUpdateFontVariants = (index, newVariants) => {
        const updatedFonts = [...googleFonts];
        updatedFonts[index] = {
            ...updatedFonts[index],
            variants: newVariants,
        };
        onChange({
            ...fonts,
            googleFonts: updatedFonts,
        });
    };

    const handleToggleFontVariant = (fontIndex, variant) => {
        const currentVariants = googleFonts[fontIndex].variants;
        const newVariants = currentVariants.includes(variant)
            ? currentVariants.filter(v => v !== variant)
            : [...currentVariants, variant].sort();

        if (newVariants.length === 0) return; // Keep at least one variant

        handleUpdateFontVariants(fontIndex, newVariants);
    };

    const COMMON_VARIANTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900', '400italic', '700italic'];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Google Fonts</div>
                <div className="flex gap-2">
                    <CopyButton
                        data={fonts}
                        level="section"
                        section="fonts"
                        label="Copy All Fonts"
                        onSuccess={() => addNotification({ type: 'success', message: 'Fonts copied to clipboard' })}
                        onError={(error) => addNotification({ type: 'error', message: `Failed to copy: ${error}` })}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            setShowAddFont(!showAddFont);
                            setShowManualAdd(false);
                        }}
                        className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Add from List
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setShowManualAdd(!showManualAdd);
                            setShowAddFont(false);
                        }}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Manually
                    </button>
                </div>
            </div>

            {/* Current Fonts */}
            {googleFonts.length > 0 && (
                <div className="space-y-3">
                    {googleFonts.map((font, index) => {
                        const isExpanded = expandedFonts[index];

                        return (
                            <div
                                key={index}
                                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                            >
                                <div className="flex items-center gap-3 p-4">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedFonts({ ...expandedFonts, [index]: !isExpanded })}
                                        className="text-gray-600 hover:text-gray-900"
                                    >
                                        {isExpanded ? (
                                            <ChevronDown className="w-5 h-5" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5" />
                                        )}
                                    </button>

                                    <div className="flex-1">
                                        <div className="text-base font-semibold text-gray-900" role="heading" aria-level="4">{font.family}</div>
                                        <div className="mt-1 text-sm text-gray-500">
                                            Variants: {font.variants.join(', ')}
                                        </div>
                                    </div>

                                    <CopyButton
                                        data={font}
                                        level="item"
                                        section="fonts"
                                        itemKey={font.family}
                                        iconOnly
                                        size="default"
                                        onSuccess={() => addNotification({ type: 'success', message: `Font "${font.family}" copied` })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFont(index)}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-gray-200 p-4 space-y-4 bg-gray-50">
                                        {/* Preview */}
                                        <div
                                            className="p-3 bg-white rounded border border-gray-200"
                                            style={{ fontFamily: `'${font.family}', sans-serif` }}
                                        >
                                            <div className="text-2xl">The quick brown fox jumps over the lazy dog</div>
                                        </div>

                                        {/* Variants Editor */}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                                Font Weights & Styles
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {COMMON_VARIANTS.map((variant) => {
                                                    const isSelected = font.variants.includes(variant);
                                                    return (
                                                        <button
                                                            key={variant}
                                                            type="button"
                                                            onClick={() => handleToggleFontVariant(index, variant)}
                                                            className={`px-3 py-1.5 text-sm rounded border transition-colors ${isSelected
                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                                                                }`}
                                                        >
                                                            {variant}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="mt-2 text-xs text-gray-500">
                                                Click to add/remove variants. At least one variant is required.
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add from List Panel */}
            {showAddFont && (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-4">
                    <div className="font-semibold text-gray-900" role="heading" aria-level="4">Add Google Font</div>

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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
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

                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md bg-white">
                        {filteredFonts.map((font) => (
                            <button
                                key={font.family}
                                type="button"
                                onClick={() => setSelectedFont(font)}
                                className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-blue-50 ${selectedFont?.family === font.family ? 'bg-blue-100' : ''
                                    }`}
                            >
                                <div className="font-medium text-gray-900">{font.family}</div>
                                <div className="text-xs text-gray-500">{font.category}</div>
                            </button>
                        ))}
                    </div>

                    {selectedFont && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Variants
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {selectedFont.variants.map((variant) => (
                                    <label key={variant} className="inline-flex items-center cursor-pointer">
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

                    {selectedFont && (
                        <div
                            className="p-3 bg-white rounded border border-gray-200"
                            style={{ fontFamily: `'${selectedFont.family}', ${selectedFont.category}` }}
                        >
                            <div className="text-xl">The quick brown fox jumps over the lazy dog</div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleAddFont}
                            disabled={!selectedFont || selectedVariants.length === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
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

            {/* Manual Add Panel */}
            {showManualAdd && (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-4">
                    <div className="font-semibold text-gray-900" role="heading" aria-level="4">Add Font Manually</div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Font Family Name
                        </label>
                        <input
                            type="text"
                            value={manualFontFamily}
                            onChange={(e) => setManualFontFamily(e.target.value)}
                            placeholder="e.g., Source Sans 3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Variants (comma-separated)
                        </label>
                        <input
                            type="text"
                            value={manualVariants}
                            onChange={(e) => setManualVariants(e.target.value)}
                            placeholder="e.g., 400, 600, 700"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {manualFontFamily && (
                        <div
                            className="p-3 bg-white rounded border border-gray-200"
                            style={{ fontFamily: `'${manualFontFamily}', sans-serif` }}
                        >
                            <div className="text-xl">The quick brown fox jumps over the lazy dog</div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleManualAdd}
                            disabled={!manualFontFamily.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            Add Font
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowManualAdd(false);
                                setManualFontFamily('');
                                setManualVariants('400');
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FontsTab;
