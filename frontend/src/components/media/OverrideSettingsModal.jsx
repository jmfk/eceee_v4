/**
 * OverrideSettingsModal Component
 * Modal for configuring override settings for inline images
 */

import React from 'react';
import { X, Settings } from 'lucide-react';

const OverrideSettingsModal = ({ isOpen, onClose, config, onConfigChange, selectedStyle }) => {
    if (!isOpen) return null;

    const isCarouselStyle = selectedStyle?.styleType === 'carousel';

    // Get default values from the selected style
    const defaultShowCaptions = selectedStyle?.defaultShowCaptions !== undefined ? selectedStyle.defaultShowCaptions : true;
    const defaultLightboxGroup = selectedStyle?.defaultLightboxGroup || '';
    const defaultRandomize = selectedStyle?.defaultRandomize !== undefined ? selectedStyle.defaultRandomize : false;
    const defaultAutoPlay = selectedStyle?.defaultAutoPlay !== undefined ? selectedStyle.defaultAutoPlay : false;
    const defaultAutoPlayInterval = selectedStyle?.defaultAutoPlayInterval || 3;

    const handleConfigChange = (field, value) => {
        onConfigChange(field, value);
    };

    return (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 text-green-600" />
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                                Override Defaults
                            </h2>
                            <p className="text-sm text-gray-600 mt-0.5">
                                Override the image style's default values
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="space-y-4">
                        {/* Show Captions */}
                        <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            <input
                                type="checkbox"
                                id="overrideShowCaptions"
                                checked={config.showCaptions !== undefined}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        handleConfigChange('showCaptions', defaultShowCaptions);
                                    } else {
                                        handleConfigChange('showCaptions', undefined);
                                    }
                                }}
                                className="rounded border-gray-300 text-green-600 w-4 h-4"
                            />
                            <label htmlFor="overrideShowCaptions" className="text-sm text-gray-700 flex-1 font-medium">
                                Show Captions
                            </label>
                            <input
                                type="checkbox"
                                checked={config.showCaptions !== undefined ? config.showCaptions : defaultShowCaptions}
                                onChange={(e) => handleConfigChange('showCaptions', e.target.checked)}
                                disabled={config.showCaptions === undefined}
                                className={`rounded border-gray-300 w-4 h-4 ${
                                    config.showCaptions === undefined 
                                        ? 'text-gray-400 opacity-50 cursor-not-allowed' 
                                        : 'text-blue-600'
                                }`}
                            />
                        </div>

                        {/* Randomize Order */}
                        <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            <input
                                type="checkbox"
                                id="overrideRandomize"
                                checked={config.randomize !== undefined}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        handleConfigChange('randomize', defaultRandomize);
                                    } else {
                                        handleConfigChange('randomize', undefined);
                                    }
                                }}
                                className="rounded border-gray-300 text-green-600 w-4 h-4"
                            />
                            <label htmlFor="overrideRandomize" className="text-sm text-gray-700 flex-1 font-medium">
                                Randomize Order
                            </label>
                            <input
                                type="checkbox"
                                checked={config.randomize !== undefined ? config.randomize : defaultRandomize}
                                onChange={(e) => handleConfigChange('randomize', e.target.checked)}
                                disabled={config.randomize === undefined}
                                className={`rounded border-gray-300 w-4 h-4 ${
                                    config.randomize === undefined 
                                        ? 'text-gray-400 opacity-50 cursor-not-allowed' 
                                        : 'text-blue-600'
                                }`}
                            />
                        </div>

                        {/* Lightbox Group */}
                        <div className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3 mb-2">
                                <input
                                    type="checkbox"
                                    id="overrideLightboxGroup"
                                    checked={config.lightboxGroup !== undefined}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            handleConfigChange('lightboxGroup', defaultLightboxGroup);
                                        } else {
                                            handleConfigChange('lightboxGroup', undefined);
                                        }
                                    }}
                                    className="rounded border-gray-300 text-green-600 w-4 h-4"
                                />
                                <label htmlFor="overrideLightboxGroup" className="text-sm text-gray-700 font-medium">
                                    Lightbox Group
                                </label>
                            </div>
                            <input
                                type="text"
                                value={config.lightboxGroup !== undefined ? config.lightboxGroup : defaultLightboxGroup}
                                onChange={(e) => handleConfigChange('lightboxGroup', e.target.value)}
                                placeholder="gallery-group"
                                disabled={config.lightboxGroup === undefined}
                                className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                                    config.lightboxGroup === undefined 
                                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                        : ''
                                }`}
                            />
                        </div>

                        {/* Carousel-specific settings */}
                        {isCarouselStyle && (
                            <>
                                {/* Auto Play */}
                                <div className="flex items-center gap-3 p-3 border border-purple-200 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        id="overrideAutoPlay"
                                        checked={config.autoPlay !== undefined}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                handleConfigChange('autoPlay', defaultAutoPlay);
                                            } else {
                                                handleConfigChange('autoPlay', undefined);
                                            }
                                        }}
                                        className="rounded border-gray-300 text-purple-600 w-4 h-4"
                                    />
                                    <label htmlFor="overrideAutoPlay" className="text-sm text-gray-700 flex-1 font-medium">
                                        Auto Play
                                    </label>
                                    <input
                                        type="checkbox"
                                        checked={config.autoPlay !== undefined ? config.autoPlay : defaultAutoPlay}
                                        onChange={(e) => handleConfigChange('autoPlay', e.target.checked)}
                                        disabled={config.autoPlay === undefined}
                                        className={`rounded border-gray-300 w-4 h-4 ${
                                            config.autoPlay === undefined 
                                                ? 'text-gray-400 opacity-50 cursor-not-allowed' 
                                                : 'text-blue-600'
                                        }`}
                                    />
                                </div>

                                {/* Auto Play Interval */}
                                <div className="border border-purple-200 rounded-lg p-3 bg-purple-50 hover:bg-purple-100 transition-colors">
                                    <div className="flex items-center gap-3 mb-2">
                                        <input
                                            type="checkbox"
                                            id="overrideAutoPlayInterval"
                                            checked={config.autoPlayInterval !== undefined}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    handleConfigChange('autoPlayInterval', defaultAutoPlayInterval);
                                                } else {
                                                    handleConfigChange('autoPlayInterval', undefined);
                                                }
                                            }}
                                            className="rounded border-gray-300 text-purple-600 w-4 h-4"
                                        />
                                        <label htmlFor="overrideAutoPlayInterval" className="text-sm text-gray-700 font-medium">
                                            Auto Play Interval (sec)
                                        </label>
                                    </div>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={config.autoPlayInterval !== undefined ? config.autoPlayInterval : defaultAutoPlayInterval}
                                        onChange={(e) => handleConfigChange('autoPlayInterval', parseInt(e.target.value) || defaultAutoPlayInterval)}
                                        disabled={config.autoPlayInterval === undefined}
                                        className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                                            config.autoPlayInterval === undefined 
                                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                                : ''
                                        }`}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Help Text */}
                    <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                            <strong>First checkbox:</strong> Enable override for this setting<br />
                            <strong>Second checkbox/input:</strong> Set the override value
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OverrideSettingsModal;

