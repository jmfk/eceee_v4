import React, { useRef, useEffect, useMemo, useCallback } from 'react'
import LayoutRenderer from './LayoutRenderer.js'

/**
 * Enhanced ContentEditor - Example usage of LayoutRenderer with icon menus
 * 
 * Demonstrates how to use the enhanced LayoutRenderer.js with vanilla JS UI capabilities
 * while maintaining React integration for the surrounding application.
 */
const EnhancedContentEditor = ({
    layoutJson,
    widgets = {},
    onWidgetAdd,
    onWidgetEdit,
    onSlotEdit,
    onSlotClear,
    onSlotInfo,
    className = ""
}) => {
    const containerRef = useRef()
    const rendererRef = useRef()

    // Create the enhanced layout renderer with UI capabilities
    const layoutRenderer = useMemo(() => {
        if (!rendererRef.current) {
            const renderer = new LayoutRenderer()

            // Configure UI settings
            renderer.setUIConfig({
                showAddWidget: true,
                showEditSlot: true,
                showSlotVisibility: true
            })

            // Set up UI callbacks
            renderer.setUICallbacks({
                onAddWidget: (slotName) => {
                    console.log(`Add widget to slot: ${slotName}`)
                    onWidgetAdd?.(slotName)
                },
                onEditSlot: (slotName) => {
                    console.log(`Edit slot: ${slotName}`)
                    onSlotEdit?.(slotName)
                },
                onClearSlot: (slotName) => {
                    console.log(`Clear slot: ${slotName}`)
                    onSlotClear?.(slotName)
                },
                onSlotInfo: (slotName) => {
                    console.log(`Show slot info: ${slotName}`)
                    onSlotInfo?.(slotName)
                },
                onToggleVisibility: (slotName, isVisible) => {
                    console.log(`Toggle slot ${slotName} visibility: ${isVisible}`)
                }
            })

            rendererRef.current = renderer
        }
        return rendererRef.current
    }, [onWidgetAdd, onWidgetEdit, onSlotEdit, onSlotClear, onSlotInfo])

    // Render layout when layoutJson changes
    useEffect(() => {
        if (!layoutJson || !containerRef.current || !layoutRenderer) {
            return
        }

        try {
            // Render the layout structure
            layoutRenderer.render(layoutJson, containerRef)

            // Add icon menus to all slots after rendering
            setTimeout(() => {
                layoutRenderer.addIconMenusToAllSlots({
                    showAddWidget: true,
                    showEditSlot: true,
                    showSlotVisibility: true,
                    showClearSlot: true,
                    showSlotInfo: true
                })
            }, 100) // Small delay to ensure DOM is ready

        } catch (error) {
            console.error('EnhancedContentEditor: Error rendering layout', error)
        }
    }, [layoutJson, layoutRenderer])

    // Update widgets when widgets prop changes
    useEffect(() => {
        if (!layoutRenderer || !widgets) {
            return
        }

        Object.entries(widgets).forEach(([slotName, slotWidgets]) => {
            try {
                layoutRenderer.updateSlot(slotName, slotWidgets)
            } catch (error) {
                console.error(`EnhancedContentEditor: Error updating slot ${slotName}`, error)
            }
        })
    }, [widgets, layoutRenderer])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (rendererRef.current) {
                rendererRef.current.destroy()
                rendererRef.current = null
            }
        }
    }, [])

    // Add custom styles for enhanced UI
    useEffect(() => {
        const styleId = 'enhanced-layout-renderer-styles'
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style')
            style.id = styleId
            style.textContent = `
                /* Enhanced LayoutRenderer Icon Menu Styles */
                .slot-icon-menu {
                    transition: opacity 0.2s ease;
                }
                
                .slot-menu-dropdown {
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                    z-index: 1000;
                    border: 1px solid #e5e7eb;
                }
                
                .slot-menu-dropdown button:first-child {
                    border-top-left-radius: 0.5rem;
                    border-top-right-radius: 0.5rem;
                }
                
                .slot-menu-dropdown button:last-child {
                    border-bottom-left-radius: 0.5rem;
                    border-bottom-right-radius: 0.5rem;
                }
                
                /* Slot hover effects */
                [data-slot-name]:hover .slot-icon-menu {
                    opacity: 1 !important;
                }
                
                /* Slot visibility states */
                [data-slot-name][style*="display: none"] {
                    border: 2px dashed #d1d5db;
                    min-height: 60px;
                    display: flex !important;
                    align-items: center;
                    justify-content: center;
                }
                
                [data-slot-name][style*="display: none"]:before {
                    content: "Hidden Slot";
                    color: #9ca3af;
                    font-size: 0.875rem;
                    pointer-events: none;
                }
            `
            document.head.appendChild(style)
        }

        return () => {
            const existingStyle = document.getElementById(styleId)
            if (existingStyle) {
                existingStyle.remove()
            }
        }
    }, [])

    return (
        <div className={`enhanced-content-editor relative ${className}`}>
            <div
                ref={containerRef}
                className="layout-container h-full overflow-auto p-4"
                style={{ minHeight: '400px' }}
            />

            {/* Status bar */}
            <div className="absolute bottom-4 left-4 bg-white border border-gray-200 rounded px-3 py-1 text-sm text-gray-600 shadow-sm">
                Enhanced Layout Renderer - Hover over slots to see menu
            </div>
        </div>
    )
}

export default EnhancedContentEditor 