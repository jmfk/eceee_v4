/**
 * Theme Editor Component (Redesigned)
 * 
 * Complete redesign with 5-part theme system:
 * 1. Fonts - Google Fonts integration
 * 2. Colors - Named color palette
 * 3. Typography - Grouped HTML element styles with targeting
 * 4. Component Styles - HTML templates + CSS
 * 5. Table Templates - Predefined table templates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { themesApi } from '../api';
import { extractErrorMessage } from '../utils/errorHandling.js';
import { useNotificationContext } from './NotificationManager';
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext';
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext';
import {
    Plus, Edit3, Trash2, ArrowLeft, Copy, Star, Palette, Upload, X
} from 'lucide-react';

// Import tab components
import FontsTab from './theme/FontsTab';
import ColorsTab from './theme/ColorsTab';
import TypographyTab from './theme/TypographyTab';
import ComponentStylesTab from './theme/ComponentStylesTab';
import GalleryStylesTab from './theme/GalleryStylesTab';
import CarouselStylesTab from './theme/CarouselStylesTab';
import TableTemplatesTab from './theme/TableTemplatesTab';
import ImageUpload from './theme/ImageUpload';

const ThemeEditor = ({ onSave }) => {
    const { themeId, tab } = useParams();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();
    const { showConfirm } = useNotificationContext();
    const { addNotification } = useGlobalNotifications();
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // Derive view mode from URL
    const isCreating = themeId === 'new';
    const isEditing = !!themeId && themeId !== 'new';
    const currentView = themeId ? 'edit' : 'list';
    const activeTab = tab || 'basic';

    // Use UDC for theme data management
    const {
        state,
        initTheme,
        updateTheme,
        updateThemeField,
        setThemeDirty,
        saveCurrentTheme,
        useExternalChanges
    } = useUnifiedData();

    // Track theme data from UDC using subscription
    const [currentThemeData, setCurrentThemeData] = useState(null);

    // Subscribe to UDC changes
    useExternalChanges('theme-editor', (udcState) => {
        const currentThemeId = udcState.metadata.currentThemeId;
        const themeData = currentThemeId ? udcState.themes[currentThemeId] : null;
        setCurrentThemeData(themeData);
    });

    // Also get current state for dirty flag
    const isThemeDirty = state.metadata.isThemeDirty;
    const themeData = currentThemeData;

    // Fetch themes list
    const { data: themes = [], isLoading } = useQuery({
        queryKey: ['themes'],
        queryFn: async () => {
            try {
                const response = await themesApi.list();
                let themeData = null;
                if (Array.isArray(response)) {
                    themeData = response;
                } else if (response?.data && Array.isArray(response.data)) {
                    themeData = response.data;
                } else if (response?.results && Array.isArray(response.results)) {
                    themeData = response.results;
                } else {
                    themeData = [];
                }
                return themeData || [];
            } catch (error) {
                console.error('Error fetching themes:', error);
                throw error;
            }
        },
    });

    // Fetch individual theme when editing (separate from list query for fresh data)
    const { data: selectedThemeData, isLoading: themeLoading } = useQuery({
        queryKey: ['themes', themeId],
        queryFn: async () => {
            if (!themeId || themeId === 'new') return null;
            const response = await themesApi.get(themeId);
            return response;
        },
        enabled: !!themeId && themeId !== 'new',
    });

    // Initialize UDC with theme data when editing (use fresh data from server)
    useEffect(() => {
        if (isCreating) {
            // Initialize empty theme for creation
            const newThemeId = `new-theme-${Date.now()}`;
            const emptyTheme = {
                id: newThemeId,
                name: '',
                description: '',
                fonts: {},
                colors: {},
                typography: { groups: [] },
                componentStyles: {},
                tableTemplates: {},
                isActive: true,
                isDefault: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            initTheme(newThemeId, emptyTheme);
        } else if (isEditing && selectedThemeData) {
            // Initialize theme from fresh server data
            const themeForUDC = {
                id: String(selectedThemeData.id),
                name: selectedThemeData.name || '',
                description: selectedThemeData.description || '',
                fonts: selectedThemeData.fonts || {},
                colors: selectedThemeData.colors || {},
                typography: selectedThemeData.typography || { groups: [] },
                componentStyles: selectedThemeData.componentStyles || {},
                tableTemplates: selectedThemeData.tableTemplates || {},
                isActive: selectedThemeData.isActive ?? true,
                isDefault: selectedThemeData.isDefault ?? false,
                createdAt: selectedThemeData.createdAt || new Date().toISOString(),
                updatedAt: selectedThemeData.updatedAt || new Date().toISOString(),
                createdBy: selectedThemeData.createdBy,
            };
            initTheme(String(selectedThemeData.id), themeForUDC);
        }
    }, [themeId, isCreating, isEditing, selectedThemeData, initTheme]);

    // Filter themes based on search term
    const filteredThemes = themes.filter(theme =>
        theme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        theme.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (data) => {
            return await themesApi.create(data);
        },
        onSuccess: async (data) => {
            // Invalidate and refetch to ensure list updates
            await queryClient.invalidateQueries(['themes']);
            await queryClient.refetchQueries(['themes']);
            addNotification({
                type: 'success',
                message: `Theme "${data.name}" created successfully`,
            });
            navigate('/settings/themes');
        },
        onError: (error) => {
            addNotification({
                type: 'error',
                message: extractErrorMessage(error, 'Failed to create theme'),
            });
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            return await themesApi.update(id, data);
        },
        onSuccess: async (data) => {
            // Invalidate and refetch to ensure list updates
            await queryClient.invalidateQueries(['themes']);
            await queryClient.refetchQueries(['themes']);
            addNotification({
                type: 'success',
                message: `Theme "${data.name}" updated successfully`,
            });
            navigate('/settings/themes');
        },
        onError: (error) => {
            addNotification({
                type: 'error',
                message: extractErrorMessage(error, 'Failed to update theme'),
            });
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            return await themesApi.delete(id);
        },
        onSuccess: async () => {
            // Invalidate and refetch to ensure list updates
            await queryClient.invalidateQueries(['themes']);
            await queryClient.refetchQueries(['themes']);
            addNotification({
                type: 'success',
                message: 'Theme deleted successfully',
            });
        },
        onError: (error) => {
            addNotification({
                type: 'error',
                message: extractErrorMessage(error, 'Failed to delete theme'),
            });
        },
    });

    // Clone mutation
    const cloneMutation = useMutation({
        mutationFn: async ({ id, name }) => {
            return await themesApi.clone(id, name ? { name } : {});
        },
        onSuccess: async (data) => {
            // Invalidate and refetch to ensure list updates
            await queryClient.invalidateQueries(['themes']);
            await queryClient.refetchQueries(['themes']);
            addNotification({
                type: 'success',
                message: `Theme cloned as "${data.theme.name}"`,
            });
        },
        onError: (error) => {
            addNotification({
                type: 'error',
                message: extractErrorMessage(error, 'Failed to clone theme'),
            });
        },
    });

    const handleCreateNew = () => {
        navigate('/settings/themes/new');
    };

    const handleEditTheme = (theme) => {
        navigate(`/settings/themes/${theme.id}`);
    };

    const handleBackToList = () => {
        navigate('/settings/themes');
        // Clear theme from UDC
        setThemeDirty(false);
    };

    // Expose save handler for external use (SettingsManager)
    const handleSaveTheme = useCallback(async () => {
        try {
            if (isCreating) {
                // For new themes, use direct API since UDC ID is temporary
                // Filter out imageFile and imagePreview - these are UI-only fields
                const { imageFile, imagePreview, ...themeDataToSave } = themeData;
                const result = await themesApi.create(themeDataToSave);

                // Upload image if one was selected
                if (imageFile) {
                    try {
                        await themesApi.updateImage(result.id, imageFile);
                    } catch (imgError) {
                        console.error('Failed to upload image:', imgError);
                        // Don't fail the whole operation if just image fails
                    }
                }

                addNotification({
                    type: 'success',
                    message: `Theme "${result.name}" created successfully`,
                });
                queryClient.invalidateQueries(['themes']);
                setThemeDirty(false);
                // Navigate to the newly created theme with current tab
                navigate(`/settings/themes/${result.id}/${activeTab}`);
            } else {
                // For existing themes, use UDC's save method
                const result = await saveCurrentTheme();
                addNotification({
                    type: 'success',
                    message: `Theme "${themeData.name}" updated successfully`,
                });
                queryClient.invalidateQueries(['themes']);
                // Stay on current page - don't navigate away
            }
        } catch (error) {
            addNotification({
                type: 'error',
                message: extractErrorMessage(error, isCreating ? 'Failed to create theme' : 'Failed to update theme'),
            });
        }
    }, [isCreating, themeData, saveCurrentTheme, addNotification, queryClient, setThemeDirty, navigate, activeTab]);

    // Provide save handler to SettingsManager when editing
    useEffect(() => {
        if (onSave && currentView === 'edit') {
            // Pass the save function to SettingsManager
            onSave(() => handleSaveTheme);
        } else if (onSave && currentView === 'list') {
            // Clear the save handler when not editing
            onSave(null);
        }
    }, [onSave, handleSaveTheme, currentView]);

    const handleDelete = async (theme) => {
        const confirmed = await showConfirm(
            'Delete Theme',
            `Are you sure you want to delete the theme "${theme.name}"?`
        );
        if (confirmed) {
            deleteMutation.mutate(theme.id);
        }
    };

    const handleClone = async (theme) => {
        const newName = prompt('Enter a name for the cloned theme:', `${theme.name} (Copy)`);
        if (newName) {
            cloneMutation.mutate({ id: theme.id, name: newName });
        }
    };

    const handleImageUpload = async (file) => {
        if (!file) return;

        setIsUploadingImage(true);
        try {
            if (isCreating) {
                // For new themes, just preview it locally until theme is created
                const reader = new FileReader();
                reader.onloadend = () => {
                    updateThemeField('imagePreview', reader.result);
                };
                reader.readAsDataURL(file);
                // Store the file to upload after creation
                updateThemeField('imageFile', file);
                addNotification({
                    type: 'info',
                    message: 'Image will be uploaded when theme is saved',
                });
            } else {
                // For existing themes, upload immediately using PATCH with FormData
                const formData = new FormData();
                formData.append('image', file);

                const result = await themesApi.updateImage(themeId, file);

                // Update the image in UDC
                updateThemeField('image', result.image);

                await queryClient.invalidateQueries(['themes', themeId]);
                await queryClient.refetchQueries(['themes', themeId]);
                addNotification({
                    type: 'success',
                    message: 'Theme image updated successfully',
                });
            }
        } catch (error) {
            addNotification({
                type: 'error',
                message: extractErrorMessage(error, 'Failed to upload image'),
            });
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleImageRemove = async () => {
        setIsUploadingImage(true);
        try {
            if (isCreating) {
                // For new themes, just clear the preview
                updateThemeField('imagePreview', null);
                updateThemeField('imageFile', null);
            } else {
                // For existing themes, send PATCH with image=null
                const formData = new FormData();
                formData.append('image', ''); // Empty string to clear

                const result = await themesApi.update(themeId, { image: null });

                // Update the image in UDC
                updateThemeField('image', null);

                await queryClient.invalidateQueries(['themes', themeId]);
                await queryClient.refetchQueries(['themes', themeId]);
                addNotification({
                    type: 'success',
                    message: 'Theme image removed',
                });
            }
        } catch (error) {
            addNotification({
                type: 'error',
                message: extractErrorMessage(error, 'Failed to remove image'),
            });
        } finally {
            setIsUploadingImage(false);
        }
    };

    const tabs = [
        { id: 'basic', label: 'Basic Info' },
        { id: 'fonts', label: 'Fonts' },
        { id: 'colors', label: 'Colors' },
        { id: 'typography', label: 'Typography' },
        { id: 'component-styles', label: 'Component Styles' },
        { id: 'gallery-styles', label: 'Galleries' },
        { id: 'carousel-styles', label: 'Carousels' },
        { id: 'table-templates', label: 'Table Templates' },
    ];

    if (currentView === 'list') {
        return (
            <div className="p-6">
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Theme Management</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Create and manage themes with fonts, colors, typography, component styles, and table templates
                            </p>
                        </div>
                        <button
                            onClick={handleCreateNew}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Theme
                        </button>
                    </div>

                    {/* Search */}
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search themes..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Themes List */}
                {isLoading ? (
                    <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-gray-600">Loading themes...</p>
                    </div>
                ) : filteredThemes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredThemes.map((theme) => (
                            <div
                                key={theme.id}
                                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 transition-colors flex flex-col"
                            >
                                {/* Theme Preview Image */}
                                {theme.image ? (
                                    <div className="w-full h-32 bg-gray-100 overflow-hidden">
                                        <img
                                            src={theme.image}
                                            alt={theme.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                        <div className="text-gray-400 text-center">
                                            <Palette className="w-8 h-8 mx-auto mb-1" />
                                            <div className="text-xs">No Preview</div>
                                        </div>
                                    </div>
                                )}

                                {/* Content */}
                                <div className="p-4 flex-1 flex flex-col">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                                {theme.name}
                                                {theme.isDefault && (
                                                    <Star className="w-4 h-4 text-yellow-500 fill-current" title="Default Theme" />
                                                )}
                                            </h3>
                                            {theme.description && (
                                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{theme.description}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Color Palette Preview */}
                                    {theme.colors && Object.keys(theme.colors).length > 0 && (
                                        <div className="flex gap-1 mt-2 mb-4">
                                            {Object.entries(theme.colors).slice(0, 6).map(([name, color]) => (
                                                <div
                                                    key={name}
                                                    className="w-6 h-6 rounded border border-gray-200"
                                                    style={{ backgroundColor: color }}
                                                    title={name}
                                                />
                                            ))}
                                            {Object.keys(theme.colors).length > 6 && (
                                                <div className="w-6 h-6 rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                                                    +{Object.keys(theme.colors).length - 6}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Spacer to push buttons to bottom */}
                                    <div className="flex-1"></div>

                                    {/* Buttons aligned to bottom */}
                                    <div className="flex items-center gap-2 mt-auto">
                                        <button
                                            onClick={() => handleEditTheme(theme)}
                                            className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                        >
                                            <Edit3 className="w-4 h-4 mr-1" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleClone(theme)}
                                            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                            title="Clone theme"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(theme)}
                                            className="inline-flex items-center justify-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                                            title="Delete theme"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <p className="text-gray-600">
                            {searchTerm ? 'No themes found matching your search' : 'No themes created yet'}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // Edit/Create View
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleBackToList}
                                className="inline-flex items-center text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-5 h-5 mr-1" />
                                Back
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">
                                    {isCreating ? 'Create Theme' : `Edit: ${selectedThemeData?.name || 'Theme'}`}
                                    {isThemeDirty && <span className="ml-2 text-sm text-orange-600">• Unsaved changes</span>}
                                </h1>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 flex gap-1 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => navigate(`/settings/themes/${themeId}/${tab.id}`)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === tab.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-6 max-w-7xl mx-auto">
                {/* Tab Content */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    {activeTab === 'basic' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Theme Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={themeData?.name || ''}
                                        onChange={(e) => updateThemeField('name', e.target.value)}
                                        placeholder="My Awesome Theme"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <input
                                        type="text"
                                        value={themeData?.description || ''}
                                        onChange={(e) => updateThemeField('description', e.target.value)}
                                        placeholder="Brief description of this theme"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={themeData?.isActive ?? true}
                                        onChange={(e) => updateThemeField('isActive', e.target.checked)}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                                        Active
                                    </label>
                                </div>

                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="isDefault"
                                        checked={themeData?.isDefault ?? false}
                                        onChange={(e) => updateThemeField('isDefault', e.target.checked)}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-900">
                                        Set as Default Theme
                                    </label>
                                </div>
                            </div>

                            {/* Theme Preview Image */}
                            <ImageUpload
                                imageUrl={themeData?.imagePreview || themeData?.image}
                                onUpload={handleImageUpload}
                                onRemove={handleImageRemove}
                                isUploading={isUploadingImage}
                            />
                        </div>
                    )}

                    {activeTab === 'fonts' && (
                        <FontsTab
                            fonts={themeData?.fonts || {}}
                            onChange={(fonts) => updateThemeField('fonts', fonts)}
                        />
                    )}

                    {activeTab === 'colors' && (
                        <ColorsTab
                            colors={themeData?.colors || {}}
                            onChange={(colors) => updateThemeField('colors', colors)}
                        />
                    )}

                    {activeTab === 'typography' && (
                        <TypographyTab
                            typography={themeData?.typography || { groups: [] }}
                            colors={themeData?.colors || {}}
                            fonts={themeData?.fonts || {}}
                            onChange={(typography) => updateThemeField('typography', typography)}
                            onDirty={() => setThemeDirty(true)}
                        />
                    )}

                    {activeTab === 'component-styles' && (
                        <ComponentStylesTab
                            componentStyles={themeData?.componentStyles || {}}
                            onChange={(componentStyles) => updateThemeField('componentStyles', componentStyles)}
                            onDirty={() => setThemeDirty(true)}
                        />
                    )}

                    {activeTab === 'gallery-styles' && (
                        <GalleryStylesTab
                            galleryStyles={themeData?.galleryStyles || {}}
                            onChange={(galleryStyles) => updateThemeField('galleryStyles', galleryStyles)}
                        />
                    )}

                    {activeTab === 'carousel-styles' && (
                        <CarouselStylesTab
                            carouselStyles={themeData?.carouselStyles || {}}
                            onChange={(carouselStyles) => updateThemeField('carouselStyles', carouselStyles)}
                        />
                    )}

                    {activeTab === 'table-templates' && (
                        <TableTemplatesTab
                            tableTemplates={themeData?.tableTemplates || {}}
                            onChange={(tableTemplates) => updateThemeField('tableTemplates', tableTemplates)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ThemeEditor;
