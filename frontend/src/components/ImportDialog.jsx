/**
 * ImportDialog - Proxy-based import with iframe
 * 
 * Steps:
 * 1. Enter URL
 * 2. Display proxied page in iframe with click detection
 * 3. Preview selected content
 * 4. Choose import options
 * 5. Show progress and results
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, ArrowLeft, ArrowRight, Download, Loader } from 'lucide-react';
import ContentPreview from './import/ContentPreview';
import MetadataConfirmationStep from './import/MetadataConfirmationStep';
import HierarchySelector from './import/HierarchySelector';
import { proxyPage, extractMetadata, analyzeHierarchy, generateMediaMetadata, uploadMediaFile, processImport } from '../api/contentImport';
import { useNotificationContext } from './NotificationManager';

const STEPS = {
    URL_INPUT: 1,
    IFRAME_SELECT: 2,
    METADATA_CONFIRM: 3,
    MEDIA_UPLOAD: 4,
    CONTENT_PREVIEW: 5,
    IMPORT_OPTIONS: 6,
    PROCESSING: 7,
};

const ImportDialog = ({ isOpen, onClose, slotName, pageId, onImportComplete }) => {
    const [currentStep, setCurrentStep] = useState(STEPS.URL_INPUT);
    const [url, setUrl] = useState('');
    const [proxiedHtml, setProxiedHtml] = useState(null);
    const [selectedElement, setSelectedElement] = useState(null);
    const [selectedHierarchy, setSelectedHierarchy] = useState(null);
    const [selectedHierarchyIndex, setSelectedHierarchyIndex] = useState(null);
    const [hierarchyStats, setHierarchyStats] = useState([]);
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [pageMetadata, setPageMetadata] = useState(null);
    const [confirmedTitle, setConfirmedTitle] = useState('');
    const [confirmedTags, setConfirmedTags] = useState([]);
    const [saveToPage, setSaveToPage] = useState(false);
    const [importMode, setImportMode] = useState('append');
    const [stripDesign, setStripDesign] = useState(true);
    const [hierarchyPanelWidth, setHierarchyPanelWidth] = useState(320); // pixels
    const [isResizing, setIsResizing] = useState(false);
    const [dialogWidth, setDialogWidth] = useState(window.innerWidth * 0.85);
    const [dialogHeight, setDialogHeight] = useState(window.innerHeight * 0.90);
    const [isResizingDialog, setIsResizingDialog] = useState(false);
    const [resizeEdge, setResizeEdge] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [importResults, setImportResults] = useState(null);
    const [progress, setProgress] = useState({ step: '', percent: 0, current: 0, total: 0, item: '' });
    const [mediaUploadStatus, setMediaUploadStatus] = useState([]);
    const [mediaUploadComplete, setMediaUploadComplete] = useState(false);
    const [uploadedMediaMapping, setUploadedMediaMapping] = useState({});
    const [aiAvailable, setAiAvailable] = useState(true);

    const iframeRef = useRef(null);
    const resizeRef = useRef(null);
    const { showNotification } = useNotificationContext();

    // Listen for messages from iframe (content selection)
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data.type === 'CONTENT_SELECTED') {
                const { hierarchy, clickedIndex } = event.data.data;

                // Store hierarchy and set default selection
                setSelectedHierarchy(hierarchy);
                setSelectedHierarchyIndex(clickedIndex);

                // Set selected element from hierarchy
                if (hierarchy && hierarchy[clickedIndex]) {
                    setSelectedElement(hierarchy[clickedIndex]);
                }

                // Fetch detailed statistics for each hierarchy item
                fetchHierarchyStats(hierarchy);
                // Do NOT auto-advance - let user click Next button
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Auto-start media upload when entering that step
    useEffect(() => {
        if (currentStep === STEPS.MEDIA_UPLOAD && !mediaUploadComplete && mediaUploadStatus.length === 0) {
            handleMediaUpload();
        }
    }, [currentStep]);

    // Handle resize of hierarchy panel
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;

            // Calculate new width based on mouse position from right edge
            const dialogElement = resizeRef.current?.closest('.dialog-container');
            if (!dialogElement) return;

            const dialogRect = dialogElement.getBoundingClientRect();
            const newWidth = dialogRect.right - e.clientX;

            // Constrain width between 250px and 600px
            const constrainedWidth = Math.min(Math.max(newWidth, 250), 600);
            setHierarchyPanelWidth(constrainedWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing]);

    // Handle resize of dialog window
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizingDialog || !resizeEdge) return;

            const minWidth = 600;
            const minHeight = 400;
            const maxWidth = window.innerWidth * 0.95;
            const maxHeight = window.innerHeight * 0.95;

            let newWidth = dialogWidth;
            let newHeight = dialogHeight;

            // Calculate new dimensions based on which edge is being dragged
            if (resizeEdge.includes('e')) {
                newWidth = e.clientX - (window.innerWidth - dialogWidth) / 2;
            }
            if (resizeEdge.includes('w')) {
                const left = (window.innerWidth - dialogWidth) / 2;
                newWidth = dialogWidth + (left - e.clientX);
            }
            if (resizeEdge.includes('s')) {
                newHeight = e.clientY - (window.innerHeight - dialogHeight) / 2;
            }
            if (resizeEdge.includes('n')) {
                const top = (window.innerHeight - dialogHeight) / 2;
                newHeight = dialogHeight + (top - e.clientY);
            }

            // Apply constraints
            newWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
            newHeight = Math.min(Math.max(newHeight, minHeight), maxHeight);

            setDialogWidth(newWidth);
            setDialogHeight(newHeight);
        };

        const handleMouseUp = () => {
            setIsResizingDialog(false);
            setResizeEdge(null);
        };

        if (isResizingDialog) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
        };
    }, [isResizingDialog, resizeEdge, dialogWidth, dialogHeight]);


    const handleClose = () => {
        // Reset state
        setCurrentStep(STEPS.URL_INPUT);
        setUrl('');
        setProxiedHtml(null);
        setSelectedElement(null);
        setSelectedHierarchy(null);
        setSelectedHierarchyIndex(null);
        setHierarchyStats([]);
        setImportMode('append');
        setError(null);
        setImportResults(null);
        setProgress({ step: '', percent: 0 });
        onClose();
    };

    const fetchHierarchyStats = async (hierarchy) => {
        if (!hierarchy || hierarchy.length === 0) return;

        setIsLoadingStats(true);
        try {
            const elements = hierarchy.map(h => ({
                html: h.html,
                tag: h.tagName,
                classes: h.classes
            }));

            const response = await analyzeHierarchy({ elements });
            setHierarchyStats(response.results || []);
        } catch (err) {
            console.error('Failed to analyze hierarchy:', err);
            // Not critical - quick stats are available as fallback
        } finally {
            setIsLoadingStats(false);
        }
    };

    const handleHierarchyHover = (index) => {
        // Send message to iframe to highlight element
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'HIGHLIGHT_ELEMENT',
                index: index
            }, '*');
        }
    };

    const handleHierarchyClearHover = () => {
        // Send message to iframe to clear highlight
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'CLEAR_HIGHLIGHT'
            }, '*');
        }
    };

    const handleHierarchySelect = (index) => {
        setSelectedHierarchyIndex(index);
        if (selectedHierarchy && selectedHierarchy[index]) {
            setSelectedElement(selectedHierarchy[index]);

            // Send message to iframe to update selection
            if (iframeRef.current && iframeRef.current.contentWindow) {
                iframeRef.current.contentWindow.postMessage({
                    type: 'SELECT_ELEMENT',
                    index: index
                }, '*');
            }
        }
    };

    const handleNext = async () => {
        setError(null);

        if (currentStep === STEPS.URL_INPUT) {
            // Validate URL
            if (!url || !url.startsWith('http')) {
                setError('Please enter a valid URL starting with http:// or https://');
                return;
            }

            // Fetch proxied page with design stripping option
            setIsLoading(true);
            try {
                const data = await proxyPage(url, stripDesign);
                setProxiedHtml(data.html);
                setCurrentStep(STEPS.IFRAME_SELECT);
            } catch (err) {
                console.error('Proxy page error:', err);
                setError(err.response?.data?.error || err.message || 'Failed to load page');
            } finally {
                setIsLoading(false);
            }
        } else if (currentStep === STEPS.IFRAME_SELECT) {
            if (!selectedElement) {
                setError('Please click on the content you want to import');
                return;
            }
            // Extract metadata from selected content + page HEAD (optimized for tokens)
            setIsLoading(true);
            try {
                // Extract just the HEAD from the full page
                const parser = new DOMParser();
                const fullDoc = parser.parseFromString(proxiedHtml, 'text/html');
                const headElement = fullDoc.querySelector('head');
                const headHtml = headElement ? headElement.innerHTML : '';

                const metadata = await extractMetadata({
                    html: selectedElement.html,
                    headHtml: headHtml,
                    namespace: 'default'
                });

                setPageMetadata(metadata);
                setCurrentStep(STEPS.METADATA_CONFIRM);
            } catch (err) {
                console.error('Metadata extraction error:', err);
                console.error('Error details:', err.response?.data);
                // Critical error - STOP and show error (don't skip step)
                const errorMsg = err.response?.data?.error || err.message || 'AI metadata extraction failed. Please try again.';
                setError(errorMsg);
                showNotification('AI metadata extraction failed', 'error');
                // Stay on IFRAME_SELECT step - user can click Next to retry
            } finally {
                setIsLoading(false);
            }
        } else if (currentStep === STEPS.METADATA_CONFIRM) {
            // User has confirmed metadata - proceed to media upload
            setCurrentStep(STEPS.MEDIA_UPLOAD);
        } else if (currentStep === STEPS.MEDIA_UPLOAD) {
            if (!mediaUploadComplete) {
                setError('Please wait for all media files to upload');
                return;
            }
            setCurrentStep(STEPS.CONTENT_PREVIEW);
        } else if (currentStep === STEPS.CONTENT_PREVIEW) {
            setCurrentStep(STEPS.IMPORT_OPTIONS);
        } else if (currentStep === STEPS.IMPORT_OPTIONS) {
            // Start import process
            await handleImport();
        }
    };

    const handleBack = () => {
        setError(null);
        if (currentStep === STEPS.IFRAME_SELECT) {
            setCurrentStep(STEPS.URL_INPUT);
            setProxiedHtml(null);
        } else if (currentStep === STEPS.METADATA_CONFIRM) {
            setCurrentStep(STEPS.IFRAME_SELECT);
            setPageMetadata(null);
        } else if (currentStep === STEPS.MEDIA_UPLOAD) {
            setCurrentStep(STEPS.METADATA_CONFIRM);
            setMediaUploadStatus([]);
            setMediaUploadComplete(false);
        } else if (currentStep === STEPS.CONTENT_PREVIEW) {
            setCurrentStep(STEPS.MEDIA_UPLOAD);
        } else if (currentStep === STEPS.IMPORT_OPTIONS) {
            setCurrentStep(STEPS.CONTENT_PREVIEW);
        }
    };


    // Helper to extract filename and path from URL
    const extractFilenameAndPath = (url) => {
        try {
            // Decode URL if it's a proxy URL
            let actualUrl = url;
            if (url.includes('proxy-asset/?url=')) {
                const urlParam = new URL(url).searchParams.get('url');
                if (urlParam) {
                    actualUrl = decodeURIComponent(urlParam);
                }
            }

            // Parse the URL
            const urlObj = new URL(actualUrl);
            const pathname = urlObj.pathname;

            // Extract filename and path
            const parts = pathname.split('/');
            const filename = parts[parts.length - 1] || 'unknown';
            const filepath = parts.slice(0, -1).join('/') || '/';

            return { filename, filepath };
        } catch (e) {
            console.warn('Failed to parse URL:', url, e);
            return { filename: 'unknown', filepath: '/' };
        }
    };

    // Helper to create WYSIWYG media-insert HTML
    const createMediaInsertHtml = (mediaUrl, alt, layout, mediaId) => {
        // Map layout config to WYSIWYG settings (same as backend)
        const alignment = layout?.alignment || 'center';
        const size = layout?.size || 'medium';
        const caption = layout?.caption || '';

        // Map alignment
        const alignMap = {
            'left': 'left',
            'center': 'center',
            'right': 'right',
            'full-width': 'center',
        };
        const align = alignMap[alignment] || 'center';

        // Map size to width
        const widthMap = {
            'small': 'small',
            'medium': 'medium',
            'large': 'large',
            'original': 'full',
        };
        const width = widthMap[size] || 'medium';

        // Build WYSIWYG-compatible media insert HTML
        const captionHtml = caption ? `<div class="media-caption">${caption}</div>` : '';
        const mediaIdAttr = mediaId ? `data-media-id="${mediaId}"` : '';

        return `<div 
    class="media-insert media-width-${width} media-align-${align}" 
    data-media-insert="true"
    data-media-type="image"
    ${mediaIdAttr}
    data-width="${width}"
    data-align="${align}"
    contenteditable="false"
    draggable="true"
><img src="${mediaUrl || ''}" alt="${alt}" />${captionHtml}</div>`;
    };

    const handleMediaUpload = async () => {
        // Analyze selected HTML to find images and files
        const parser = new DOMParser();
        const doc = parser.parseFromString(selectedElement.html, 'text/html');

        // Find all images
        const images = Array.from(doc.querySelectorAll('img')).map((img, idx) => {
            const { filename, filepath } = extractFilenameAndPath(img.src);
            return {
                id: img.src || `image-${idx}`,
                filename: filename,  // Actual filename from URL
                filepath: filepath,  // Directory path
                displayName: img.alt || filename || `Image ${idx + 1}`,  // For UI display
                type: 'image',
                status: 'pending',
                currentStep: 'Waiting...',
                src: img.src,
                alt: img.alt || '',
            };
        });

        // Find all file links
        const fileExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip'];
        const files = Array.from(doc.querySelectorAll('a[href]'))
            .filter(link => {
                const href = link.href.toLowerCase();
                return fileExtensions.some(ext => href.endsWith(ext));
            })
            .map((link, idx) => ({
                id: link.href || `file-${idx}`,
                filename: link.textContent.trim() || `File ${idx + 1}`,
                type: 'file',
                status: 'pending',
                currentStep: 'Waiting...',
                url: link.href,
            }));

        // Set initial media status - show list first
        const allMedia = [...images, ...files];
        setMediaUploadStatus(allMedia);

        if (allMedia.length === 0) {
            // No media to upload, skip to preview
            setMediaUploadComplete(true);
            setCurrentStep(STEPS.CONTENT_PREVIEW);
            return;
        }

        // Process each media file individually with detailed steps
        const urlMapping = {};

        for (let i = 0; i < allMedia.length; i++) {
            const item = allMedia[i];

            try {
                // Step 1/4: Generate tags and title with AI
                setMediaUploadStatus(prev => prev.map(m =>
                    m.id === item.id ? {
                        ...m,
                        status: 'processing',
                        currentStep: '1/4: Generating tags and title (AI)...'
                    } : m
                ));

                const metadata = await generateMediaMetadata({
                    type: item.type,
                    url: item.src || item.url,
                    filename: item.filename,  // Actual filename from URL
                    filepath: item.filepath,  // Directory path
                    alt: item.alt || '',
                    text: item.displayName,  // Display text (may be poor quality)
                    context: '',
                });

                // Validate metadata was generated
                if (!metadata || !metadata.title) {
                    throw new Error('Failed to generate metadata - title is required');
                }

                // Track AI availability - only mark as unavailable if backend explicitly says so
                // Don't set to true here to avoid overriding a previous false detection
                if (metadata.ai_generated === false) {
                    setAiAvailable(false);
                } else if (metadata.ai_generated === true && i === 0) {
                    // First successful AI generation confirms it's working
                    setAiAvailable(true);
                }

                // Update with generated metadata
                setMediaUploadStatus(prev => prev.map(m =>
                    m.id === item.id ? {
                        ...m,
                        currentStep: `2/4: Uploading "${metadata.title}"...`,
                        title: metadata.title,
                        tags: metadata.tags || [],
                        description: metadata.description || '',
                    } : m
                ));

                // Step 2/4: Upload file to media manager
                const uploadResult = await uploadMediaFile({
                    type: item.type,
                    url: item.src || item.url,
                    namespace: 'default',
                    metadata: metadata,
                });

                // Step 3/4: Approve pending upload
                setMediaUploadStatus(prev => prev.map(m =>
                    m.id === item.id ? {
                        ...m,
                        currentStep: '3/4: Approving upload with metadata...',
                    } : m
                ));

                // Approval happens automatically in upload endpoint
                await new Promise(resolve => setTimeout(resolve, 300)); // Brief pause for visibility

                // Step 4/4: Complete
                setMediaUploadStatus(prev => prev.map(m =>
                    m.id === item.id ? {
                        ...m,
                        status: uploadResult.was_reused ? 'reused' : 'success',
                        currentStep: uploadResult.was_reused ? '✓ Reused existing file' : '✓ Upload complete',
                        title: uploadResult.title,
                        tags: uploadResult.tags || [],
                        description: uploadResult.description || '',
                        mediaId: uploadResult.id,
                    } : m
                ));

                // Store URL mapping with WYSIWYG HTML structure
                // Map original URL directly to WYSIWYG HTML (no placeholders needed)
                const wysiwygHtml = createMediaInsertHtml(
                    uploadResult.url || uploadResult.file_url || '',  // Media manager URL with fallback
                    item.alt || '',
                    metadata.layout || {},  // Layout config from AI
                    uploadResult.id  // Media file ID
                );

                // Use original src as key for direct regex replacement on backend
                urlMapping[item.src || item.url] = wysiwygHtml;

            } catch (err) {
                console.error(`Failed to upload ${item.type}:`, err);
                setMediaUploadStatus(prev => prev.map(m =>
                    m.id === item.id ? {
                        ...m,
                        status: 'error',
                        currentStep: '✗ Upload failed',
                        error: err.response?.data?.error || err.message || 'Upload failed'
                    } : m
                ));
            }
        }

        // Send mapping directly: original URL → WYSIWYG HTML
        // Backend will use regex to replace img tags with original src
        setUploadedMediaMapping(urlMapping);
        setMediaUploadComplete(true);
    };

    const handleImport = async () => {
        setCurrentStep(STEPS.PROCESSING);
        setIsLoading(true);
        setProgress({ step: 'Creating widgets...', percent: 50, current: 0, total: 0, item: '' });

        try {
            // Process import with pre-uploaded media URLs and page metadata
            const results = await processImport({
                html: selectedElement.html,
                slotName: slotName,
                pageId: pageId,
                mode: importMode,
                namespace: 'default',
                sourceUrl: url,
                uploadedMediaUrls: uploadedMediaMapping,  // Pass pre-uploaded media URLs
                pageMetadata: {
                    title: confirmedTitle,
                    tags: confirmedTags,
                    saveToPage: saveToPage,  // Only save to page if checkbox is checked
                },  // Pass confirmed page title and tags
            });

            setProgress({ step: 'Complete!', percent: 100, current: 0, total: 0, item: '' });

            // Notify parent component
            if (onImportComplete && results.widgets) {
                onImportComplete(results.widgets, {
                    pageWasUpdated: results.pageWasUpdated || false,
                    savedTitle: confirmedTitle,
                    savedTags: confirmedTags,
                });
            }

            showNotification(
                `Successfully imported ${results.widgets?.length || 0} widgets with ${mediaUploadStatus.length} media files`,
                'success'
            );

            // Auto-close after success
            setTimeout(handleClose, 1500);

        } catch (err) {
            console.error('Final import error:', err);
            setError(err.response?.data?.error || err.message || 'Import failed');
            setProgress({ step: 'Failed', percent: 0, current: 0, total: 0, item: '' });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div
                className="dialog-container bg-white rounded-lg shadow-xl overflow-hidden flex flex-col relative"
                style={{
                    width: `${dialogWidth}px`,
                    height: `${dialogHeight}px`,
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Import Content from Web
                    </h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="text-sm font-medium text-gray-700">
                        Step {currentStep}/7: {
                            currentStep === STEPS.URL_INPUT ? 'Enter URL' :
                                currentStep === STEPS.IFRAME_SELECT ? 'Select Content (Live Preview)' :
                                    currentStep === STEPS.METADATA_CONFIRM ? 'Confirm Page Metadata' :
                                        currentStep === STEPS.MEDIA_UPLOAD ? 'Upload Media Files' :
                                            currentStep === STEPS.CONTENT_PREVIEW ? 'Preview Content' :
                                                currentStep === STEPS.IMPORT_OPTIONS ? 'Import Options' :
                                                    'Importing...'
                        }
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Step 1: URL Input */}
                    {currentStep === STEPS.URL_INPUT && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Enter the URL of the page you want to import from:
                            </label>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com/article"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                onKeyPress={(e) => e.key === 'Enter' && handleNext()}
                            />
                            <p className="mt-2 text-sm text-gray-500">
                                The page will be displayed live so you can click on the content you want.
                            </p>
                        </div>
                    )}

                    {/* Step 2: Iframe Content Selection */}
                    {currentStep === STEPS.IFRAME_SELECT && proxiedHtml && (
                        <div className="flex gap-0 h-full" style={{ height: '600px' }}>
                            {/* Left side: Iframe */}
                            <div className="flex-1 flex flex-col min-w-0">
                                <div className="flex items-center justify-between mb-3 px-4">
                                    <p className="text-sm text-gray-700">
                                        Click on the content block you want to import.
                                    </p>

                                    <label className="flex items-center text-sm text-gray-600">
                                        <input
                                            type="checkbox"
                                            checked={stripDesign}
                                            onChange={async (e) => {
                                                const newValue = e.target.checked;
                                                setStripDesign(newValue);
                                                // Reload page with new design setting
                                                setIsLoading(true);
                                                try {
                                                    const data = await proxyPage(url, newValue);
                                                    setProxiedHtml(data.html);
                                                } catch (err) {
                                                    console.error('Failed to reload with design change:', err);
                                                } finally {
                                                    setIsLoading(false);
                                                }
                                            }}
                                            className="mr-2"
                                        />
                                        Strip original design
                                    </label>
                                </div>
                                <div className="border border-gray-300 rounded-lg overflow-auto flex-1 bg-gray-100">
                                    <iframe
                                        ref={iframeRef}
                                        srcDoc={proxiedHtml}
                                        className="w-full h-full bg-white"
                                        sandbox="allow-scripts"
                                        title="Content preview"
                                    />
                                </div>
                            </div>

                            {/* Resize handle */}
                            <div
                                ref={resizeRef}
                                onMouseDown={() => setIsResizing(true)}
                                className="w-1 bg-gray-300 hover:bg-blue-500 cursor-ew-resize transition-colors flex-shrink-0"
                                style={{ cursor: 'ew-resize' }}
                            />

                            {/* Right side: Hierarchy Selector (resizable) */}
                            <div
                                className="flex-shrink-0 bg-gray-50 border-l border-gray-200 overflow-hidden"
                                style={{ width: `${hierarchyPanelWidth}px` }}
                            >
                                <HierarchySelector
                                    hierarchy={selectedHierarchy}
                                    selectedIndex={selectedHierarchyIndex}
                                    onSelect={handleHierarchySelect}
                                    onHover={handleHierarchyHover}
                                    onClearHover={handleHierarchyClearHover}
                                    stats={hierarchyStats}
                                    isLoadingStats={isLoadingStats}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Metadata Confirmation */}
                    {currentStep === STEPS.METADATA_CONFIRM && pageMetadata && (
                        <MetadataConfirmationStep
                            metadata={pageMetadata}
                            onTitleChange={setConfirmedTitle}
                            onTagsChange={setConfirmedTags}
                            onSaveToPageChange={setSaveToPage}
                        />
                    )}

                    {/* Step 4: Media Upload */}
                    {currentStep === STEPS.MEDIA_UPLOAD && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                Uploading Media Files
                            </h3>

                            {!aiAvailable && mediaUploadStatus.length > 0 && (
                                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                                    ⚠️ AI metadata generation is not available. Files will be uploaded with basic titles only.
                                    <div className="text-xs mt-1">Configure OPENAI_API_KEY in backend to enable AI-powered metadata.</div>
                                </div>
                            )}

                            {mediaUploadStatus.length === 0 ? (
                                <div className="text-center py-8">
                                    <Loader className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
                                    <p className="text-gray-600">Analyzing content and preparing uploads...</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {mediaUploadStatus.map((item, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-3">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm text-gray-900">
                                                        {item.type === 'image' ? '🖼️' : '📎'} {item.title || item.filename}
                                                    </div>
                                                    {item.currentStep && (
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {item.currentStep}
                                                        </div>
                                                    )}
                                                    {item.tags && item.tags.length > 0 && (
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            {item.tags.map((tag, tidx) => (
                                                                <span key={tidx} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    {item.status === 'pending' && (
                                                        <span className="text-gray-400" title="Waiting">⏱</span>
                                                    )}
                                                    {item.status === 'uploading' && (
                                                        <Loader className="h-4 w-4 text-blue-500 animate-spin" />
                                                    )}
                                                    {item.status === 'success' && (
                                                        <span className="text-green-600 text-lg">✓</span>
                                                    )}
                                                    {item.status === 'error' && (
                                                        <span className="text-red-600 text-lg">✗</span>
                                                    )}
                                                    {item.status === 'reused' && (
                                                        <span className="text-blue-600 text-lg" title="File already exists - reused">↻</span>
                                                    )}
                                                </div>
                                            </div>
                                            {item.error && (
                                                <div className="text-xs text-red-600 mt-1">
                                                    Error: {item.error}
                                                </div>
                                            )}
                                            {item.description && (
                                                <div className="text-xs text-gray-600 mt-1">
                                                    {item.description}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {mediaUploadComplete && (
                                <div className="mt-4">
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 mb-3">
                                        ✓ All media files uploaded successfully!
                                    </div>
                                    <button
                                        onClick={() => setCurrentStep(STEPS.CONTENT_PREVIEW)}
                                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                                    >
                                        Continue to Preview
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 4: Content Preview */}
                    {currentStep === STEPS.CONTENT_PREVIEW && selectedElement && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                Preview Content
                            </h3>
                            <ContentPreview
                                html={selectedElement.html}
                                mediaItems={mediaUploadStatus}
                                currentTheme={null}
                            />
                        </div>
                    )}

                    {/* Step 4: Import Options */}
                    {currentStep === STEPS.IMPORT_OPTIONS && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Import Options
                            </h3>

                            <div className="space-y-3 mb-6">
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        name="import-mode"
                                        value="append"
                                        checked={importMode === 'append'}
                                        onChange={(e) => setImportMode(e.target.value)}
                                        className="mr-3"
                                    />
                                    <div>
                                        <div className="font-medium text-gray-900">Append to existing widgets</div>
                                        <div className="text-sm text-gray-600">Add imported content after current widgets in the slot</div>
                                    </div>
                                </label>

                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        name="import-mode"
                                        value="replace"
                                        checked={importMode === 'replace'}
                                        onChange={(e) => setImportMode(e.target.value)}
                                        className="mr-3"
                                    />
                                    <div>
                                        <div className="font-medium text-gray-900">Replace existing widgets</div>
                                        <div className="text-sm text-gray-600">Remove current widgets and add only imported content</div>
                                    </div>
                                </label>
                            </div>

                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <h4 className="font-medium text-blue-900 mb-2">Media files will be:</h4>
                                <ul className="text-sm text-blue-800 space-y-1">
                                    <li>• Downloaded automatically</li>
                                    <li>• Tagged with "imported"</li>
                                    <li>• AI-generated metadata added (if configured)</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Step 6: Final Processing */}
                    {currentStep === STEPS.PROCESSING && (
                        <div className="text-center py-8">
                            <Loader className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-900 mb-2">
                                {progress.step}
                            </p>

                            {/* Progress bar */}
                            <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2 mb-3">
                                <div
                                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progress.percent}%` }}
                                />
                            </div>

                            <p className="text-sm text-gray-600">
                                Creating {mediaUploadStatus.filter(m => m.status === 'success' || m.status === 'reused').length} widgets from uploaded media...
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <div>
                        {currentStep > STEPS.URL_INPUT && currentStep < STEPS.PROCESSING && (
                            <button
                                onClick={handleBack}
                                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </button>
                        )}
                    </div>

                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                        >
                            Cancel
                        </button>

                        {currentStep < STEPS.PROCESSING && currentStep !== STEPS.MEDIA_UPLOAD && (
                            <button
                                onClick={handleNext}
                                disabled={isLoading || (currentStep === STEPS.IFRAME_SELECT && !selectedElement)}
                                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                                        Loading...
                                    </>
                                ) : currentStep === STEPS.IMPORT_OPTIONS ? (
                                    <>
                                        <Download className="h-4 w-4 mr-2" />
                                        Import
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Resize handles for dialog */}
                {/* Corners */}
                <div
                    onMouseDown={() => { setIsResizingDialog(true); setResizeEdge('nw'); }}
                    className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize hover:bg-blue-500 opacity-0 hover:opacity-50 transition-opacity"
                    style={{ cursor: 'nwse-resize' }}
                />
                <div
                    onMouseDown={() => { setIsResizingDialog(true); setResizeEdge('ne'); }}
                    className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize hover:bg-blue-500 opacity-0 hover:opacity-50 transition-opacity"
                    style={{ cursor: 'nesw-resize' }}
                />
                <div
                    onMouseDown={() => { setIsResizingDialog(true); setResizeEdge('sw'); }}
                    className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize hover:bg-blue-500 opacity-0 hover:opacity-50 transition-opacity"
                    style={{ cursor: 'nesw-resize' }}
                />
                <div
                    onMouseDown={() => { setIsResizingDialog(true); setResizeEdge('se'); }}
                    className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize hover:bg-blue-500 opacity-0 hover:opacity-50 transition-opacity"
                    style={{ cursor: 'nwse-resize' }}
                />

                {/* Edges */}
                <div
                    onMouseDown={() => { setIsResizingDialog(true); setResizeEdge('n'); }}
                    className="absolute top-0 left-3 right-3 h-1 cursor-ns-resize hover:bg-blue-500 opacity-0 hover:opacity-50 transition-opacity"
                    style={{ cursor: 'ns-resize' }}
                />
                <div
                    onMouseDown={() => { setIsResizingDialog(true); setResizeEdge('s'); }}
                    className="absolute bottom-0 left-3 right-3 h-1 cursor-ns-resize hover:bg-blue-500 opacity-0 hover:opacity-50 transition-opacity"
                    style={{ cursor: 'ns-resize' }}
                />
                <div
                    onMouseDown={() => { setIsResizingDialog(true); setResizeEdge('w'); }}
                    className="absolute left-0 top-3 bottom-3 w-1 cursor-ew-resize hover:bg-blue-500 opacity-0 hover:opacity-50 transition-opacity"
                    style={{ cursor: 'ew-resize' }}
                />
                <div
                    onMouseDown={() => { setIsResizingDialog(true); setResizeEdge('e'); }}
                    className="absolute right-0 top-3 bottom-3 w-1 cursor-ew-resize hover:bg-blue-500 opacity-0 hover:opacity-50 transition-opacity"
                    style={{ cursor: 'ew-resize' }}
                />
            </div>
        </div>
    );
};

export default ImportDialog;
