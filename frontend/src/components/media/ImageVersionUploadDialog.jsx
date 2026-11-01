import { useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import ClassificationPicker from '../classification/ClassificationPicker'
import { extractErrorMessage } from '../../utils/errorHandling'

export default function ImageVersionUploadDialog({ file, namespace, onClose, onUploaded }) {
    const [upload, setUpload] = useState(null)
    const [newTagIds, setNewTagIds] = useState([])
    const [showTags, setShowTags] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const { addNotification } = useGlobalNotifications()

    const submit = async (event) => {
        event.preventDefault()
        if (!upload || busy) return
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(upload.type)) {
            setError('Choose a JPEG, PNG, GIF, or WebP image.')
            return
        }
        setBusy(true)
        setError('')
        try {
            let updated = await mediaApi.files.replaceFile(file.id, upload)
            if (newTagIds.length) {
                try {
                    const existingIds = updated.classificationIds || file.classificationIds || []
                    updated = await mediaApi.files.update(file.id, {
                        classification_ids: [...new Set([...existingIds, ...newTagIds])],
                    })()
                } catch (tagError) {
                    addNotification(`New version uploaded, but tags could not be added: ${extractErrorMessage(tagError)}`, 'warning')
                }
            }
            addNotification('New image version uploaded', 'success')
            onUploaded?.(updated)
            onClose()
        } catch (uploadError) {
            setError(extractErrorMessage(uploadError))
        } finally {
            setBusy(false)
        }
    }

    return <Dialog open={Boolean(file)} onClose={busy ? () => {} : onClose} className="relative z-[60]">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
            <DialogPanel className="flex h-[min(70dvh,560px)] w-full max-w-xl flex-col overflow-hidden rounded border border-gray-200 bg-white p-5 shadow-xl">
                <DialogTitle className="shrink-0 text-lg font-semibold text-gray-900">Upload new version of {file.title}</DialogTitle>
                <p className="mt-1 shrink-0 text-sm text-gray-600">The image keeps its place in the library and collections. Its previous version remains in version history.</p>
                <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-5">
                    <div>
                        <label htmlFor="image-version-file" className="block text-xs font-medium text-gray-700">New image</label>
                        <input id="image-version-file" type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={event => { setUpload(event.target.files?.[0] || null); setError('') }}
                            className="mt-1 block w-full rounded border border-gray-300 p-2 text-xs" />
                    </div>
                    <div>
                        <button type="button" aria-expanded={showTags} onClick={() => setShowTags(value => !value)}
                            className="text-xs font-medium text-blue-700 hover:underline">Add tags (optional)</button>
                        {showTags && <div className="mt-2">
                            <p className="mb-2 text-xs text-gray-500">Existing tags stay on this image.</p>
                            <ClassificationPicker value={newTagIds} onChange={setNewTagIds} namespace={namespace} use="media_files" disabled={busy} />
                        </div>}
                    </div>
                    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                    </div>
                    <div className="flex shrink-0 justify-end gap-2 border-t border-gray-200 pt-4">
                        <button type="button" onClick={onClose} disabled={busy} className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-700 disabled:opacity-50">Cancel</button>
                        <button type="submit" disabled={!upload || busy} className="rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                            {busy ? 'Uploading…' : 'Upload new version'}
                        </button>
                    </div>
                </form>
            </DialogPanel>
        </div>
    </Dialog>
}
