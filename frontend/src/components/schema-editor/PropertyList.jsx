import React from 'react'
import PropertyItem from './PropertyItem'

/**
 * PropertyList Component
 * 
 * Manages the list of properties in the schema with property management
 * operations. Drag-and-drop reordering available via move up/down buttons.
 */
export default function PropertyList({
  properties = [],
  onChange,
  errors = {},
  disabled = false
}) {

  const handleUpdateProperty = (index, updatedProperty) => {
    const updatedProperties = [...properties]
    updatedProperties[index] = {
      ...updatedProperty,
      _id: properties[index]._id // Preserve the _id
    }
    onChange(updatedProperties)
  }

  const handleDeleteProperty = (index) => {
    const updatedProperties = properties.filter((_, i) => i !== index)
    onChange(updatedProperties)
  }

  const handleDuplicateProperty = (index, duplicatedProperty) => {
    const updatedProperties = [...properties]
    updatedProperties.splice(index + 1, 0, duplicatedProperty)
    onChange(updatedProperties)
  }

  const handleMoveProperty = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= properties.length) return

    const updatedProperties = [...properties]
    const [movedProperty] = updatedProperties.splice(index, 1)
    updatedProperties.splice(newIndex, 0, movedProperty)
    onChange(updatedProperties)
  }

  // TODO: Implement drag-and-drop when React 19 compatible library is available

  if (properties.length === 0) {
    return (
      <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-xl">
        <div className="text-gray-600 text-lg mb-2">No properties defined yet</div>
        <div className="text-gray-500 text-sm">Use the "Add Property" button above to start building your schema</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Properties List */}
      <div className="space-y-4">
        {properties.map((property, index) => (
          <PropertyItem
            key={property._id || `property-${index}`}
            property={property}
            index={index}
            totalCount={properties.length}
            onChange={(updated) => handleUpdateProperty(index, updated)}
            onDelete={() => handleDeleteProperty(index)}
            onMoveUp={() => handleMoveProperty(index, 'up')}
            onMoveDown={() => handleMoveProperty(index, 'down')}
            onDuplicate={(duplicated) => handleDuplicateProperty(index, duplicated)}
            errors={errors}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Properties Summary */}
      {properties.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <div className="font-medium mb-2">Schema Summary</div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-medium">Total Properties:</span> {properties.length}
              </div>
              <div>
                <span className="font-medium">Required Fields:</span> {properties.filter(p => p.required).length}
              </div>
              <div>
                <span className="font-medium">Text Fields:</span> {properties.filter(p => ['TextInput', 'TextareaInput', 'RichTextInput'].includes(p.component)).length}
              </div>
              <div>
                <span className="font-medium">Media Fields:</span> {properties.filter(p => ['ImageInput', 'FileInput'].includes(p.component)).length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}