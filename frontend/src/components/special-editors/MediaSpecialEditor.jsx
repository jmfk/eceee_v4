/**
 * MediaSpecialEditor Component
 * 
 * Simplified, focused media management interface specifically for ImageWidget.
 * Provides distinct workflows for individual images vs collections with proper metadata handling.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
    Image, Upload, Search, Grid3X3, List, Eye, Download, Edit3, Trash2, Plus,
    FolderOpen, Settings, Check, X, ArrowLeft, Tag, FileText, User, Calendar,
    Shuffle, Hash, AlertCircle, Loader2
} from 'lucide-react'
import { namespacesApi, mediaApi, mediaCollectionsApi, mediaTagsApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import MediaTagWidget from '../media/MediaTagWidget'
import MediaSearchWidget from '../media/MediaSearchWidget'
import ImageWidget from '../../widgets/core/ImageWidget'
import { useTheme } from '../../hooks/useTheme'
import FloatingMessage from '../common/FloatingMessage'

const MediaSpecialEditor = ({
    widgetData,
    isAnimating = false,
    isClosing = false,
    onConfigChange,
    namespace: providedNamespace = null
}) => {
    // Get current theme for image styles and notifications
    const { currentTheme } = useTheme()
    const { addNotification } = useGlobalNotifications()

    // Core state
    const [namespace, setNamespace] = useState(null)
    const [loadingNamespace, setLoadingNamespace] = useState(true)
    const [currentView, setCurrentView] = useState('overview') // 'overview', 'browse', 'collections', 'upload', 'verify'

    // Data state
    const [searchResults, setSearchResults] = useState([])
    const [totalResults, setTotalResults] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [collections, setCollections] = useState([])
    const [availableTags, setAvailableTags] = useState([])
    const [pendingUploads, setPendingUploads] = useState([])
    const [collectionImages, setCollectionImages] = useState([])

    // UI state
    const [loading, setLoading] = useState(false)
    const [searchTerms, setSearchTerms] = useState([])
    const [floatingMessages, setFloatingMessages] = useState([])

    // Helper function to show floating messages
    const showFloatingMessage = useCallback((message, type = 'info') => {
        const id = Date.now()
        setFloatingMessages(prev => [...prev, { id, message, type }])
        return id
    }, [])

    const [selectedImage, setSelectedImage] = useState(null)
    const [selectedCollection, setSelectedCollection] = useState(null)
    const [editingItem, setEditingItem] = useState(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
    const [showCloneForm, setShowCloneForm] = useState(false)
    const [cloneCollectionName, setCloneCollectionName] = useState('')
    const [showCreateCollectionForm, setShowCreateCollectionForm] = useState(false)
    const [createCollectionName, setCreateCollectionName] = useState('')
    const [tempSelectedImages, setTempSelectedImages] = useState([])
    const [localConfig, setLocalConfig] = useState({})

    // Use local config that updates immediately, fallback to widgetData config
    const currentConfig = useMemo(() => {
        const baseConfig = { ...(widgetData?.config || {}) }
        // Ensure mediaItems is always an array
        if (!baseConfig.mediaItems) {
            baseConfig.mediaItems = []
        }
        // Ensure searchTerms is always an array
        if (!baseConfig.searchTerms) {
            baseConfig.searchTerms = []
        }
        const mergedConfig = { ...baseConfig, ...localConfig }
        // Double-check arrays after merge
        if (!Array.isArray(mergedConfig.mediaItems)) {
            mergedConfig.mediaItems = []
        }
        if (!Array.isArray(mergedConfig.searchTerms)) {
            mergedConfig.searchTerms = []
        }
        return mergedConfig
    }, [widgetData?.config, localConfig])

    const currentImages = useMemo(() => currentConfig.mediaItems || [], [currentConfig.mediaItems])
    const currentCollectionId = useMemo(() => currentConfig.collectionId || null, [currentConfig.collectionId])

    // Mode detection - defined after currentCollectionId and currentImages
    const isCollectionMode = currentCollectionId !== null
    const isFreeImagesMode = !isCollectionMode && currentImages.length > 0
    const isEmpty = !isCollectionMode && currentImages.length === 0

    // Get available image styles from current theme
    const availableImageStyles = useMemo(() => {
        if (!currentTheme?.image_styles) return []
        return Object.keys(currentTheme.image_styles).map(styleName => ({
            name: styleName,
            config: currentTheme.image_styles[styleName]
        }))
    }, [currentTheme])

    // Enhanced config for preview - includes collection images when in collection mode
    const previewConfig = useMemo(() => {
        if (isCollectionMode && collectionImages.length > 0) {
            // In collection mode: use collection images for preview
            const collectionMediaItems = collectionImages.map(image => ({
                id: image.id,
                url: image.imgproxyBaseUrl || image.fileUrl,
                type: 'image',
                title: image.title || '',
                altText: image.altText || image.title || '',
                caption: image.description || '',
                photographer: image.photographer || '',
                source: image.source || '',
                width: image.width,
                height: image.height,
                thumbnailUrl: image.imgproxyBaseUrl || image.fileUrl
            }))

            return {
                ...currentConfig,
                mediaItems: collectionMediaItems
            }
        } else {
            // In free images mode or empty: use current config as-is
            return currentConfig
        }
    }, [currentConfig, isCollectionMode, collectionImages])

    // Reset local config when widgetData changes
    useEffect(() => {
        setLocalConfig({})
    }, [widgetData])

    // Load namespace and initial data (use provided namespace or default)
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                let effectiveNamespace = providedNamespace

                if (!effectiveNamespace) {
                    // Fall back to default namespace if none provided
                    const defaultNamespace = await namespacesApi.getDefault()
                    effectiveNamespace = defaultNamespace?.slug || null
                }

                setNamespace(effectiveNamespace)

                if (effectiveNamespace) {
                    // Load collections and tags
                    const [collectionsResult, tagsResult] = await Promise.all([
                        mediaCollectionsApi.list({ namespace: effectiveNamespace })(),
                        mediaTagsApi.list({ namespace: effectiveNamespace })()
                    ])

                    const collectionsData = collectionsResult.results || collectionsResult || []
                    const tagsData = tagsResult.results || tagsResult || []

                    setCollections(collectionsData)
                    setAvailableTags(tagsData)
                }
            } catch (error) {
                console.error('Failed to load initial data:', error)
                setNamespace(null)
            } finally {
                setLoadingNamespace(false)
            }
        }

        loadInitialData()
    }, [providedNamespace])

    // Load all images or search for specific images
    const loadImages = useCallback(async (terms = [], page = 1) => {
        if (!namespace) return

        setLoading(true)
        try {
            let result
            // Always use search API to support tag filtering
            result = await mediaApi.search.search({
                namespace,
                file_types: ['image'],  // Use file_types instead of fileType
                page,
                pageSize: 20,
                text_tags: terms.map(tag => tag.value),
                ordering: '-created_at'
            })
            const imagesData = result.results || result || []
            setSearchResults(imagesData)
            setTotalResults(result.count || 0)
            setCurrentPage(page)
        } catch (error) {
            console.error('Failed to load images:', error)
            setSearchResults([])
            setTotalResults(0)
        } finally {
            setLoading(false)
        }
    }, [namespace])

    // Handle search
    const handleSearch = async (term = searchTerms, page = 1) => {
        await loadImages(term, page)
    }

    // Calculate pagination info
    const totalPages = useMemo(() => Math.ceil(totalResults / 20), [totalResults])
    const hasPreviousPage = currentPage > 1
    const hasNextPage = currentPage < totalPages

    // Load collection images
    const loadCollectionImages = useCallback(async (collectionId) => {
        if (!namespace || !collectionId) return

        try {
            const result = await mediaCollectionsApi.getFiles(collectionId, {
                namespace,
                pageSize: 100
            })()
            const images = result.results || result || []
            setCollectionImages(images)
        } catch (error) {
            console.error('Failed to load collection images:', error)
            setCollectionImages([])
        }
    }, [namespace])

    // Load images and refresh tags when entering browse view
    useEffect(() => {
        if (currentView === 'browse' && namespace) {
            // Load images
            loadImages([])

            // Refresh available tags
            const loadTags = async () => {
                try {
                    const tagsResult = await mediaTagsApi.list({ namespace })()
                    const tagsData = tagsResult.results || tagsResult || []
                    setAvailableTags(tagsData)
                } catch (error) {
                    console.error('Failed to load tags:', error)
                }
            }
            loadTags()
        }
    }, [currentView, namespace, loadImages])

    // Load collection images when collection is selected
    useEffect(() => {
        if (currentCollectionId) {
            loadCollectionImages(currentCollectionId)
        } else {
            setCollectionImages([])
        }
    }, [currentCollectionId, loadCollectionImages])

    // Handle image selection for temporary selection
    const handleImageSelect = useCallback((image) => {
        setTempSelectedImages(prev => {
            const isAlreadySelected = prev.some(img => img.id === image.id)
            if (isAlreadySelected) {
                // Remove if already selected
                return prev.filter(img => img.id !== image.id)
            } else {
                // Add to temporary selection
                return [...prev, image]
            }
        })
    }, [])

    // Add temporarily selected images to widget
    const handleAddSelectedImages = useCallback(async () => {
        if (tempSelectedImages.length === 0) return

        // Check if we're in collection mode
        if (isCollectionMode && currentCollectionId) {
            // Collection Mode: Add images to the existing collection
            try {
                setLoading(true)

                // Add images to the collection via API
                const imageIds = tempSelectedImages.map(image => image.id)
                await mediaCollectionsApi.addFiles(currentCollectionId, imageIds)()

                // Refresh collection images to show the new additions
                await loadCollectionImages(currentCollectionId)

                // Update local config and call onConfigChange to reflect collection changes
                const updatedConfig = {
                    ...currentConfig,
                    collectionId: currentCollectionId // Ensure collection ID is preserved
                }

                setLocalConfig(updatedConfig)
                onConfigChange(updatedConfig)

                // Clear temporary selection and return to overview
                setTempSelectedImages([])
                setCurrentView('overview')

            } catch (error) {
                console.error('Failed to add images to collection:', error)
            } finally {
                setLoading(false)
            }
        } else {
            // Free Images Mode: Add images as individual media items
            const newMediaItems = tempSelectedImages.map(image => ({
                id: image.id,
                url: image.imgproxyBaseUrl || image.fileUrl,
                type: 'image',
                title: image.title || '',
                altText: image.altText || image.title || '',
                caption: image.description || '',
                photographer: image.photographer || '',
                source: image.source || '',
                width: image.width,
                height: image.height,
                thumbnailUrl: image.imgproxyBaseUrl || image.fileUrl
            }))

            const updatedConfig = {
                ...currentConfig,
                mediaItems: [...currentImages, ...newMediaItems],
                collectionId: null, // Ensure we stay in free images mode
                displayType: 'gallery' // Default to gallery, widget will handle single image display
            }

            // Update local config immediately for UI feedback
            setLocalConfig(updatedConfig)
            onConfigChange(updatedConfig)

            // Clear temporary selection and return to overview
            setTempSelectedImages([])
            setCurrentView('overview')
        }
    }, [tempSelectedImages, currentConfig, currentImages, onConfigChange, isCollectionMode, currentCollectionId, loadCollectionImages])

    // Clear temporary selection
    const handleClearTempSelection = useCallback(() => {
        setTempSelectedImages([])
    }, [])


    // Handle collection selection - immediate save without modal
    const handleCollectionSelect = useCallback((collection) => {
        setSelectedCollection(collection)

        // Immediately save collection to widget with default config
        const updatedConfig = {
            ...currentConfig,
            collectionId: collection.id,
            collectionConfig: {
                randomize: false,
                maxItems: 0, // 0 = all
                displayType: 'gallery',
                imageStyle: null
            },
            mediaItems: [], // Clear individual images when using collection
            displayType: 'gallery',
            imageStyle: null
        }

        // Update local config immediately for UI feedback
        setLocalConfig(updatedConfig)
        onConfigChange(updatedConfig)

        setCurrentView('overview')
    }, [currentConfig, onConfigChange])



    // Remove image
    const handleRemoveImage = (imageId) => {
        const updatedConfig = {
            ...currentConfig,
            mediaItems: currentImages.filter(img => img.id !== imageId)
        }
        setLocalConfig(updatedConfig)
        onConfigChange(updatedConfig)
    }

    // Remove image from collection
    const handleRemoveImageFromCollection = (image) => {
        if (isCollectionMode && currentCollectionId) {
            setShowDeleteConfirm(image)
        }
    }

    // Handle actual removal of image from collection after confirmation
    const handleConfirmedRemoveFromCollection = async () => {
        try {
            setLoading(true)
            await mediaCollectionsApi.removeFiles(currentCollectionId, [showDeleteConfirm.id])()
            await loadCollectionImages(currentCollectionId)
            setShowDeleteConfirm(null)
            onConfigChange(currentConfig)
        } catch (error) {
            console.error('Failed to remove image from collection:', error)
            showFloatingMessage('Failed to remove image from collection', 'error')
        } finally {
            setLoading(false)
        }
    }

    // Remove collection
    const handleRemoveCollection = () => {
        const updatedConfig = {
            ...currentConfig,
            collectionId: null,
            collectionConfig: null
        }

        setLocalConfig(updatedConfig)
        onConfigChange(updatedConfig)

        // Clear the selected collection from UI state
        setSelectedCollection(null)
    }

    // Convert collection to free images (disconnect from global collection)
    const handleConvertToFreeImages = () => {
        const updatedConfig = {
            ...currentConfig,
            collectionId: null,
            collectionConfig: null,
            mediaItems: collectionImages.map(image => ({
                id: image.id,
                url: image.imgproxyBaseUrl || image.fileUrl,
                type: 'image',
                title: image.title || '',
                altText: image.altText || image.title || '',
                caption: image.description || '',
                photographer: image.photographer || '',
                source: image.source || '',
                width: image.width,
                height: image.height,
                thumbnailUrl: image.imgproxyBaseUrl || image.fileUrl
            })),
            displayType: 'gallery' // Default to gallery, widget will handle single image display
        }

        setLocalConfig(updatedConfig)
        onConfigChange(updatedConfig)

        // Clear the selected collection from UI state since we're no longer using it
        setSelectedCollection(null)
    }

    // Create new collection from current free images
    const handleCreateCollectionFromImages = async () => {
        if (!namespace || !createCollectionName.trim() || currentImages.length === 0) return

        setLoading(true)
        try {
            // Create new collection
            const newCollection = await mediaCollectionsApi.create({
                namespace,
                title: createCollectionName.trim(),
                description: `Collection created from ${currentImages.length} images`,
                tags: []
            })()

            // Add all current images to the new collection
            const imageIds = currentImages.map(image => image.id)
            await mediaCollectionsApi.addFiles(newCollection.id, imageIds)()

            // Switch to collection mode with the new collection
            const updatedConfig = {
                ...currentConfig,
                collectionId: newCollection.id,
                collectionConfig: {
                    randomize: false,
                    maxItems: 0,
                    displayType: 'gallery',
                    imageStyle: null
                },
                mediaItems: [], // Clear individual images since we're now using collection
                displayType: 'gallery' // Default to gallery, widget will handle single image display
            }

            setLocalConfig(updatedConfig)
            onConfigChange(updatedConfig)

            // Refresh collections list
            const collectionsResult = await mediaCollectionsApi.list({ namespace })()
            setCollections(collectionsResult.results || collectionsResult || [])

            // Update UI state to show the new collection as selected
            setSelectedCollection(newCollection)

            setShowCreateCollectionForm(false)
            setCreateCollectionName('')

        } catch (error) {
            console.error('Failed to create collection:', error)
        } finally {
            setLoading(false)
        }
    }

    // Clone collection with new name
    const handleCloneCollection = async () => {
        if (!namespace || !cloneCollectionName.trim() || !currentCollectionId) return

        setLoading(true)
        try {
            // Create new collection with cloned data
            const originalCollection = collections.find(c => c.id === currentCollectionId)
            const newCollection = await mediaCollectionsApi.create({
                namespace,
                title: cloneCollectionName.trim(),
                description: originalCollection?.description || '',
                tags: originalCollection?.tags || []
            })()

            // Add all images from original collection to new collection
            const imageIds = collectionImages.map(image => image.id)
            await mediaCollectionsApi.addFiles(newCollection.id, imageIds)()

            // Switch to the new cloned collection
            const updatedConfig = {
                ...currentConfig,
                collectionId: newCollection.id,
                collectionConfig: {
                    ...currentConfig.collectionConfig,
                    // Preserve all collection settings
                }
            }

            setLocalConfig(updatedConfig)
            onConfigChange(updatedConfig)

            // Refresh collections list
            const collectionsResult = await mediaCollectionsApi.list({ namespace })()
            setCollections(collectionsResult.results || collectionsResult || [])

            // Update UI state to show the cloned collection as selected
            setSelectedCollection(newCollection)

            setShowCloneForm(false)
            setCloneCollectionName('')

        } catch (error) {
            console.error('Failed to clone collection:', error)
        } finally {
            setLoading(false)
        }
    }

    // Handle file upload
    const handleFileUpload = (files) => {
        const newUploads = Array.from(files).map(file => ({
            id: Date.now() + Math.random(),
            file,
            preview: URL.createObjectURL(file),
            metadata: {
                title: file.name.replace(/\.[^/.]+$/, ''),
                altText: '',
                caption: '',
                photographer: '',
                source: '',
                tags: []
            },
            status: 'pending'
        }))

        setPendingUploads(prev => [...prev, ...newUploads])
        setCurrentView('verify')
    }

    // Handle actual upload to media manager with auto-approval
    const handleActualUpload = async () => {
        if (!namespace || pendingUploads.length === 0) return
        setLoading(true)
        try {
            // Step 1: Upload files to pending with force_upload to handle deleted files
            const uploadData = {
                files: pendingUploads.map(upload => upload.file),
                namespace: namespace
            }

            const uploadResult = await mediaApi.upload.upload(uploadData)
            const uploadedFiles = uploadResult.uploadedFiles || []
            const rejectedFiles = uploadResult.rejectedFiles || []


            // Step 2: Handle both new uploads and existing pending files
            const approvalPromises = []
            const filesToAddToWidget = []

            // Handle newly uploaded files
            for (let i = 0; i < uploadedFiles.length; i++) {
                const uploadedFile = uploadedFiles[i]
                const originalUpload = pendingUploads[i]

                if (originalUpload.metadata.tags.length > 0) {
                    // Auto-approve files with tags
                    const approvalData = {
                        title: originalUpload.metadata.title,
                        description: originalUpload.metadata.caption,
                        tag_ids: originalUpload.metadata.tags,
                        access_level: 'public',
                        slug: ''
                    }

                    approvalPromises.push(
                        mediaApi.pendingFiles.approve(uploadedFile.id, approvalData)()
                    )
                }
            }

            // Handle rejected files - check if they can be approved or are duplicates
            for (let i = 0; i < rejectedFiles.length; i++) {
                const rejectedFile = rejectedFiles[i]
                const originalUpload = pendingUploads[i]

                // For duplicates, use the existing file and merge tags
                if (rejectedFile.reason === 'duplicate' && rejectedFile.existingFile) {
                    // Show floating message about using existing file
                    showFloatingMessage(rejectedFile.error, 'info')

                    // Add the existing file to our widget
                    const existingFile = {
                        id: rejectedFile.existingFile.id,
                        title: rejectedFile.existingFile.title,
                        slug: rejectedFile.existingFile.slug,
                        // Add tags from the upload
                        tags: originalUpload?.metadata?.tags || []
                    }
                    filesToAddToWidget.push(existingFile)
                    continue
                }

                // For other cases (pending/deleted), check if we can approve
                if (!originalUpload?.metadata?.tags?.length) continue;
                if ((rejectedFile.reason === 'duplicate_pending' || rejectedFile.reason === 'deleted') && rejectedFile.existingFile) {
                    // Prepare approval data
                    const approvalData = {
                        title: originalUpload.metadata.title,
                        description: originalUpload.metadata.caption,
                        tag_ids: originalUpload.metadata.tags,
                        access_level: 'public',
                        slug: ''
                    }
                    try {
                        approvalPromises.push(
                            mediaApi.pendingFiles.approve(rejectedFile.existingFileId, approvalData)()
                        )
                    } catch (error) {
                        console.error('Failed to approve file:', error)
                        // Continue with other files even if one fails
                    }
                }
            }

            // Execute all approvals and collect approved media files
            const approvedMediaFiles = []
            if (approvalPromises.length > 0) {
                const approvalResults = await Promise.allSettled(approvalPromises)
                const successfulApprovals = approvalResults.filter(r => r.status === 'fulfilled')
                const failedApprovals = approvalResults.filter(r => r.status === 'rejected')


                // Extract the approved media files from successful approvals
                successfulApprovals.forEach((result, index) => {
                    const mediaFile = result.value?.media_file || result.value?.mediaFile
                    if (mediaFile) {
                        approvedMediaFiles.push(mediaFile)
                    }
                })

                if (failedApprovals.length > 0) {
                    console.error('Failed approvals:', failedApprovals.map(f => f.reason))
                }
            }

            // Step 3: Add approved images and duplicates to widget
            const allMediaFiles = [...approvedMediaFiles, ...filesToAddToWidget]
            if (allMediaFiles.length > 0) {
                // Fetch full details for any files we only have IDs for
                const fileDetailsPromises = allMediaFiles.map(file => {
                    if (!file.url) {
                        // This is a duplicate file that needs details
                        return mediaApi.files.get(file.id)().then(response => ({
                            ...response,
                            tags: file.tags // Preserve the new tags
                        }))
                    }
                    return Promise.resolve(file)
                })

                const allFileDetails = await Promise.all(fileDetailsPromises)
                const newMediaItems = allFileDetails.map(mediaFile => ({
                    id: mediaFile.id,
                    url: mediaFile.imgproxyBaseUrl || mediaFile.fileUrl || mediaFile.file_url,
                    type: 'image',
                    title: mediaFile.title || '',
                    altText: mediaFile.altText || mediaFile.alt_text || mediaFile.title || '',
                    caption: mediaFile.description || '',
                    photographer: mediaFile.photographer || '',
                    source: mediaFile.source || '',
                    width: mediaFile.width,
                    height: mediaFile.height,
                    thumbnailUrl: mediaFile.imgproxyBaseUrl || mediaFile.fileUrl || mediaFile.file_url,
                    tags: mediaFile.tags || [] // Include tags
                }))

                // Update widget config with new images
                const updatedConfig = {
                    ...currentConfig,
                    mediaItems: [...currentImages, ...newMediaItems],
                    collectionId: null, // Clear collection when adding individual images
                    displayType: 'gallery' // Default to gallery, widget will handle single image display
                }

                // Update local config immediately for UI feedback
                setLocalConfig(updatedConfig)
                onConfigChange(updatedConfig)

                // Update tags for duplicate files
                const duplicateFiles = filesToAddToWidget.filter(file => file.tags?.length > 0)
                if (duplicateFiles.length > 0) {
                    // First, ensure all tags exist
                    const allTagIds = duplicateFiles.flatMap(file => file.tags)
                    const uniqueTagIds = [...new Set(allTagIds)]

                    // Get existing tags
                    const existingTags = await mediaApi.tags.list({ tag_ids: uniqueTagIds })()
                    const existingTagIds = new Set(existingTags.results.map(tag => tag.id))

                    // Create any missing tags and map old IDs to new UUIDs
                    const missingTagIds = uniqueTagIds.filter(id => !existingTagIds.has(id))
                    const tagIdMapping = new Map() // Map old IDs to new UUIDs

                    if (missingTagIds.length > 0) {
                        const createdTags = await Promise.all(missingTagIds.map(async tagId => {
                            // Generate a slug from the tag name
                            const slug = tagId.toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/^-+|-+$/g, '')
                                .substring(0, 50)

                            const newTag = await mediaApi.tags.create({
                                name: tagId,
                                slug: slug,
                                namespace: namespace
                            })()

                            // Store the mapping between old ID and new UUID
                            tagIdMapping.set(tagId, newTag.id)
                            return newTag
                        }))

                        // Update the tag IDs in our files to use the new UUIDs
                        duplicateFiles.forEach(file => {
                            file.tags = file.tags.map(tagId =>
                                tagIdMapping.get(tagId) || tagId
                            )
                        })
                    }

                    // Now update the files with the tags
                    await Promise.all(duplicateFiles.map(file =>
                        mediaApi.files.update(file.id, { tag_ids: file.tags })()
                    ))
                }
            }

            // Handle results
            const totalUploaded = uploadedFiles.length
            const autoApproved = approvalPromises.length
            const stillPending = totalUploaded - autoApproved

            // Show success messages
            if (totalUploaded > 0) {
                if (autoApproved > 0) {
                    addNotification(`${autoApproved} files uploaded and approved`, 'success')
                }
                if (stillPending > 0) {
                    addNotification(`${stillPending} files pending approval`, 'info')
                }
            }

            // Show rejection messages
            if (rejectedFiles.length > 0) {
                rejectedFiles.forEach(rejection => {
                    // Use floating message for duplicates, regular notification for other rejections
                    if (rejection.reason === 'duplicate') {
                        showFloatingMessage(rejection.error, 'info')
                    } else {
                        addNotification(rejection.error, 'warning')
                    }
                })
            }

            // Clear pending uploads and return to overview
            setPendingUploads([])
            setCurrentView('overview')

            // Refresh the browse results to show new images
            loadImages([])

        } catch (error) {
            console.error('Upload failed:', error)

            // Handle structured error responses
            if (error.context?.data) {
                const responseData = error.context.data

                // Show rejected file messages
                if (responseData.rejectedFiles?.length > 0) {
                    responseData.rejectedFiles.forEach(rejection => {
                        addNotification(rejection.error, rejection.reason === 'duplicate' ? 'info' : 'warning')
                    })
                }

                // Show error messages
                if (responseData.errors?.length > 0) {
                    responseData.errors.forEach(error => {
                        const message = error.error || 'Upload failed'
                        const details = error.technical_details ? `: ${error.technical_details}` : ''
                        addNotification(`${error.filename}: ${message}${details}`, 'error')
                    })
                }
            } else {
                // Handle generic errors
                addNotification('Upload failed: ' + (error.message || 'Unknown error'), 'error')
            }
        } finally {
            setLoading(false)
        }
    }

    // Render different views based on current state
    const renderView = () => {
        if (loadingNamespace) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                        <p className="text-sm text-gray-600">Loading media editor...</p>
                    </div>
                </div>
            )
        }

        if (!namespace) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm text-gray-600">No namespace available</p>
                    </div>
                </div>
            )
        }

        switch (currentView) {
            case 'browse':
                return renderBrowseView()
            case 'collections':
                return renderCollectionsView()
            case 'upload':
                return renderUploadView()
            case 'verify':
                return renderVerifyView()
            case 'collectionImages':
                return renderCollectionImagesView()
            default:
                return renderOverviewView()
        }
    }

    // Overview view - shows current selection and main actions
    const renderOverviewView = () => (
        <div className="p-4 space-y-4 min-h-full">
            {/* Mode Indicator */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 border border-blue-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isCollectionMode ? (
                            <>
                                <FolderOpen className="w-5 h-5 text-blue-600" />
                                <div className="flex flex-col">
                                    <span className="font-medium text-blue-900">
                                        {collections.find(c => c.id === currentCollectionId)?.title || 'Unknown Collection'}
                                    </span>
                                    <span className="text-xs text-blue-600">Global Collection</span>
                                </div>
                            </>
                        ) : isFreeImagesMode ? (
                            <>
                                <Image className="w-5 h-5 text-purple-600" />
                                <div className="flex flex-col">
                                    <span className="font-medium text-purple-900">Free Images</span>
                                    <span className="text-xs text-purple-600">Independent Images</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <Plus className="w-5 h-5 text-gray-600" />
                                <span className="font-medium text-gray-700">Add Images or Select Collection</span>
                            </>
                        )}
                    </div>
                    {isCollectionMode && (
                        <button
                            onClick={handleRemoveCollection}
                            className="p-1 text-blue-600 hover:text-red-600 transition-colors"
                            title="Remove collection"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Current Selection Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                {/* Current Configuration */}

                {isCollectionMode ? (
                    <div className="space-y-4">

                        {/* Collection Images with Edit/Delete */}
                        <div className="grid grid-cols-4 gap-2">
                            {collectionImages.map((image, index) => (
                                <div key={image.id || index} className="relative aspect-square bg-gray-100 rounded overflow-hidden border">
                                    {image.imgproxyBaseUrl || image.fileUrl ? (
                                        <img
                                            src={image.imgproxyBaseUrl || image.fileUrl}
                                            alt={image.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Image className="w-4 h-4 text-gray-400" />
                                        </div>
                                    )}
                                    <div className="absolute top-1 right-1 flex gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleRemoveImageFromCollection(image)
                                            }}
                                            className="p-1 bg-white rounded shadow-sm border border-gray-200 text-gray-700 hover:text-red-600 hover:border-red-300 transition-colors"
                                            title="Remove from collection"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {collectionImages.length === 0 && (
                                <div className="col-span-4 text-center py-4 text-gray-500 text-sm">
                                    No images in collection
                                </div>
                            )}
                        </div>

                        {/* Collection Management Actions */}
                        <div className="pt-2 space-y-3">
                            {/* Warning about global collection modifications */}
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-xs text-amber-800">
                                        <p className="font-medium mb-1">Global Collection</p>
                                        <p>Changes to this collection affect all instances using it.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Clone Collection Form */}
                            {showCloneForm ? (
                                <div className="space-y-3 p-3 border border-gray-200 rounded-lg bg-white">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">New Collection Name</label>
                                        <input
                                            type="text"
                                            value={cloneCollectionName}
                                            onChange={(e) => setCloneCollectionName(e.target.value)}
                                            placeholder="Enter collection name..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setShowCloneForm(false)
                                                setCloneCollectionName('')
                                            }}
                                            className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCloneCollection}
                                            disabled={!cloneCollectionName.trim() || loading}
                                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                                        >
                                            {loading ? 'Cloning...' : 'Clone'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    <button
                                        onClick={() => {
                                            const currentCollection = collections.find(c => c.id === currentCollectionId)
                                            setCloneCollectionName(currentCollection ? `${currentCollection.title} (Copy)` : '')
                                            setShowCloneForm(true)
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
                                    >
                                        Clone Collection
                                    </button>
                                    <button
                                        onClick={handleConvertToFreeImages}
                                        className="w-full px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
                                    >
                                        Convert to Free Images
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : isFreeImagesMode ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            {currentImages.map((image, index) => (
                                <div key={image.id || index} className="relative aspect-square bg-gray-100 rounded overflow-hidden border">
                                    <img
                                        src={image.thumbnailUrl || image.url}
                                        alt={image.altText || 'Image'}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-1 right-1 flex gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleRemoveImage(image.id)
                                            }}
                                            className="p-1 bg-white rounded shadow-sm border border-gray-200 text-gray-700 hover:text-red-600 hover:border-red-300 transition-colors"
                                            title="Remove image"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Free Images Actions */}
                        <div className="pt-2">
                            {showCreateCollectionForm ? (
                                <div className="space-y-3 p-3 border border-gray-200 rounded-lg bg-white">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Collection Name</label>
                                        <input
                                            type="text"
                                            value={createCollectionName}
                                            onChange={(e) => setCreateCollectionName(e.target.value)}
                                            placeholder="Enter collection name..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        This will create a new collection with all {currentImages.length} images and switch to collection mode.
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setShowCreateCollectionForm(false)
                                                setCreateCollectionName('')
                                            }}
                                            className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCreateCollectionFromImages}
                                            disabled={!createCollectionName.trim() || loading}
                                            className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                                        >
                                            {loading ? 'Creating...' : 'Create Collection'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        setCreateCollectionName(`Collection from ${currentImages.length} images`)
                                        setShowCreateCollectionForm(true)
                                    }}
                                    className="w-full px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
                                >
                                    Create Collection from Images
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <Image className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No media selected</p>
                    </div>
                )}
            </div>

            {/* Widget Preview */}
            {
                (currentImages.length > 0 || currentCollectionId) && (
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Eye className="w-5 h-5 text-gray-600" />
                            <h5 className="font-medium text-gray-900">Preview</h5>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <ImageWidget
                                config={previewConfig}
                                mode="preview"
                            />
                        </div>
                    </div>
                )
            }

            {/* Additional Actions */}
            {
                pendingUploads.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                            <p className="font-medium text-orange-900">Pending Uploads</p>
                        </div>
                        <p className="text-sm text-orange-700 mb-3">{pendingUploads.length} files waiting for verification</p>
                        <button
                            onClick={() => setCurrentView('verify')}
                            className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                        >
                            Review & Verify
                        </button>
                    </div>
                )
            }
        </div >
    )

    // Browse view - search and select individual images
    const renderBrowseView = () => (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                    <button
                        onClick={() => {
                            setCurrentView('overview')
                            setTempSelectedImages([]) // Clear temp selection when leaving
                        }}
                        className="p-1 text-gray-600 hover:text-gray-800"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h6 className="font-medium text-gray-900">Browse Images</h6>
                </div>

                <div className="space-y-2">
                    <MediaSearchWidget
                        searchTerms={searchTerms}
                        onChange={(newTags) => {
                            setSearchTerms(newTags)
                            loadImages(newTags)

                            // Just update the search state and load images
                        }}
                        namespace={namespace}
                        placeholder="Search images or select tags..."
                        className="w-full"
                    />
                </div>
            </div>

            {/* Temporary Selection Area */}
            {tempSelectedImages.length > 0 && (
                <div className="p-4 bg-blue-50 border-b border-blue-200">
                    {/* Collection Mode Warning */}
                    {isCollectionMode && (
                        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                            <div className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                <span className="font-medium">Adding to Global Collection</span>
                            </div>
                            <p className="mt-1">These images will be added to the collection and visible in all instances using it.</p>
                        </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                        <h6 className="font-medium text-blue-900">Selected Images ({tempSelectedImages.length})</h6>
                        <div className="flex gap-2">
                            <button
                                onClick={handleClearTempSelection}
                                className="px-2 py-1 text-blue-600 hover:text-blue-800 text-sm"
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleAddSelectedImages}
                                disabled={loading}
                                className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                            >
                                {loading ? 'Adding...' :
                                    isCollectionMode ?
                                        `Add ${tempSelectedImages.length} to Collection` :
                                        `Add ${tempSelectedImages.length} Image${tempSelectedImages.length !== 1 ? 's' : ''}`
                                }
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto">
                        {tempSelectedImages.map((image, index) => (
                            <div key={image.id} className="relative flex-shrink-0">
                                <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden border-2 border-blue-300">
                                    <img
                                        src={image.imgproxyBaseUrl || image.fileUrl}
                                        alt={image.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <button
                                    onClick={() => setTempSelectedImages(prev => prev.filter(img => img.id !== image.id))}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
                {/* Pagination */}
                {totalResults > 0 && (
                    <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
                        <p>
                            {((currentPage - 1) * 20) + 1}-{Math.min(currentPage * 20, totalResults)} of {totalResults}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handleSearch(searchTerms, currentPage - 1)}
                                disabled={!hasPreviousPage || loading}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:hover:text-gray-400"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                            <div className="flex items-center gap-0.5">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum
                                    if (totalPages <= 5) {
                                        pageNum = i + 1
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i
                                    } else {
                                        pageNum = currentPage - 2 + i
                                    }
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => handleSearch(searchTerms, pageNum)}
                                            disabled={loading}
                                            className={`px-2 py-0.5 text-sm ${currentPage === pageNum
                                                ? 'text-blue-600 font-medium'
                                                : 'text-gray-500 hover:text-gray-700'
                                                } disabled:opacity-30`}
                                        >
                                            {pageNum}
                                        </button>
                                    )
                                })}
                            </div>
                            <button
                                onClick={() => handleSearch(searchTerms, currentPage + 1)}
                                disabled={!hasNextPage || loading}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:hover:text-gray-400"
                            >
                                <ArrowLeft className="h-4 w-4 transform rotate-180" />
                            </button>
                        </div>
                    </div>
                )}

                {searchResults.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                        {searchResults.map(image => {
                            const isSelected = tempSelectedImages.some(img => img.id === image.id)
                            return (
                                <div
                                    key={image.id}
                                    onClick={() => handleImageSelect(image)}
                                    className={`relative cursor-pointer bg-gray-100 rounded overflow-hidden aspect-square hover:shadow-md transition-shadow border-2 ${isSelected ? 'border-blue-500' : 'border-gray-200'
                                        }`}
                                >
                                    {image.imgproxyBaseUrl || image.fileUrl ? (
                                        <img
                                            src={image.imgproxyBaseUrl || image.fileUrl}
                                            alt={image.title}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.style.display = 'none'
                                                e.target.nextSibling.style.display = 'flex'
                                            }}
                                        />
                                    ) : null}
                                    <div className="w-full h-full flex items-center justify-center" style={{ display: 'none' }}>
                                        <Image className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <div className="absolute top-1 right-1">
                                        <div className={`rounded-full p-1.5 shadow-sm border ${isSelected
                                            ? 'bg-blue-600 border-blue-600'
                                            : 'bg-white border-gray-200'
                                            }`}>
                                            {isSelected ? (
                                                <Check className="w-3 h-3 text-white" />
                                            ) : (
                                                <Plus className="w-3 h-3 text-gray-700" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                                        <p className="text-white text-xs font-medium truncate">{image.title}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : searchTerms.length > 0 && !loading ? (
                    <div className="text-center py-8 text-gray-500">
                        <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No images found for "{searchTerms.map(t => t.value).join(', ')}"</p>
                    </div>
                ) : searchTerms.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p className="mb-4">Browse all images or search for specific ones</p>
                        <button
                            onClick={() => loadImages([])}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2 inline" /> : null}
                            Load All Images
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No images found for "{searchTerms.map(t => t.value).join(', ')}"</p>
                    </div>
                )}

            </div>
        </div>
    )

    // Collections view - select from available collections
    const renderCollectionsView = () => (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentView('overview')}
                        className="p-1 text-gray-600 hover:text-gray-800"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h6 className="font-medium text-gray-900">Select Collection</h6>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {collections.length > 0 ? (
                    <div className="space-y-3">
                        {collections.map(collection => (
                            <div
                                key={collection.id}
                                onClick={() => handleCollectionSelect(collection)}
                                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <FolderOpen className="w-8 h-8 text-blue-600 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{collection.title}</p>
                                    <p className="text-sm text-gray-600">{collection.description || 'No description'}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {collection.fileCount || 0} images
                                    </p>
                                </div>
                                <Plus className="w-5 h-5 text-gray-400" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No collections available</p>
                    </div>
                )}
            </div>
        </div>
    )

    // Upload view - drag & drop file upload
    const renderUploadView = () => (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentView('overview')}
                        className="p-1 text-gray-600 hover:text-gray-800"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h6 className="font-medium text-gray-900">Upload Images</h6>
                </div>
            </div>

            <div className="flex-1 p-4">
                <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                    onDrop={(e) => {
                        e.preventDefault()
                        handleFileUpload(e.dataTransfer.files)
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => document.getElementById('file-upload').click()}
                >
                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-900 mb-2">Upload Images</p>
                    <p className="text-sm text-gray-600 mb-4">Drag and drop images here, or click to browse</p>
                    <p className="text-xs text-gray-500">Supported formats: JPG, PNG, GIF, WebP</p>

                    <input
                        id="file-upload"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e.target.files)}
                        className="hidden"
                    />
                </div>
            </div>
        </div>
    )

    // Verify view - review uploaded files before adding to library
    const renderVerifyView = () => (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentView('overview')}
                        className="p-1 text-gray-600 hover:text-gray-800"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h6 className="font-medium text-gray-900">Verify Uploads</h6>
                    <span className="text-sm text-gray-500">({pendingUploads.length} files)</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                    {pendingUploads.map((upload, index) => (
                        <div key={upload.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex gap-4">
                                <img
                                    src={upload.preview}
                                    alt="Upload preview"
                                    className="w-20 h-20 object-cover rounded"
                                />
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                        <input
                                            type="text"
                                            value={upload.metadata.title}
                                            onChange={(e) => {
                                                const updated = [...pendingUploads]
                                                updated[index].metadata.title = e.target.value
                                                setPendingUploads(updated)
                                            }}
                                            className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Tags <span className="text-red-500">*</span>
                                        </label>
                                        <MediaTagWidget
                                            tags={upload.metadata.tags}
                                            onChange={(newTags) => {
                                                const updated = [...pendingUploads]
                                                updated[index].metadata.tags = newTags
                                                setPendingUploads(updated)
                                            }}
                                            namespace={namespace}
                                        />
                                        {upload.metadata.tags.length === 0 && (
                                            <p className="text-xs text-red-500 mt-1">At least one tag is required</p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        URL.revokeObjectURL(upload.preview)
                                        setPendingUploads(prev => prev.filter(u => u.id !== upload.id))
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-600"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {pendingUploads.length > 0 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={handleActualUpload}
                        disabled={pendingUploads.some(u => u.metadata.tags.length === 0) || loading}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                                Uploading...
                            </>
                        ) : (
                            `Upload ${pendingUploads.length} Files`
                        )}
                    </button>
                </div>
            )}
        </div>
    )

    // Collection Images Management view
    const renderCollectionImagesView = () => (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentView('overview')}
                        className="p-1 text-gray-600 hover:text-gray-800"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h6 className="font-medium text-gray-900">Manage Collection Images</h6>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                    {collections.find(c => c.id === currentCollectionId)?.title || 'Collection'}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {collectionImages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                        {collectionImages.map((image, index) => (
                            <div
                                key={image.id || index}
                                className="relative bg-gray-100 rounded overflow-hidden aspect-square border"
                            >
                                {image.imgproxyBaseUrl || image.fileUrl ? (
                                    <img
                                        src={image.imgproxyBaseUrl || image.fileUrl}
                                        alt={image.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Image className="w-8 h-8 text-gray-400" />
                                    </div>
                                )}
                                <div className="absolute top-1 right-1 flex gap-1">
                                    <button
                                        className="p-1 bg-white rounded shadow-sm border border-gray-200 text-gray-700 hover:text-blue-600 hover:border-blue-300 transition-colors"
                                        title="View"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            // TODO: Implement image preview
                                        }}
                                    >
                                        <Eye className="w-3 h-3" />
                                    </button>
                                    <button
                                        className="p-1 bg-white rounded shadow-sm border border-gray-200 text-gray-700 hover:text-red-600 hover:border-red-300 transition-colors"
                                        title="Remove from collection"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            // TODO: Implement remove from collection
                                        }}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                                    <p className="text-white text-xs font-medium truncate">{image.title}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No images in this collection</p>
                    </div>
                )}
            </div>

        </div>
    )

    return (
        <div className="h-full flex flex-col">
            {/* Floating Messages */}
            {floatingMessages.map(msg => (
                <FloatingMessage
                    key={msg.id}
                    message={msg.message}
                    type={msg.type}
                    onClose={() => setFloatingMessages(prev => prev.filter(m => m.id !== msg.id))}
                />
            ))}

            {/* Header */}
            <div className={`px-4 py-3 border-b border-gray-200 bg-white transition-all duration-300 ${isAnimating ? 'animate-fade-in-up delay-100' : ''
                } ${isClosing ? 'animate-fade-out-down' : ''
                }`}>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-medium text-gray-900 flex items-center">
                        <Image className={`w-4 h-4 mr-2 transition-all duration-300 delay-200 ${isAnimating ? 'animate-bounce-in' : ''
                            }`} />
                        Media Manager
                    </h4>
                    {pendingUploads.length > 0 && currentView !== 'verify' && (
                        <button
                            onClick={() => setCurrentView('verify')}
                            className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs"
                        >
                            <AlertCircle className="w-3 h-3" />
                            {pendingUploads.length} pending
                        </button>
                    )}
                </div>

                {/* Main Actions - Always visible at top */}
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => setCurrentView('browse')}
                        className={`flex flex-col items-center gap-1 p-3 border rounded-lg transition-colors text-sm ${currentView === 'browse' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Images</span>
                    </button>

                    <button
                        onClick={() => setCurrentView('collections')}
                        className={`flex flex-col items-center gap-1 p-3 border rounded-lg transition-colors text-sm ${currentView === 'collections' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        <FolderOpen className="w-4 h-4" />
                        <span>Select Collection</span>
                    </button>

                    <div
                        className={`flex flex-col items-center gap-1 p-3 border-2 border-dashed rounded-lg transition-colors text-sm cursor-pointer ${currentView === 'upload' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                            }`}
                        onClick={() => document.getElementById('header-file-upload').click()}
                        onDrop={(e) => {
                            e.preventDefault()
                            handleFileUpload(e.dataTransfer.files)
                        }}
                        onDragOver={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.add('border-purple-500', 'bg-purple-100')
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.remove('border-purple-500', 'bg-purple-100')
                        }}
                    >
                        <Upload className="w-4 h-4" />
                        <span>Drop Files</span>
                        <input
                            id="header-file-upload"
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e.target.files)}
                            className="hidden"
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className={`flex-1 overflow-y-auto transition-all duration-500 delay-300 ${isAnimating ? 'animate-fade-in-up' : ''
                }`}>
                {renderView()}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h5 className="font-medium text-gray-900">
                                Remove Image from Collection
                            </h5>
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="aspect-video bg-gray-100 rounded overflow-hidden">
                                <img
                                    src={showDeleteConfirm.imgproxyBaseUrl || showDeleteConfirm.fileUrl}
                                    alt={showDeleteConfirm.title || 'Image'}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <p className="text-gray-600">
                                Are you sure you want to remove <strong>{showDeleteConfirm.title || 'this image'}</strong> from the collection?
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowDeleteConfirm(null)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmedRemoveFromCollection}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                >
                                    Remove Image
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Collection Configuration Modal */}
            {editingItem && editingItem.type === 'editCollection' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h5 className="font-medium text-gray-900">
                                Collection Settings
                            </h5>
                            <button
                                onClick={() => setEditingItem(null)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="p-3 bg-gray-50 rounded">
                                <p className="font-medium text-gray-900">{editingItem.data.title}</p>
                                <p className="text-sm text-gray-600">{editingItem.data.description}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {editingItem.data.fileCount || 0} images
                                </p>
                            </div>

                            <div>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={editingItem.config.randomize}
                                        onChange={(e) => setEditingItem(prev => ({
                                            ...prev,
                                            config: { ...prev.config, randomize: e.target.checked }
                                        }))}
                                    />
                                    <span className="text-sm">Randomize order</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Display Type</label>
                                <div className="flex gap-2">
                                    {['gallery', 'carousel'].map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setEditingItem(prev => ({
                                                ...prev,
                                                config: { ...prev.config, displayType: type }
                                            }))}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${editingItem.config.displayType === type
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {type === 'gallery' ? 'Gallery' : 'Carousel'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Image Style</label>
                                <select
                                    value={editingItem.config.imageStyle || ''}
                                    onChange={(e) => setEditingItem(prev => ({
                                        ...prev,
                                        config: { ...prev.config, imageStyle: e.target.value || null }
                                    }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Default Style</option>
                                    {availableImageStyles.map((style) => (
                                        <option key={style.name} value={style.name}>
                                            {style.name} ({style.config.alignment || 'center'}, {style.config.galleryColumns || 3} cols)
                                        </option>
                                    ))}
                                </select>
                                {availableImageStyles.length === 0 && (
                                    <p className="text-sm text-gray-500 mt-1">
                                        No image styles defined in current theme. Go to Theme Manager to create image styles.
                                    </p>
                                )}
                            </div>

                            {editingItem.config.displayType === 'carousel' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Auto-play Interval</label>
                                    <select
                                        value={editingItem.config.autoPlayInterval || 3}
                                        onChange={(e) => setEditingItem(prev => ({
                                            ...prev,
                                            config: { ...prev.config, autoPlayInterval: parseInt(e.target.value) }
                                        }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value={1}>1 second</option>
                                        <option value={2}>2 seconds</option>
                                        <option value={3}>3 seconds</option>
                                        <option value={4}>4 seconds</option>
                                        <option value={5}>5 seconds</option>
                                        <option value={7}>7 seconds</option>
                                        <option value={10}>10 seconds</option>
                                        <option value={15}>15 seconds</option>
                                        <option value={30}>30 seconds</option>
                                    </select>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingItem(null)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        // Update existing collection config
                                        const updatedConfig = {
                                            ...currentConfig,
                                            collectionConfig: editingItem.config,
                                            displayType: editingItem.config.displayType,
                                            imageStyle: editingItem.config.imageStyle
                                        }
                                        setEditingItem(null)
                                        onConfigChange(updatedConfig)
                                    }}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Update Settings
                                </button>
                            </div>
                        </div>
                        ) : (
                        <div className="space-y-4">
                            <div className="p-3 bg-gray-50 rounded">
                                <p className="font-medium text-gray-900">{editingItem.data.title}</p>
                                <p className="text-sm text-gray-600">{editingItem.data.description}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {editingItem.data.fileCount || 0} images
                                </p>
                            </div>

                            <div>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={editingItem.config.randomize}
                                        onChange={(e) => setEditingItem(prev => ({
                                            ...prev,
                                            config: { ...prev.config, randomize: e.target.checked }
                                        }))}
                                    />
                                    <span className="text-sm">Randomize order</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Display Type</label>
                                <div className="flex gap-2">
                                    {['gallery', 'carousel'].map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setEditingItem(prev => ({
                                                ...prev,
                                                config: { ...prev.config, displayType: type }
                                            }))}
                                            className={`flex-1 px-4 py-2 border rounded-md transition-colors ${editingItem.config.displayType === type
                                                ? 'bg-blue-50 border-blue-300 text-blue-700'
                                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingItem(null)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        const updatedConfig = {
                                            ...currentConfig,
                                            collectionConfig: editingItem.config
                                        }
                                        setEditingItem(null)
                                        onConfigChange(updatedConfig)
                                    }}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Save Settings
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

MediaSpecialEditor.displayName = 'MediaSpecialEditor';

export default MediaSpecialEditor;