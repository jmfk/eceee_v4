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
import { proxyPage, processImport } from '../api/contentImport';
import { useNotificationContext } from './NotificationManager';

const STEPS = {
    URL_INPUT: 1,
    IFRAME_SELECT: 2,
    CONTENT_PREVIEW: 3,
    IMPORT_OPTIONS: 4,
    PROCESSING: 5,
};

const ImportDialog = ({ isOpen, onClose, slotName, pageId, onImportComplete }) => {
    const [currentStep, setCurrentStep] = useState(STEPS.URL_INPUT);
    const [url, setUrl] = useState('');
    const [proxiedHtml, setProxiedHtml] = useState(null);
    const [selectedElement, setSelectedElement] = useState(null);
    const [importMode, setImportMode] = useState('append');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [importResults, setImportResults] = useState(null);
    const [progress, setProgress] = useState({ step: '', percent: 0 });
    
    const iframeRef = useRef(null);
    const { showNotification } = useNotificationContext();

    // Listen for messages from iframe (content selection)
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data.type === 'CONTENT_SELECTED') {
                setSelectedElement(event.data.data);
                // Auto-advance to preview step
                setCurrentStep(STEPS.CONTENT_PREVIEW);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleClose = () => {
        // Reset state
        setCurrentStep(STEPS.URL_INPUT);
        setUrl('');
        setProxiedHtml(null);
        setSelectedElement(null);
        setImportMode('append');
        setError(null);
        setImportResults(null);
        setProgress({ step: '', percent: 0 });
        onClose();
    };

    const handleNext = async () => {
        setError(null);

        if (currentStep === STEPS.URL_INPUT) {
            // Validate URL
            if (!url || !url.startsWith('http')) {
                setError('Please enter a valid URL starting with http:// or https://');
                return;
            }

            // Fetch proxied page
            setIsLoading(true);
            try {
                const data = await proxyPage(url);
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
        } else if (currentStep === STEPS.CONTENT_PREVIEW) {
            setCurrentStep(STEPS.IFRAME_SELECT);
            setSelectedElement(null);
        } else if (currentStep === STEPS.IMPORT_OPTIONS) {
            setCurrentStep(STEPS.CONTENT_PREVIEW);
        }
    };

    const handleImport = async () => {
        setCurrentStep(STEPS.PROCESSING);
        setProgress({ step: 'Preparing import...', percent: 10 });

        try {
            setProgress({ step: 'Processing content...', percent: 30 });

            const results = await processImport({
                html: selectedElement.html,
                slotName: slotName,
                pageId: pageId,
                mode: importMode,
                namespace: 'default',
                sourceUrl: url,
            });

            setProgress({ step: 'Creating widgets...', percent: 80 });
            setImportResults(results);
            setProgress({ step: 'Import complete!', percent: 100 });

            // Notify parent component
            if (onImportComplete) {
                onImportComplete(results.widgets);
            }

            showNotification(
                `Successfully imported ${results.widgets.length} widgets`,
                'success'
            );

            // Auto-close after success
            setTimeout(handleClose, 2000);

        } catch (err) {
            setError(err.message || 'Import failed');
            setProgress({ step: 'Import failed', percent: 0 });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
                        Step {currentStep}/5: {
                            currentStep === STEPS.URL_INPUT ? 'Enter URL' :
                            currentStep === STEPS.IFRAME_SELECT ? 'Select Content' :
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
                        <div>
                            <p className="text-sm text-gray-700 mb-3">
                                Click on the content block you want to import. Hover over elements to see them highlighted.
                            </p>
                            <div className="border border-gray-300 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                                <iframe
                                    ref={iframeRef}
                                    srcDoc={proxiedHtml}
                                    className="w-full h-full"
                                    sandbox="allow-same-origin allow-scripts"
                                    title="Content preview"
                                />
                            </div>
                            {selectedElement && (
                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                                    ✓ Selected: {selectedElement.tagName} element
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Content Preview */}
                    {currentStep === STEPS.CONTENT_PREVIEW && selectedElement && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                Preview Content
                            </h3>
                            <ContentPreview html={selectedElement.html} />
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

                    {/* Step 5: Processing */}
                    {currentStep === STEPS.PROCESSING && (
                        <div className="text-center py-8">
                            <Loader className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-900 mb-2">
                                {progress.step}
                            </p>
                            <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progress.percent}%` }}
                                />
                            </div>
                            {importResults && (
                                <div className="mt-4 text-sm text-gray-600">
                                    Created {importResults.widgets.length} widgets
                                </div>
                            )}
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
                        
                        {currentStep < STEPS.PROCESSING && currentStep !== STEPS.IFRAME_SELECT && (
                            <button
                                onClick={handleNext}
                                disabled={isLoading}
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
            </div>
        </div>
    );
};

export default ImportDialog;
