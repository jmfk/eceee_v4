import React from 'react'
import ClassificationPicker from '../classification/ClassificationPicker'

export default function ClassificationSelectorInput({ value = [], onChange, disabled = false, namespace }) {
    return <ClassificationPicker value={value || []} onChange={onChange} disabled={disabled} namespace={namespace} />
}
