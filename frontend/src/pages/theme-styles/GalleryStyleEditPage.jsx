/**
 * Gallery Style Edit Page (Nested under Theme)
 * 
 * Edit a single gallery style within a theme context
 * Route: /settings/themes/:themeId/gallery-styles/:styleKey
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Save, Eye } from 'lucide-react';
import { themesApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import CodeEditorPanel from '../../components/theme/CodeEditorPanel';
import { renderMustache, prepareGalleryContext } from '../../utils/mustacheRenderer';

const GalleryStyleEditPage = () => {
    const { themeId, styleKey } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { addNotification } = useGlobalNotifications();

    const [template, setTemplate] = useState('');
    const [css, setCss] = useState('');
    const [variables, setVariables] = useState({});
    const [imgproxyConfig, setImgproxyConfig] = useState({});
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [initialData, setInitialData] = useState(null);

    // Fetch theme data
    const { data: themeData, isLoading } = useQuery({
        queryKey: ['theme', themeId],
        queryFn: () => themesApi.get(themeId),
        enabled: !!themeId,
    });

    // Load style data when theme loads
    useEffect(() => {
        if (themeData) {
            const styles = themeData.gallery_styles || themeData.galleryStyles || {};
            const style = styles[styleKey];
            if (style) {
                const initialStyle = {
                    template: style.template || '',
                    css: style.css || '',
                    variables: style.variables || {},
                    imgproxyConfig: style.imgproxy_config || style.imgproxyConfig || {},
                    name: style.name || styleKey,
                    description: style.description || '',
                };
                setTemplate(initialStyle.template);
                setCss(initialStyle.css);
                setVariables(initialStyle.variables);
                setImgproxyConfig(initialStyle.imgproxyConfig);
                setName(initialStyle.name);
                setDescription(initialStyle.description);
                setInitialData(initialStyle);
            }
        }
    }, [themeData, styleKey]);

    // Check if dirty
    const isDirty = initialData && (
        template !== initialData.template ||
        css !== initialData.css ||
        name !== initialData.name ||
        description !== initialData.description ||
        JSON.stringify(imgproxyConfig) !== JSON.stringify(initialData.imgproxyConfig)
    );

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: (updatedStyle) => {
            const styles = themeData.gallery_styles || themeData.galleryStyles || {};
            // Exclude image field to avoid file upload error
            const { image, ...themeDataWithoutImage } = themeData;
            return themesApi.update(themeId, {
                ...themeDataWithoutImage,
                gallery_styles: {
                    ...styles,
                    [styleKey]: updatedStyle,
                },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['theme', themeId]);
            queryClient.invalidateQueries(['themes']);
            addNotification({
                type: 'success',
                message: 'Gallery style saved successfully',
            });
        },
        onError: (error) => {
            addNotification({
                type: 'error',
                message: `Failed to save: ${error.message}`,
            });
        },
    });

    const handleSave = () => {
        updateMutation.mutate({
            name,
            description,
            template,
            css,
            variables,
            imgproxy_config: imgproxyConfig,
        });
    };

    // Sample data for preview
    const sampleImages = [
        { url: 'https://via.placeholder.com/400x300', alt_text: 'Sample 1', caption: 'Gallery Image 1', width: 400, height: 300, index: 0 },
        { url: 'https://via.placeholder.com/400x300', alt_text: 'Sample 2', caption: 'Gallery Image 2', width: 400, height: 300, index: 1 },
        { url: 'https://via.placeholder.com/400x300', alt_text: 'Sample 3', caption: 'Gallery Image 3', width: 400, height: 300, index: 2 },
    ];

    const renderPreview = () => {
        try {
            const context = prepareGalleryContext(
                sampleImages,
                { showCaptions: true, enableLightbox: false },
                variables
            );
            const html = renderMustache(template, context);
            return (
                <div>
                    {css && <style>{css}</style>}
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                </div>
            );
        } catch (error) {
            return <div className="text-red-600 text-sm">Preview error: {error.message}</div>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-gray-600">Loading style...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(`/settings/themes/${themeId}/gallery-styles`)}
                                className="inline-flex items-center text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-5 h-5 mr-1" />
                                Back to Gallery Styles
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">
                                    Edit: {name || styleKey}
                                </h1>
                                <p className="text-sm text-gray-500">
                                    Theme: {themeData?.name}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${showPreview
                                    ? 'bg-gray-600 text-white hover:bg-gray-700'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                <Eye className="w-4 h-4" />
                                Preview
                            </button>
                            <button
                                onClick={() => window.open('/docs/gallery-styles-reference.html', '_blank')}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                            >
                                <BookOpen className="w-4 h-4" />
                                Documentation
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={updateMutation.isLoading || !isDirty}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                {updateMutation.isLoading ? 'Saving...' : isDirty ? 'Save Style' : 'No Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Editor */}
                    <div className="space-y-6">
                        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Style Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Optional description"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Imgproxy Config */}
                            <div className="bg-blue-50 border border-blue-200 rounded p-4">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                                    Image Processing (imgproxy)
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Width (px)
                                        </label>
                                        <input
                                            type="number"
                                            value={imgproxyConfig.width || ''}
                                            onChange={(e) => setImgproxyConfig({
                                                ...imgproxyConfig,
                                                width: parseInt(e.target.value) || null,
                                            })}
                                            placeholder="800"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Height (px)
                                        </label>
                                        <input
                                            type="number"
                                            value={imgproxyConfig.height || ''}
                                            onChange={(e) => setImgproxyConfig({
                                                ...imgproxyConfig,
                                                height: parseInt(e.target.value) || null,
                                            })}
                                            placeholder="600"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Max Width (px)
                                        </label>
                                        <input
                                            type="number"
                                            value={imgproxyConfig.max_width || ''}
                                            onChange={(e) => setImgproxyConfig({
                                                ...imgproxyConfig,
                                                max_width: parseInt(e.target.value) || null,
                                            })}
                                            placeholder="1600"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Prevents upscaling</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Max Height (px)
                                        </label>
                                        <input
                                            type="number"
                                            value={imgproxyConfig.max_height || ''}
                                            onChange={(e) => setImgproxyConfig({
                                                ...imgproxyConfig,
                                                max_height: parseInt(e.target.value) || null,
                                            })}
                                            placeholder="1200"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Prevents upscaling</p>
                                    </div>
                                </div>
                            </div>

                            {/* Template Editor */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Mustache Template
                                </label>
                                <CodeEditorPanel
                                    data={template}
                                    onChange={setTemplate}
                                    mode="text"
                                />
                            </div>

                            {/* CSS Editor */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    CSS Styles
                                </label>
                                <CodeEditorPanel
                                    data={css}
                                    onChange={setCss}
                                    mode="css"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Quick Reference + Preview */}
                    <div className="lg:sticky lg:top-24 h-fit space-y-6">
                        {/* Quick Reference */}
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">📋 Quick Reference</h4>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <p className="font-medium text-gray-700 mb-1">Top-Level Variables:</p>
                                    <div className="flex flex-wrap gap-2">
                                        <code className="px-2 py-1 bg-white rounded text-xs border">images</code>
                                        <code className="px-2 py-1 bg-white rounded text-xs border">imageCount</code>
                                        <code className="px-2 py-1 bg-white rounded text-xs border">multipleImages</code>
                                        <code className="px-2 py-1 bg-white rounded text-xs border">showCaptions</code>
                                        <code className="px-2 py-1 bg-white rounded text-xs border">enableLightbox</code>
                                        <code className="px-2 py-1 bg-white rounded text-xs border">columns</code>
                                    </div>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-700 mb-1">Image Properties:</p>
                                    <div className="flex flex-wrap gap-2">
                                        <code className="px-2 py-1 bg-white rounded text-xs border">url</code>
                                        <code className="px-2 py-1 bg-white rounded text-xs border">srcset</code>
                                        <code className="px-2 py-1 bg-white rounded text-xs border">display_width</code>
                                        <code className="px-2 py-1 bg-white rounded text-xs border">display_height</code>
                                        <code className="px-2 py-1 bg-white rounded text-xs border">alt_text</code>
                                        <code className="px-2 py-1 bg-white rounded text-xs border">caption</code>
                                        <code className="px-2 py-1 bg-white rounded text-xs border">index</code>
                                    </div>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-700 mb-1">Basic Template:</p>
                                    <pre className="bg-white p-2 rounded text-xs overflow-x-auto border">
                                        {`<div class="gallery">
  {{#images}}
    <img src="{{url}}" srcset="{{srcset}}" 
         width="{{display_width}}" height="{{display_height}}"
         alt="{{alt_text}}" loading="lazy">
  {{/images}}
</div>`}
                                    </pre>
                                </div>
                            </div>
                        </div>

                        {/* Preview Panel */}
                        {showPreview && (
                            <div className="bg-white border border-gray-200 rounded-lg p-6">
                                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                                    Preview
                                </h3>
                                <div className="border border-gray-300 rounded p-4 bg-gray-50">
                                    {renderPreview()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GalleryStyleEditPage;

