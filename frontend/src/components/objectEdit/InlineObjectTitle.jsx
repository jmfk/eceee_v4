import React, { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../contexts/unified-data/types/operations'

export default function InlineObjectTitle({ instanceId, title, disabled = false }) {
    const { getState, publishUpdate, setIsDirty, useExternalChanges } = useUnifiedData()
    const initialTitle = getState().objects?.[String(instanceId)]?.title || title || ''
    const [value, setValue] = useState(initialTitle)
    const [error, setError] = useState('')
    const previousProp = useRef(title)
    const lastValidTitle = useRef(initialTitle)

    useExternalChanges(`inline-object-title-${instanceId}`, (state, metadata) => {
        if (metadata?.type === OperationTypes.SET_DIRTY) return
        const updated = state.objects?.[String(instanceId)]?.title
        if (updated !== undefined) {
            setValue(updated)
            if (updated.trim()) lastValidTitle.current = updated
        }
    })

    useEffect(() => {
        if (title !== previousProp.current) {
            previousProp.current = title
            const state = getState()
            if (state.metadata.isDirty && state.objects?.[String(instanceId)]?.title !== title) return
            setValue(title || '')
            if (title?.trim()) lastValidTitle.current = title
        }
    }, [getState, instanceId, title])

    const updateWorkingCopy = nextTitle => {
        setIsDirty(true)
        publishUpdate(`inline-object-title-${instanceId}`, OperationTypes.UPDATE_OBJECT, {
            id: String(instanceId), updates: { title: nextTitle },
        })
    }

    return <span className="inline-flex min-w-0 max-w-full items-center gap-2">
        <input type="text" aria-label="Object title" aria-invalid={Boolean(error)}
            required disabled={disabled} value={value}
            onChange={event => {
                const nextTitle = event.target.value
                setError('')
                if (nextTitle.trim()) {
                    lastValidTitle.current = nextTitle
                    updateWorkingCopy(nextTitle)
                }
                setValue(nextTitle)
            }}
            onBlur={() => {
                const trimmed = value.trim()
                if (!trimmed) {
                    setValue(lastValidTitle.current)
                    setError('Title is required')
                } else if (trimmed !== value) {
                    lastValidTitle.current = trimmed
                    updateWorkingCopy(trimmed)
                    setValue(trimmed)
                }
            }}
            className="min-w-[12rem] w-[min(60vw,40rem)] max-w-full rounded border border-transparent bg-transparent px-1 text-lg font-semibold text-gray-900 hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none disabled:opacity-70" />
        <Pencil aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        {error && <span role="alert" className="text-xs font-normal text-red-600">{error}</span>}
    </span>
}
