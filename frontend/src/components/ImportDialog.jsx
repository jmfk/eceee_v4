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
import MediaTagReviewStep from './import/MediaTagReviewStep';
import HierarchySelector from './import/HierarchySelector';
import AnalysisProgressDialog from './import/AnalysisProgressDialog';
import { proxyPage, extractMetadata, analyzeHierarchy, generateMediaMetadata, uploadMediaFile, processImport } from '../api/contentImport';
import { useNotificationContext } from './NotificationManager';

const STEPS = {
    URL_INPUT: 1,
    IFRAME_SELECT: 2,
    METADATA_CONFIRM: 3,
    MEDIA_TAG_REVIEW: 4,
    MEDIA_UPLOAD: 5,
    CONTENT_PREVIEW: 6,
    IMPORT_OPTIONS: 7,
    PROCESSING: 8,
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
    const [uploadedMediaMapping, setUploadedMediaMapping] = useState([]);
    const [aiAvailable, setAiAvailable] = useState(true);
    const [mediaMetadataList, setMediaMetadataList] = useState([]); // AI-generated metadata for images and files
    const [mediaTagReviews, setMediaTagReviews] = useState({}); // Per-media tag approval state
    const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, type: '', itemName: '', resolution: '' });
    const [skipAnalysis, setSkipAnalysis] = useState(false);

    const iframeRef = useRef(null);
    const resizeRef = useRef(null);
    const { showNotification } = useNotificationContext();

    // Reset all state when dialog opens (isOpen changes from false to true)
    useEffect(() => {
        if (isOpen) {
            // Force reset ALL state to ensure no stale data from previous sessions
            setCurrentStep(STEPS.URL_INPUT);
            setUrl('');
            setProxiedHtml(null);
            setSelectedElement(null);
            setSelectedHierarchy(null);
            setSelectedHierarchyIndex(null);
            setHierarchyStats([]);
            setPageMetadata(null);
            setConfirmedTitle('');
            setConfirmedTags([]);
            setSaveToPage(false);
            setImportMode('append');
            setStripDesign(true);
            setError(null);
            setImportResults(null);
            setProgress({ step: '', percent: 0, current: 0, total: 0, item: '' });
            setMediaUploadStatus([]);
            setMediaUploadComplete(false);
            setUploadedMediaMapping([]);
            setMediaMetadataList([]);
            setMediaTagReviews({});
            setAiAvailable(true);
            setShowAnalysisDialog(false);
            setAnalysisProgress({ current: 0, total: 0, type: '', itemName: '', resolution: '' });
            setSkipAnalysis(false);
        }
    }, [isOpen]); // Only run when isOpen changes

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

    // Clear media metadata when selectedElement changes (new selection)
    useEffect(() => {
        if (selectedElement && currentStep >= STEPS.METADATA_CONFIRM && currentStep < STEPS.MEDIA_TAG_REVIEW) {
            // If we have a new selectedElement but we're before the MEDIA_TAG_REVIEW step,
            // clear any stale media metadata
            if (mediaMetadataList.length > 0) {
                setMediaMetadataList([]);
                setMediaTagReviews({});
                setMediaUploadStatus([]);
                setMediaUploadComplete(false);
            }
        }
    }, [selectedElement?.html]); // Track by HTML content to detect actual changes

    // Auto-start media upload when entering that step
    useEffect(() => {
        if (currentStep === STEPS.MEDIA_UPLOAD && !mediaUploadComplete && mediaUploadStatus.length === 0) {
            // Defensive check: only run if we have valid media metadata
            handleMediaUpload();
        }
    }, [currentStep, mediaMetadataList, selectedElement, mediaUploadComplete, mediaUploadStatus.length]);

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
        setUploadedMediaMapping([]); // Clear media mapping
        setMediaUploadComplete(false); // Reset upload status
        setMediaMetadataList([]); // Clear media metadata
        setMediaTagReviews({}); // Clear tag reviews
        setPageMetadata(null);
        setConfirmedTitle('');
        setConfirmedTags([]);
        setSaveToPage(false);
        setMediaUploadStatus([]);

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
                // Critical error - STOP and show error (don't skip step)
                const errorMsg = err.response?.data?.error || err.message || 'AI metadata extraction failed. Please try again.';
                setError(errorMsg);
                showNotification('AI metadata extraction failed', 'error');
                // Stay on IFRAME_SELECT step - user can click Next to retry
            } finally {
                setIsLoading(false);
            }
        } else if (currentStep === STEPS.METADATA_CONFIRM) {
            // User has confirmed metadata - proceed to media tag review
            await handleGenerateMediaTags();
        } else if (currentStep === STEPS.MEDIA_TAG_REVIEW) {
            // User has reviewed tags - proceed to media upload
            // Defensive check: verify mediaMetadataList is valid before proceeding
            if (mediaMetadataList.length === 0 && selectedElement) {
                // Re-parse to verify if there should be media
                const parser = new DOMParser();
                const doc = parser.parseFromString(selectedElement.html, 'text/html');
                const imgElements = Array.from(doc.querySelectorAll('img'));
                const fileExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip'];
                const fileLinks = Array.from(doc.querySelectorAll('a[href]'))
                    .filter(link => {
                        const href = link.href.toLowerCase();
                        return fileExtensions.some(ext => href.endsWith(ext));
                    });

                if (imgElements.length > 0 || fileLinks.length > 0) {
                    setError('Media data was lost. Please go back and try again.');
                    return;
                }
            }

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
            // Clear all downstream state when going back to URL input
            setSelectedElement(null);
            setMediaMetadataList([]);
            setMediaTagReviews({});
            setMediaUploadStatus([]);
            setMediaUploadComplete(false);
        } else if (currentStep === STEPS.METADATA_CONFIRM) {
            setCurrentStep(STEPS.IFRAME_SELECT);
            setPageMetadata(null);
            // Clear downstream state
            setMediaMetadataList([]);
            setMediaTagReviews({});
            setMediaUploadStatus([]);
            setMediaUploadComplete(false);
        } else if (currentStep === STEPS.MEDIA_TAG_REVIEW) {
            setCurrentStep(STEPS.METADATA_CONFIRM);
            setMediaMetadataList([]);
            setMediaTagReviews({});
            // Also clear media upload state
            setMediaUploadStatus([]);
            setMediaUploadComplete(false);
        } else if (currentStep === STEPS.MEDIA_UPLOAD) {
            setCurrentStep(STEPS.MEDIA_TAG_REVIEW);
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
            return { filename: 'unknown', filepath: '/' };
        }
    };

    const handleSkipAnalysis = () => {
        setSkipAnalysis(true);
    };

    const handleGenerateMediaTags = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Parse selected HTML to find all images and files
            const parser = new DOMParser();
            const doc = parser.parseFromString(selectedElement.html, 'text/html');
            const imgElements = Array.from(doc.querySelectorAll('img'));

            // Find file links
            const fileExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip'];
            const fileLinks = Array.from(doc.querySelectorAll('a'))
                .filter(link => {
                    // Check data-original-href first (set by proxy), then href
                    const href = (link.getAttribute('data-original-href') || link.href || '').toLowerCase();
                    return fileExtensions.some(ext => href.endsWith(ext));
                });

            if (imgElements.length === 0 && fileLinks.length === 0) {
                // No media, skip to media upload
                setMediaMetadataList([]);
                setMediaTagReviews({});
                setCurrentStep(STEPS.MEDIA_UPLOAD);
                return;
            }

            // Show analysis dialog and process items sequentially with progress
            const totalItems = imgElements.length + fileLinks.length;
            setShowAnalysisDialog(true);
            setSkipAnalysis(false);
            setAnalysisProgress({ current: 0, total: totalItems, type: '', itemName: '', resolution: '' });

            // Generate metadata for each image (sequentially to show progress)
            const imageMetadata = [];
            for (let idx = 0; idx < imgElements.length; idx++) {
                // Check if user clicked skip
                if (skipAnalysis) {
                    showNotification('Analysis skipped - using basic metadata', 'info');
                    break;
                }

                const img = imgElements[idx];
                const srcAttr = img.getAttribute('src') || img.src;
                const normalizedSrc = img.src;
                const { filename, filepath } = extractFilenameAndPath(normalizedSrc);

                // Update progress (initially without resolution)
                setAnalysisProgress({
                    current: idx + 1,
                    total: totalItems,
                    type: 'image',
                    itemName: filename,
                    resolution: ''
                });

                try {
                    const metadata = await generateMediaMetadata({
                        type: 'image',
                        url: normalizedSrc,
                        filename: filename,
                        filepath: filepath,
                        alt: img.alt || '',
                        text: img.alt || filename || `Image ${idx + 1}`,
                        context: '',
                    });

                    // Update progress with detected resolution
                    if (metadata.resolution) {
                        setAnalysisProgress(prev => ({
                            ...prev,
                            resolution: metadata.resolution.multiplier || '1x'
                        }));
                    }

                    imageMetadata.push({
                        index: idx,
                        type: 'image',
                        src: srcAttr,
                        normalizedSrc: normalizedSrc,
                        alt: img.alt || '',
                        filename: filename,
                        title: metadata.title || filename,
                        description: metadata.description || '',
                        aiTags: metadata.tags || [],
                        aiGenerated: metadata.ai_generated !== false,
                        resolution: metadata.resolution || { multiplier: '1x', source: 'original', dimensions: null },
                    });
                } catch (err) {
                    // Fallback to 1x resolution on error
                    imageMetadata.push({
                        index: idx,
                        type: 'image',
                        src: srcAttr,
                        normalizedSrc: normalizedSrc,
                        alt: img.alt || '',
                        filename: filename,
                        title: filename,
                        description: '',
                        aiTags: [],
                        aiGenerated: false,
                        resolution: { multiplier: '1x', source: 'original', dimensions: null },
                    });
                }
            }

            // Generate metadata for each file (sequentially to show progress)
            const fileMetadata = [];
            for (let idx = 0; idx < fileLinks.length; idx++) {
                // Check if user clicked skip
                if (skipAnalysis) {
                    break;
                }

                const link = fileLinks[idx];
                // Check data-original-href first (set by proxy), then href
                const url = link.getAttribute('data-original-href') || link.href;
                const linkText = link.textContent.trim();
                const { filename, filepath } = extractFilenameAndPath(url);

                // Update progress
                setAnalysisProgress({
                    current: imgElements.length + idx + 1,
                    total: totalItems,
                    type: 'file',
                    itemName: filename,
                    resolution: ''
                });

                try {
                    const metadata = await generateMediaMetadata({
                        type: 'file',
                        url: url,
                        filename: filename,
                        filepath: filepath,
                        text: linkText || filename,
                        context: '',
                    });

                    fileMetadata.push({
                        index: imgElements.length + idx,
                        type: 'file',
                        url: url,
                        filename: filename,
                        linkText: linkText,
                        title: metadata.title || linkText || filename,
                        description: metadata.description || '',
                        aiTags: metadata.tags || [],
                        aiGenerated: metadata.ai_generated !== false,
                    });
                } catch (err) {
                    fileMetadata.push({
                        index: imgElements.length + idx,
                        type: 'file',
                        url: url,
                        filename: filename,
                        linkText: linkText,
                        title: linkText || filename,
                        description: '',
                        aiTags: [],
                        aiGenerated: false,
                    });
                }
            }

            // Combine images and files into one list
            const allMediaMetadata = [...imageMetadata, ...fileMetadata];

            setMediaMetadataList(allMediaMetadata);

            // Initialize tag reviews (all AI tags approved by default)
            const initialReviews = {};
            allMediaMetadata.forEach((item, idx) => {
                initialReviews[idx] = {
                    approvedTags: new Set(item.aiTags || []),
                    customTags: [],
                };
            });
            setMediaTagReviews(initialReviews);

            // Hide analysis dialog
            setShowAnalysisDialog(false);

            // Move to media tag review step
            setCurrentStep(STEPS.MEDIA_TAG_REVIEW);
        } catch (err) {
            setError('Failed to generate media tags. You can proceed without tag review.');
            showNotification('Failed to generate media tags', 'error');
        } finally {
            setIsLoading(false);
            setShowAnalysisDialog(false);
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
        // Use pre-generated metadata from media tag review
        // Map mediaMetadataList to the format expected by upload UI
        const allMedia = mediaMetadataList.map((mediaMeta) => {
            if (mediaMeta.type === 'image') {
                return {
                    id: `img_${mediaMeta.index}`,
                    index: mediaMeta.index,
                    filename: mediaMeta.filename,
                    filepath: mediaMeta.filepath || '/',
                    displayName: mediaMeta.title || mediaMeta.alt || mediaMeta.filename || `Image ${mediaMeta.index + 1}`,
                    type: 'image',
                    status: 'pending',
                    currentStep: 'Waiting...',
                    src: mediaMeta.src,
                    alt: mediaMeta.alt || '',
                    title: mediaMeta.title,
                    description: mediaMeta.description,
                };
            } else {
                // file
                return {
                    id: `file_${mediaMeta.index}`,
                    index: mediaMeta.index,
                    filename: mediaMeta.filename,
                    displayName: mediaMeta.title || mediaMeta.linkText || mediaMeta.filename || `File ${mediaMeta.index + 1}`,
                    type: 'file',
                    status: 'pending',
                    currentStep: 'Waiting...',
                    url: mediaMeta.url,
                    title: mediaMeta.title,
                    description: mediaMeta.description,
                };
            }
        });

        // Set initial media status - show list first
        setMediaUploadStatus(allMedia);

        if (allMedia.length === 0) {
            // No media to upload, skip to preview
            setMediaUploadComplete(true);
            setCurrentStep(STEPS.CONTENT_PREVIEW);
            return;
        }

        // Process each media file individually with detailed steps
        // Use array instead of URL-keyed object to avoid URL encoding/case issues
        const mediaReplacements = [];

        for (let i = 0; i < allMedia.length; i++) {
            const item = allMedia[i];

            try {
                // Step 1/3: Prepare approved tags
                setMediaUploadStatus(prev => prev.map(m =>
                    m.id === item.id ? {
                        ...m,
                        status: 'processing',
                        currentStep: '1/3: Preparing approved tags...'
                    } : m
                ));

                // Get approved tags from mediaTagReviews
                let approvedTags = [];
                let customTags = [];

                if (mediaTagReviews[item.index]) {
                    const review = mediaTagReviews[item.index];
                    approvedTags = Array.from(review.approvedTags || []);
                    customTags = review.customTags || [];
                }

                // Merge: page tags (always) + approved AI tags + custom tags
                const allTags = [
                    ...(confirmedTags || []),  // Page tags (mandatory)
                    ...approvedTags,            // Approved AI tags
                    ...customTags,              // Custom tags
                ];

                // Remove duplicates
                const uniqueTags = [...new Set(allTags)];

                // Build metadata object with pre-approved tags
                const metadata = {
                    title: item.title || item.displayName || item.filename,
                    description: item.description || '',
                    tags: uniqueTags,
                    ai_generated: false,  // Tags were already generated and approved
                };

                // Update with prepared metadata
                setMediaUploadStatus(prev => prev.map(m =>
                    m.id === item.id ? {
                        ...m,
                        currentStep: `2/3: Uploading "${metadata.title}"...`,
                        title: metadata.title,
                        tags: metadata.tags,
                        description: metadata.description,
                    } : m
                ));

                // Step 2/3: Upload file to media manager with pre-approved tags
                const uploadResult = await uploadMediaFile({
                    type: item.type,
                    url: item.src || item.url,
                    namespace: 'default',
                    metadata: metadata,
                });

                // Step 3/3: Approve pending upload
                setMediaUploadStatus(prev => prev.map(m =>
                    m.id === item.id ? {
                        ...m,
                        currentStep: '3/3: Finalizing upload...',
                    } : m
                ));

                // Approval happens automatically in upload endpoint
                await new Promise(resolve => setTimeout(resolve, 300)); // Brief pause for visibility

                // Complete
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

                // Store simple URL to mediaManagerId mapping for backend
                if (item.type === 'image') {
                    mediaReplacements.push({
                        url: item.src,  // Original image URL
                        media_manager_id: uploadResult.id,  // MediaFile ID
                        alt: item.alt || '',
                        layout: metadata.layout || {},  // Layout config from AI
                    });
                } else if (item.type === 'file') {
                    mediaReplacements.push({
                        url: item.url,  // Original file URL
                        media_manager_id: uploadResult.id,  // MediaFile ID
                        type: 'file',  // Mark as file type for backend
                    });
                }

            } catch (err) {
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

        // Send simple URL mapping to backend (no HTML modification needed)
        setUploadedMediaMapping(mediaReplacements);
        setMediaUploadComplete(true);
    };

    const handleResyncUploadStatus = () => {
        // Check if all media items are complete
        const allComplete = mediaUploadStatus.length > 0 &&
            mediaUploadStatus.every(item =>
                item.status === 'success' ||
                item.status === 'reused' ||
                item.status === 'error'
            );

        if (allComplete) {
            setMediaUploadComplete(true);
            showNotification('All media uploads verified as complete', 'success');
        } else {
            const pending = mediaUploadStatus.filter(item =>
                item.status === 'pending' || item.status === 'uploading' || item.status === 'processing'
            ).length;
            showNotification(`${pending} upload(s) still in progress`, 'info');
        }
    };

    const handleImport = async () => {
        setCurrentStep(STEPS.PROCESSING);
        setIsLoading(true);
        setProgress({ step: 'Creating widgets...', percent: 50, current: 0, total: 0, item: '' });

        try {
            // Send original HTML with img tags - backend will replace them
            const htmlToSend = selectedElement.html;

            // Process import with pre-uploaded media URLs and page metadata
            const results = await processImport({
                html: htmlToSend,
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
            setError(err.response?.data?.error || err.message || 'Import failed');
            setProgress({ step: 'Failed', percent: 0, current: 0, total: 0, item: '' });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Analysis Progress Dialog */}
            <AnalysisProgressDialog
                isOpen={showAnalysisDialog}
                progress={analysisProgress}
                onSkip={handleSkipAnalysis}
            />

            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                onClick={(e) => {
                    // Prevent closing on backdrop click - only Cancel/X button can close
                    // This prevents accidental data loss
                }}
            >
                <div
                    className="dialog-container bg-white rounded-lg shadow-xl overflow-hidden flex flex-col relative"
                    onClick={(e) => e.stopPropagation()}
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
                            Step {currentStep}/8: {
                                currentStep === STEPS.URL_INPUT ? 'Enter URL' :
                                    currentStep === STEPS.IFRAME_SELECT ? 'Select Content (Live Preview)' :
                                        currentStep === STEPS.METADATA_CONFIRM ? 'Confirm Page Metadata' :
                                            currentStep === STEPS.MEDIA_TAG_REVIEW ? 'Review Media Tags' :
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
                                                        // Silently fail - user can retry
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

                        {/* Step 4: Media Tag Review */}
                        {currentStep === STEPS.MEDIA_TAG_REVIEW && (
                            <MediaTagReviewStep
                                mediaItems={mediaMetadataList}
                                pageTags={confirmedTags}
                                onTagReviewsChange={setMediaTagReviews}
                            />
                        )}

                        {/* Step 5: Media Upload */}
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
                                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                                        ✓ All media files uploaded successfully!
                                    </div>
                                )}

                                {/* Refresh Status button hidden - uploads complete automatically */}
                                {/* {mediaUploadStatus.length > 0 && (
                                <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                    <div className="text-sm text-gray-600">
                                        {mediaUploadComplete ? (
                                            <span className="text-green-700 font-medium">✓ All uploads verified</span>
                                        ) : (
                                            <span>Check if uploads are complete</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleResyncUploadStatus}
                                        className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded hover:bg-blue-100 transition-colors"
                                    >
                                        🔄 Refresh Status
                                    </button>
                                </div>
                            )} */}
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

                            {currentStep < STEPS.PROCESSING && (
                                <button
                                    onClick={handleNext}
                                    disabled={isLoading || (currentStep === STEPS.IFRAME_SELECT && !selectedElement) || (currentStep === STEPS.MEDIA_UPLOAD && !mediaUploadComplete)}
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
        </>
    );
};

export default ImportDialog;
