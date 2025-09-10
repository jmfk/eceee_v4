/**
 * PageWidgetSelectionModal - Widget selection modal for PageEditor
 * 
 * This component provides a modal for selecting widget types when adding
 * widgets to PageEditor slots. Separate from ObjectContentEditor implementation.
 */

import React, { useState, useEffect } from 'react';
import { X, Search, Package, Grid } from 'lucide-react';
import { widgetsApi } from '../../api';

const PageWidgetSelectionModal = ({
    isOpen,
    onClose,
    onWidgetSelect,
    slotName,
    slotLabel
}) => {
    const [availableWidgets, setAvailableWidgets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Fetch available widget types
    useEffect(() => {
        if (isOpen) {
            fetchAvailableWidgets();
        }
    }, [isOpen]);

    const fetchAvailableWidgets = async () => {
        setLoading(true);
        try {
            const data = await widgetsApi.getTypes(true); // Include template JSON
            setAvailableWidgets(data || []);
        } catch (error) {
            console.error('Failed to fetch available widgets:', error);
            setAvailableWidgets([]);
        } finally {
            setLoading(false);
        }
    };

    // Filter widgets based on search and category
    const filteredWidgets = availableWidgets.filter(widget => {
        const matchesSearch = !searchTerm ||
            widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            widget.description?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = selectedCategory === 'all' ||
            widget.category === selectedCategory ||
            (selectedCategory === 'core' && widget.type.startsWith('core_widgets.'));

        return matchesSearch && matchesCategory;
    });

    // Get unique categories
    const categories = [
        { id: 'all', label: 'All Widgets' },
        { id: 'core', label: 'Core Widgets' },
        ...Array.from(new Set(availableWidgets.map(w => w.category).filter(Boolean)))
            .map(cat => ({ id: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1) }))
    ];

    const handleWidgetSelect = (widgetType) => {
        if (onWidgetSelect) {
            onWidgetSelect(widgetType);
        }
        onClose();
    };

    const handleClose = () => {
        setSearchTerm('');
        setSelectedCategory('all');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            Add Widget to {slotLabel || slotName}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Choose a widget type to add to your page
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Search and Filter */}
                <div className="p-6 border-b border-gray-200 space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search widgets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="flex flex-wrap gap-2">
                        {categories.map(category => (
                            <button
                                key={category.id}
                                onClick={() => setSelectedCategory(category.id)}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedCategory === category.id
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {category.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Widget Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-3 text-gray-600">Loading widgets...</span>
                        </div>
                    ) : filteredWidgets.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <p className="text-lg font-medium">No widgets found</p>
                            <p className="text-sm mt-1">Try adjusting your search or filter criteria</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredWidgets.map(widget => (
                                <div
                                    key={widget.type}
                                    onClick={() => handleWidgetSelect(widget.type)}
                                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                                >
                                    <div className="flex items-start space-x-3">
                                        <div className="flex-shrink-0">
                                            <Grid className="h-8 w-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                                                {widget.name}
                                            </h3>
                                            {widget.description && (
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                    {widget.description}
                                                </p>
                                            )}
                                            <div className="flex items-center mt-2 space-x-2">
                                                {widget.category && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                        {widget.category}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end p-6 border-t border-gray-200">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PageWidgetSelectionModal;
