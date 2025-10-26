/**
 * Typography Tab Component (Simplified Working Version)
 */

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createTypographyGroup } from '../../utils/themeUtils';
import TypographyPreview from './TypographyPreview';

const TypographyTab = ({ typography, colors, fonts, onChange }) => {
    const groups = typography?.groups || [];

    const handleAddGroup = () => {
        const baseFont = fonts?.google_fonts?.[0]?.family || 'Inter';
        const newGroup = createTypographyGroup(`Group ${groups.length + 1}`, `${baseFont}, sans-serif`);
        const updatedTypography = {
            ...typography,
            groups: [...groups, newGroup],
        };
        onChange(updatedTypography);
    };

    const handleRemoveGroup = (index) => {
        const updatedGroups = groups.filter((_, i) => i !== index);
        onChange({ ...typography, groups: updatedGroups });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Typography Groups</h3>
                <button
                    type="button"
                    onClick={handleAddGroup}
                    className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Group
                </button>
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Groups List */}
                <div className="space-y-3">
                    {groups.length > 0 ? (
                        groups.map((group, index) => (
                            <div
                                key={index}
                                className="bg-white border border-gray-200 rounded-lg p-4"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-gray-900">{group.name}</h4>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveGroup(index)}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="text-sm text-gray-600">
                                    {Object.keys(group.elements || {}).length} elements configured
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                            <p className="text-gray-500">No groups yet. Click "Add Group".</p>
                        </div>
                    )}
                </div>

                {/* Preview */}
                <div className="lg:sticky lg:top-6 lg:self-start">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Live Preview</h4>
                        <TypographyPreview typography={typography} colors={colors} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TypographyTab;

