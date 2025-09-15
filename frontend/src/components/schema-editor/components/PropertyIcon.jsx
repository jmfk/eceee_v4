import React from 'react'
import { Type } from 'lucide-react'
import { getPropertyType } from '../PropertyTypeRegistry'

/**
 * PropertyIcon Component
 * 
 * Displays the appropriate icon for a property based on its component type.
 */
export default function PropertyIcon({
    component,
    className = "w-5 h-5",
    propertyType = null
}) {
    // Try to get icon from property type registry first
    let IconComponent = Type // Default fallback

    if (propertyType) {
        const propType = getPropertyType(propertyType)
        if (propType && propType.icon) {
            IconComponent = propType.icon
        }
    } else if (component) {
        // Try to find property type by component name
        const propType = Object.values(getPropertyType.propertyConfigComponents || {})
            .find(pt => pt.defaultConfig?.component === component)
        if (propType && propType.icon) {
            IconComponent = propType.icon
        }
    }

    return (
        <div className="flex-shrink-0">
            <IconComponent className={className} />
        </div>
    )
}
