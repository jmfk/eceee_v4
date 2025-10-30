/**
 * TableWidgetEditor - React wrapper for TableEditorCore
 * 
 * Wraps the vanilla JS table editor for React integration with detached toolbar mode.
 * Similar to ContentWidgetEditor but for tables.
 */

import React, { useRef, useEffect, useCallback, memo, useState } from 'react';
import { TableEditorCore } from '../../components/special-editors/TableEditorCore';
import TableImportModal from '../../components/special-editors/TableImportModal';

const TableWidgetEditor = memo(({ config, onChange, className, slotDimensions }) => {
    const containerRef = useRef(null);
    const coreRef = useRef(null);
    const lastExternalConfigRef = useRef(config);
    const clickHandlerRef = useRef(null);
    const [showImportModal, setShowImportModal] = useState(false);

    // Initialize table editor core
    useEffect(() => {
        if (containerRef.current && !coreRef.current) {
            // Initialize vanilla JS table editor with detached toolbar mode
            coreRef.current = new TableEditorCore(config, {
                onChange,
                detachedToolbar: true,
                onSelectionChange: (cells) => {
                    // Selection changes are handled by the core and toolbar manager
                }
            });

            coreRef.current.render(containerRef.current);
            lastExternalConfigRef.current = config;

            // Set up click handler for activation
            // The click handler should be on the container itself
            clickHandlerRef.current = () => {
                if (coreRef.current && !coreRef.current.isActive) {
                    coreRef.current.activate();
                }
            };

            // Add click listener to container
            if (containerRef.current) {
                containerRef.current.addEventListener('click', clickHandlerRef.current);

                // Also listen for the import modal open event
                const importHandler = () => {
                    setShowImportModal(true);
                };
                containerRef.current.addEventListener('open-import-modal', importHandler);

                // Store import handler for cleanup
                containerRef.current._importHandler = importHandler;
            }
        }
    }, []); // Empty deps - initialize once

    // Separate effect for config updates - only update if config is externally changed
    useEffect(() => {
        if (coreRef.current && config !== lastExternalConfigRef.current) {
            const currentEditorConfig = coreRef.current.data;
            // Only update if the new config differs from what the editor currently has
            if (JSON.stringify(config) !== JSON.stringify(currentEditorConfig)) {
                coreRef.current.updateTable(config);
                lastExternalConfigRef.current = config;
            }
        }
    }, [config]);

    // Separate effect for onChange updates
    useEffect(() => {
        if (coreRef.current) {
            coreRef.current.options.onChange = onChange;
        }
    }, [onChange]);

    // Handle import
    const handleImport = useCallback((tableData) => {
        if (onChange && tableData) {
            onChange(tableData);

            // Force immediate reload of the table editor
            if (coreRef.current) {
                coreRef.current.updateTable(tableData);
            }
        }
        setShowImportModal(false);
    }, [onChange]);

    // Cleanup
    useEffect(() => {
        return () => {
            // Clean up event listeners
            if (containerRef.current) {
                if (clickHandlerRef.current) {
                    containerRef.current.removeEventListener('click', clickHandlerRef.current);
                }
                if (containerRef.current._importHandler) {
                    containerRef.current.removeEventListener('open-import-modal', containerRef.current._importHandler);
                }
            }

            // Destroy core editor
            if (coreRef.current) {
                coreRef.current.destroy();
                coreRef.current = null;
            }
        };
    }, []);

    return (
        <>
            <div ref={containerRef} className={`table-editor-container ${className}`} />

            {/* Import Modal */}
            <TableImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImport={handleImport}
                existingData={config}
            />
        </>
    );
});

TableWidgetEditor.displayName = 'TableWidgetEditor';

export default TableWidgetEditor;

