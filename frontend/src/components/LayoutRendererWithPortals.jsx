import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import LayoutRenderer from './LayoutRenderer.js'

/**
 * Example: Adding React UI to LayoutRenderer.js via Portals
 */
const LayoutRendererWithPortals = ({ layout, widgets, onWidgetEdit }) => {
    const containerRef = useRef()
    const rendererRef = useRef()
    const [slotElements, setSlotElements] = useState({})

    useEffect(() => {
        // Initialize vanilla LayoutRenderer
        if (!rendererRef.current) {
            rendererRef.current = new LayoutRenderer()
        }

        const renderer = rendererRef.current

        // Render layout with vanilla DOM
        renderer.render(layout, containerRef)

        // Extract slot DOM elements for React portals
        const slots = {}
        renderer.getSlotNames().forEach(slotName => {
            const slotElement = renderer.slotContainers.get(slotName)
            if (slotElement) {
                slots[slotName] = slotElement
            }
        })
        setSlotElements(slots)

        return () => {
            // Cleanup
            renderer.destroy()
        }
    }, [layout])

    // Update widgets via vanilla renderer
    useEffect(() => {
        if (rendererRef.current && widgets) {
            Object.entries(widgets).forEach(([slotName, slotWidgets]) => {
                rendererRef.current.updateSlot(slotName, slotWidgets)
            })
        }
    }, [widgets])

    return (
        <div>
            {/* Vanilla DOM container */}
            <div ref={containerRef} />

            {/* React Portals for UI overlays */}
            {Object.entries(slotElements).map(([slotName, element]) =>
                ReactDOM.createPortal(
                    <SlotUIOverlay
                        slotName={slotName}
                        onWidgetEdit={onWidgetEdit}
                    />,
                    element
                )
            )}
        </div>
    )
}

// React component rendered via portal
const SlotUIOverlay = ({ slotName, onWidgetEdit }) => (
    <div className="slot-ui-overlay absolute top-0 right-0">
        <button
            onClick={() => onWidgetEdit(slotName)}
            className="bg-blue-500 text-white p-1 rounded"
        >
            Edit {slotName}
        </button>
    </div>
)

export default LayoutRendererWithPortals 