/**
 * Fonts Tab Component (Simplified Working Version)
 */

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const FontsTab = ({ fonts, onChange }) => {
    const [manualFontFamily, setManualFontFamily] = useState('');
    const [manualVariants, setManualVariants] = useState('400');

    const googleFonts = fonts?.google_fonts || [];

    const handleAddManualFont = () => {
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
            google_fonts: [...googleFonts, newFont],
        };

        onChange(updatedFonts);
        setManualFontFamily('');
        setManualVariants('400');
    };

    const handleRemoveFont = (index) => {
        const updatedFonts = {
            ...fonts,
            google_fonts: googleFonts.filter((_, i) => i !== index),
        };
        onChange(updatedFonts);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Google Fonts</h3>
            </div>

            {/* Current Fonts List */}
            {googleFonts.length > 0 && (
                <div className="space-y-3">
                    {googleFonts.map((font, index) => (
                        <div
                            key={index}
                            className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                        >
                            <div>
                                <h4 className="font-semibold text-gray-900">{font.family}</h4>
                                <div className="text-sm text-gray-500">Variants: {font.variants.join(', ')}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemoveFont(index)}
                                className="text-red-600 hover:text-red-700"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Font Form */}
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-4">
                <h4 className="font-semibold text-gray-900">Add Font</h4>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Font Family Name
                    </label>
                    <input
                        type="text"
                        value={manualFontFamily}
                        onChange={(e) => setManualFontFamily(e.target.value)}
                        placeholder="e.g., Source Sans 3, Inter"
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
                        placeholder="e.g., 400, 500, 600, 700"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <button
                    type="button"
                    onClick={handleAddManualFont}
                    disabled={!manualFontFamily.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Add Font
                </button>
            </div>
        </div>
    );
};

export default FontsTab;

