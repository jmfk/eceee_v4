import React, { useMemo, useState } from 'react'
import ClassificationPicker from '../classification/ClassificationPicker'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../contexts/unified-data/types/operations'

export default function ObjectTags({ objectType, instance }) {
    const { getState, publishUpdate, setIsDirty, useExternalChanges } = useUnifiedData()
    const componentId = useMemo(() => `object-tags-${instance?.id || 'new'}`, [instance?.id])
    const [ids, setIds] = useState(() => getState().objects?.[String(instance?.id)]?.classificationIds || instance?.classificationIds || [])
    useExternalChanges(componentId, state => {
        const updated = state.objects?.[String(instance?.id)]?.classificationIds
        if (updated) setIds(updated)
    })
    const change = value => {
        setIds(value)
        setIsDirty(true)
        if (instance?.id) publishUpdate(componentId, OperationTypes.UPDATE_OBJECT, {
            id: String(instance.id), updates: { classificationIds: value },
        })
    }
    return <ClassificationPicker value={ids} onChange={change}
        namespace={objectType?.namespace?.id} use={`object:${objectType?.id}`} allowProposed />
}
