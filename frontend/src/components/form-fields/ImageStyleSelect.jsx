import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { ChevronDown, Check } from 'lucide-react';
import { renderMustache, prepareGalleryContext, prepareCarouselContext } from '../../utils/mustacheRenderer';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { lookupWidget } from '../../utils/widgetUtils';

/**
 * Smart visual selector for image styles with preview thumbnails
 * Shows only applicable styles based on displayType (gallery or carousel)
 */
const ImageStyleSelect = ({
    value,
    onChange,
    displayType,
    formData,
    context,
    ...props
}) => {
    const { currentTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // UDC Integration
    const { useExternalChanges, getState } = useUnifiedData();
    const widgetId = context?.widgetId;
    const slotName = context?.slotName;
    const contextType = context?.contextType;
    const widgetPath = context?.widgetPath;

    // State to track current displayType from UDC
    const [udcDisplayType, setUdcDisplayType] = useState(() => {
        // Initialize from current widget config
        if (widgetId && slotName && contextType && getState) {
            try {
                const state = getState();
                const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath);
                return widget?.config?.displayType || null;
            } catch (e) {
                return null;
            }
        }
        return null;
    });

    // Subscribe to UDC changes to get updated displayType
    useExternalChanges(`imagestyle-${widgetId || 'preview'}`, (state) => {
        if (widgetId && slotName && contextType) {
            const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath);
            if (widget && widget.config) {
                setUdcDisplayType(widget.config.displayType);
            }
        }
    });

    // Get displayType from prop, UDC, or formData (recalculate when any changes)
    const effectiveDisplayType = useMemo(() => {
        return displayType || udcDisplayType || formData?.displayType || 'gallery';
    }, [displayType, udcDisplayType, formData?.displayType]);

    // Get appropriate styles based on display type
    const availableStyles = useMemo(() => {
        if (!currentTheme) return [];

        const styles = effectiveDisplayType === 'carousel'
            ? currentTheme.carouselStyles || {}
            : currentTheme.galleryStyles || {};

        return Object.entries(styles).map(([key, style]) => ({
            value: key,
            label: style.name || key,
            description: style.description,
            template: style.template,
            css: style.css,
            variables: style.variables,
            previewImage: style.previewImage
        }));
    }, [currentTheme, effectiveDisplayType]);

    const hasStyles = availableStyles.length > 0;
    const selectedStyle = availableStyles.find(s => s.value === value);

    // Close dropdown when displayType changes (so user sees updated options)
    useEffect(() => {
        setIsOpen(false);
    }, [effectiveDisplayType]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Generate Mustache preview for a style (fallback if no uploaded preview)
    const generateMustachePreview = (style) => {
        try {
            // Use sample images
            const sampleImages = [
                { url: 'https://via.placeholder.com/200x150/3b82f6/ffffff?text=1', alt: 'Sample 1', caption: 'Image 1', width: 200, height: 150 },
                { url: 'https://via.placeholder.com/200x150/8b5cf6/ffffff?text=2', alt: 'Sample 2', caption: 'Image 2', width: 200, height: 150 },
                { url: 'https://via.placeholder.com/200x150/ec4899/ffffff?text=3', alt: 'Sample 3', caption: 'Image 3', width: 200, height: 150 }
            ];

            const sampleConfig = { showCaptions: false, enableLightbox: false };

            const previewContext = effectiveDisplayType === 'carousel'
                ? prepareCarouselContext(sampleImages, sampleConfig, style.variables || {})
                : prepareGalleryContext(sampleImages, sampleConfig, style.variables || {});

            const html = renderMustache(style.template || '', previewContext);

            return { html, css: style.css || '' };
        } catch (error) {
            console.error('Error generating Mustache preview:', error);
            return { html: '<div class="text-xs text-red-500">Preview error</div>', css: '' };
        }
    };

    // Render style option
    const renderStyleOption = (style, isDefault = false) => {
        const isSelected = isDefault ? !value : value === style?.value;

        return (
            <div
                onClick={() => {
                    onChange(isDefault ? null : style.value);
                    setIsOpen(false);
                }}
                className={`p-3 hover:bg-blue-50 cursor-pointer border-b flex items-center gap-3 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                    }`}
            >
                {!isDefault && (
                    <div className="w-24 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0 border border-gray-200">
                        {style.previewImage ? (
                            // Use uploaded preview image
                            <img
                                src={style.previewImage}
                                alt={style.label}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            // Generate Mustache preview
                            (() => {
                                const preview = generateMustachePreview(style);
                                return (
                                    <div className="relative w-full h-full overflow-hidden">
                                        {preview.css && (
                                            <style dangerouslySetInnerHTML={{ __html: preview.css }} />
                                        )}
                                        <div
                                            className="absolute top-0 left-0 scale-[0.2] origin-top-left"
                                            style={{ width: '480px' }}
                                            dangerouslySetInnerHTML={{ __html: preview.html }}
                                        />
                                    </div>
                                );
                            })()
                        )}
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900 truncate">
                            {isDefault ? 'Default' : style.label}
                        </div>
                        {isSelected && (
                            <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                        {isDefault
                            ? `Built-in ${effectiveDisplayType} layout`
                            : style.description || 'Custom style'
                        }
                    </div>
                </div>
            </div>
        );
    };

    if (!hasStyles) {
        return (
            <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                Default {effectiveDisplayType === 'carousel' ? 'Carousel' : 'Gallery'}
            </div>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Selected style display button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <span className="text-sm text-gray-900">
                    {selectedStyle?.label || 'Default'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
                    {/* Default option */}
                    <div key="default">
                        {renderStyleOption(null, true)}
                    </div>

                    {/* Custom styles with previews */}
                    {availableStyles.map((style) => (
                        <div key={style.value}>
                            {renderStyleOption(style, false)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ImageStyleSelect;
