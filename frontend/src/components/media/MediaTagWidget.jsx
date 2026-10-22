import React, { useState, useEffect, useMemo } from 'react'
import ClassificationPicker from '../classification/ClassificationPicker'
import { taxonomyApi } from '../../api/taxonomy'

export default function MediaTagWidget({ tags = [], onChange, disabled = false, namespace }) {
    const [error, setError] = useState('')
    const valid = useMemo(() => tags.filter(tag => /^[a-f0-9-]{36}$/i.test(typeof tag === 'string' ? tag : (tag.classificationId || tag.id || ''))), [tags])
    useEffect(() => {
        if (valid.length !== tags.length) onChange(valid)
    }, [tags, onChange, valid])
    const ids = [...new Set(valid.map(tag => typeof tag === 'string' ? tag : (tag.classificationId || tag.id)).filter(Boolean))]
    return <div className="space-y-2">
        <ClassificationPicker value={ids} namespace={namespace} use="media_files" disabled={disabled}
            onChange={async selected => {
                try {
                    const terms = await Promise.all(selected.map(async id => await taxonomyApi.term(id)))
                    onChange(terms.map(term => ({ ...term, classificationId: term.id })))
                    setError('')
                } catch { setError('Could not load the selected taxonomy terms. Try again.') }
            }} />
        {error && <p role="alert">{error}</p>}
        {ids.length === 0 && <p className="text-sm">At least one approved taxonomy term is required.</p>}
    </div>
}
