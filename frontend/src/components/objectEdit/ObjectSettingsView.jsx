import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import ParentObjectSelector from '../ParentObjectSelector'

const ObjectSettingsView = ({ objectType, instance, isNewInstance, parentId, onSave, onCancel, onUnsavedChanges, context }) => {
    const [formData, setFormData] = useState({
        parent: instance?.parent?.id || parentId || null,
        metadata: instance?.metadata || {}
    })
    const [isDirty, setIsDirty] = useState(false)

    const { addNotification } = useGlobalNotifications()
    const { useExternalChanges, publishUpdate, setIsDirty: setUDCDirty } = useUnifiedData()
    const componentId = useMemo(() => `object-settings-view-${instance?.id || 'new'}`, [instance?.id])

    // Subscribe to external changes from UDC
    useExternalChanges(componentId, (state) => {
        if (!instance?.id) return;

        const objectData = state.objects?.[String(instance.id)];
        if (objectData) {
            const newFormData = {
                parent: objectData.parentId || null,
                metadata: objectData.metadata || {}
            };

            // Only update if data has actually changed to avoid unnecessary re-renders
            const hasChanged = JSON.stringify(formData) !== JSON.stringify(newFormData);
            if (hasChanged) {
                setFormData(newFormData);
            }
        }
    });

    // Notify parent about unsaved changes and update UDC dirty state
    useEffect(() => {
        if (onUnsavedChanges) {
            onUnsavedChanges(isDirty)
        }
        setUDCDirty(isDirty)
    }, [isDirty, onUnsavedChanges, setUDCDirty])

    // Initialize form data from instance
    useEffect(() => {
        if (instance) {
            const parentValue = instance.parent?.id || parentId || null
            setFormData({
                parent: parentValue,
                metadata: instance.metadata || {}
            })
        } else if (isNewInstance && parentId) {
            // For new instances with parent parameter, set the parent automatically
            setFormData(prev => ({
                ...prev,
                parent: parentId
            }))
        }
    }, [instance, parentId, isNewInstance])

    // Handle field changes and publish to UDC
    const handleInputChange = useCallback(async (field, value) => {
        // Update local state immediately for UI responsiveness
        setFormData(prev => ({ ...prev, [field]: value }))
        setIsDirty(true)

        // Publish update to UDC if we have an instance ID
        if (instance?.id) {
            const updates = {};
            if (field === 'parent') {
                updates.parentId = value;
            } else {
                updates[field] = value;
            }

            await publishUpdate(componentId, OperationTypes.UPDATE_OBJECT, {
                id: String(instance.id),
                updates
            });
        }
    }, [instance?.id, componentId, publishUpdate])

    return (
        <div className="h-full flex flex-col relative">
            {/* Content Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm px-4 py-3">
                <h1 className="text-lg font-semibold text-gray-900 flex items-center">
                    <SettingsIcon className="h-5 w-5 mr-2" />
                    Object Settings
                </h1>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-white">
                <div className="p-6">
                    <div className="space-y-6">

                        <div className="space-y-6">
                            {/* Parent Object */}
                            <ParentObjectSelector
                                value={formData.parent}
                                onChange={(parentId) => {
                                    handleInputChange('parent', parentId)
                                }}
                                currentObjectType={objectType}
                                currentObjectId={instance?.id}
                                placeholder="Search for parent object..."
                            />



                            {/* Object Info (read-only) */}
                            {!isNewInstance && instance && (
                                <div className="border-t pt-6">
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Object Information</h3>
                                    <div className="bg-gray-50 rounded-md p-4 space-y-2">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="font-medium text-gray-700">ID:</span>
                                                <span className="ml-2 text-gray-600">{instance.id}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-700">Slug:</span>
                                                <span className="ml-2 text-gray-600">{instance.slug}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-700">Level:</span>
                                                <span className="ml-2 text-gray-600">{instance.level || 0}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-700">Tree ID:</span>
                                                <span className="ml-2 text-gray-600">{instance.treeId || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-700">Created:</span>
                                                <span className="ml-2 text-gray-600">
                                                    {new Date(instance.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-gray-700">Updated:</span>
                                                <span className="ml-2 text-gray-600">
                                                    {new Date(instance.updatedAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Save buttons are now in the main footer */}
                </div>
            </div>
        </div>
    )
}

export default ObjectSettingsView
