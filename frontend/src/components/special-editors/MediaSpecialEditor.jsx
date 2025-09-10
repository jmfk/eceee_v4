/**
 * MediaSpecialEditor Component
 * 
 * Special editor for Image Widgets that provides media management capabilities.
 * This is a demo implementation showing the structure for special editors.
 */
import React from 'react'
import { Image } from 'lucide-react'

const MediaSpecialEditor = ({
    widgetData,
    isAnimating = false,
    isClosing = false,
    onConfigChange
}) => {
    return (
        <div className="h-full flex flex-col">
            {/* Special Editor Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white transition-all duration-300 ${isAnimating ? 'animate-fade-in-up delay-100' : ''
                } ${isClosing ? 'animate-fade-out-down' : ''
                }`}>
                <h4 className="text-md font-medium text-gray-900 flex items-center">
                    <Image className={`w-4 h-4 mr-2 transition-all duration-300 delay-200 ${isAnimating ? 'animate-bounce-in' : ''
                        }`} />
                    Media Editor
                </h4>
            </div>

            {/* Special Editor Content */}
            <div className={`flex-1 p-4 overflow-y-auto transition-all duration-500 delay-300 ${isAnimating ? 'animate-fade-in-up' : ''
                }`}>
                <div className="space-y-4">
                    {/* Demo Media Editor Content */}
                    <div className={`bg-white rounded-lg border border-gray-200 p-6 transition-all duration-500 delay-400 ${isAnimating ? 'animate-scale-in' : ''
                        }`}>
                        <div className="text-center">
                            <div className={`w-16 h-16 mx-auto bg-blue-100 rounded-lg flex items-center justify-center mb-4 transition-all duration-300 delay-500 ${isAnimating ? 'animate-bounce-in' : ''
                                }`}>
                                <Image className="w-8 h-8 text-blue-600" />
                            </div>
                            <h5 className={`text-lg font-medium text-gray-900 mb-2 transition-all duration-300 delay-600 ${isAnimating ? 'animate-fade-in-up' : ''
                                }`}>Media Library</h5>
                            <p className={`text-sm text-gray-600 mb-4 transition-all duration-300 delay-700 ${isAnimating ? 'animate-fade-in-up' : ''
                                }`}>
                                This is a demo of the special media editor area.
                                Here you would see media browsing, upload, and management tools.
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                {[1, 2, 3, 4].map((num, index) => (
                                    <div
                                        key={num}
                                        className={`aspect-square bg-gray-200 rounded border-2 border-dashed border-gray-300 flex items-center justify-center transition-all duration-300 ${isAnimating ? 'animate-scale-in' : ''
                                            }`}
                                        style={{
                                            animationDelay: isAnimating ? `${500 + (index * 100)}ms` : '0ms'
                                        }}
                                    >
                                        <span className="text-xs text-gray-500">Image {num}</span>
                                    </div>
                                ))}
                            </div>
                            <button className={`w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300 text-sm ${isAnimating ? 'animate-fade-in-up delay-[900ms]' : ''
                                }`}>
                                Upload New Media
                            </button>
                        </div>
                    </div>

                    <div className={`bg-white rounded-lg border border-gray-200 p-4 transition-all duration-500 delay-[1000ms] ${isAnimating ? 'animate-scale-in' : ''
                        }`}>
                        <h6 className={`font-medium text-gray-900 mb-3 transition-all duration-300 delay-[1100ms] ${isAnimating ? 'animate-fade-in-up' : ''
                            }`}>Media Properties</h6>
                        <div className="space-y-3">
                            <div className={`transition-all duration-300 delay-[1200ms] ${isAnimating ? 'animate-fade-in-up' : ''
                                }`}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alt Text</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    placeholder="Describe this image..."
                                    defaultValue={widgetData?.config?.alt_text || ''}
                                    onChange={(e) => onConfigChange && onConfigChange({
                                        ...widgetData?.config,
                                        alt_text: e.target.value
                                    })}
                                />
                            </div>
                            <div className={`transition-all duration-300 delay-[1300ms] ${isAnimating ? 'animate-fade-in-up' : ''
                                }`}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    rows="2"
                                    placeholder="Image caption..."
                                    defaultValue={widgetData?.config?.caption || ''}
                                    onChange={(e) => onConfigChange && onConfigChange({
                                        ...widgetData?.config,
                                        caption: e.target.value
                                    })}
                                ></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

MediaSpecialEditor.displayName = 'MediaSpecialEditor'

export default MediaSpecialEditor
