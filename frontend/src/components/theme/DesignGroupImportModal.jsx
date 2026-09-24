import React, { useEffect, useState } from 'react'
import { AlertTriangle, Download, Image, X } from 'lucide-react'
import { themesApi } from '../../api/themes'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'

const DesignGroupImportModal = ({ themeId, onClose, onImported, hasUnsavedChanges = false }) => {
    const [themes, setThemes] = useState([])
    const [sourceThemeId, setSourceThemeId] = useState('')
    const [selectedIndices, setSelectedIndices] = useState([])
    const [preview, setPreview] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { addNotification } = useGlobalNotifications()

    useEffect(() => {
        let active = true
        themesApi.listImportableDesignGroups(themeId)
            .then((data) => {
                if (active) setThemes(data.themes || [])
            })
            .catch((error) => addNotification({ type: 'error', message: error.message }))
            .finally(() => {
                if (active) setIsLoading(false)
            })
        return () => { active = false }
    }, [themeId, addNotification])

    const sourceTheme = themes.find((theme) => String(theme.id) === String(sourceThemeId))
    const toggleGroup = (index) => {
        setPreview(null)
        setSelectedIndices((current) => current.includes(index)
            ? current.filter((value) => value !== index)
            : [...current, index])
    }

    const requestData = {
        sourceThemeId: Number(sourceThemeId),
        groupIndices: selectedIndices,
    }

    const reviewImport = async () => {
        setIsSubmitting(true)
        try {
            setPreview(await themesApi.previewDesignGroupImport(themeId, requestData))
        } catch (error) {
            addNotification({ type: 'error', message: error.message })
        } finally {
            setIsSubmitting(false)
        }
    }

    const importGroups = async (conflictResolution) => {
        setIsSubmitting(true)
        try {
            const result = await themesApi.importDesignGroups(themeId, {
                ...requestData,
                conflictResolution,
            })
            onImported(result.designGroups)
            addNotification({ type: 'success', message: result.message })
            onClose()
        } catch (error) {
            addNotification({ type: 'error', message: error.message })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="design-group-import-title"
                className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 p-4">
                    <div>
                        <h2 id="design-group-import-title" className="text-lg font-semibold text-gray-900">Import Design Groups</h2>
                        <p className="mt-1 text-sm text-gray-600">Copy groups and their images from another theme in this tenant.</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close import dialog" className="rounded p-1 text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
                    {isLoading ? (
                        <p className="text-sm text-gray-600">Loading themes…</p>
                    ) : themes.length === 0 ? (
                        <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">No other themes are available in this tenant.</p>
                    ) : hasUnsavedChanges ? (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                                <div>
                                    <h3 className="font-medium text-gray-900">Save your current theme changes first</h3>
                                    <p className="mt-1 text-sm text-gray-700">Import updates the destination theme immediately, so existing edits must be saved or discarded before continuing.</p>
                                </div>
                            </div>
                        </div>
                    ) : !preview ? (
                        <>
                            <label className="block">
                                <span className="mb-1 block text-sm font-medium text-gray-700">Source theme</span>
                                <select
                                    value={sourceThemeId}
                                    onChange={(event) => {
                                        setSourceThemeId(event.target.value)
                                        setSelectedIndices([])
                                    }}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                                >
                                    <option value="">Choose a theme…</option>
                                    {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
                                </select>
                            </label>

                            {sourceTheme && (
                                <fieldset>
                                    <legend className="mb-2 text-sm font-medium text-gray-700">Design groups</legend>
                                    <div className="space-y-2">
                                        {sourceTheme.groups.length === 0 && <p className="text-sm text-gray-500">This theme has no design groups.</p>}
                                        {sourceTheme.groups.map((group) => (
                                            <label key={group.index} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIndices.includes(group.index)}
                                                    onChange={() => toggleGroup(group.index)}
                                                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-medium text-gray-900">{group.name}</span>
                                                    <span className="mt-1 block text-xs text-gray-500">
                                                        {[...(group.widgetTypes || []), ...(group.slots || []).map((slot) => `slot: ${slot}`)].join(' · ') || 'Global targeting'}
                                                    </span>
                                                </span>
                                                <span className="flex items-center gap-1 text-xs text-gray-500"><Image className="h-3.5 w-3.5" />{group.imageCount}</span>
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                            )}
                        </>
                    ) : (
                        <>
                            <div className={`rounded-lg border p-4 ${preview.conflictCount ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}`}>
                                <div className="flex items-start gap-3">
                                    {preview.conflictCount > 0 && <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />}
                                    <div>
                                        <h3 className="font-medium text-gray-900">
                                            {preview.conflictCount > 0 ? `${preview.conflictCount} name conflict${preview.conflictCount === 1 ? '' : 's'} found` : 'Ready to import'}
                                        </h3>
                                        <p className="mt-1 text-sm text-gray-700">{preview.groups.length} group(s) and {preview.imageCount} image(s) selected.</p>
                                    </div>
                                </div>
                            </div>
                            <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                                {preview.groups.map((group) => (
                                    <li key={group.name} className="flex items-center justify-between gap-3 p-3 text-sm">
                                        <span className="font-medium text-gray-900">{group.name}</span>
                                        <span className={group.conflict ? 'text-amber-700' : 'text-gray-500'}>{group.conflict ? 'Same name exists' : `${group.imageCount} image(s)`}</span>
                                    </li>
                                ))}
                            </ul>
                            {preview.conflictCount > 0 && <p className="text-sm text-gray-600">Skip keeps existing groups with the same name. Overwrite replaces those groups. Neither option overwrites image files used elsewhere.</p>}
                        </>
                    )}
                </div>

                <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 p-4">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                    {preview ? (
                        preview.conflictCount > 0 ? (
                            <>
                                <button type="button" onClick={() => importGroups('skip')} disabled={isSubmitting} className="rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">Skip conflicts</button>
                                <button type="button" onClick={() => importGroups('overwrite')} disabled={isSubmitting} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">Overwrite conflicts</button>
                            </>
                        ) : (
                            <button type="button" onClick={() => importGroups('skip')} disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Download className="h-4 w-4" />Import groups</button>
                        )
                    ) : !hasUnsavedChanges ? (
                        <button type="button" onClick={reviewImport} disabled={!sourceThemeId || selectedIndices.length === 0 || isSubmitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Review import</button>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

export default DesignGroupImportModal
