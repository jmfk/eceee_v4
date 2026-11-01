import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { X } from 'lucide-react'

import MediaBrowser from '../media/MediaBrowser'

const DesignerMediaLibraryDialog = ({ namespace, onClose }) => (
    <Dialog open onClose={onClose} className="relative z-[70]">
        <div className="fixed inset-0 bg-gray-900/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-6">
            <DialogPanel className="flex h-[min(90dvh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded border border-gray-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                    <DialogTitle className="text-lg font-semibold text-gray-900">Media library</DialogTitle>
                    <button type="button" aria-label="Close media library" onClick={onClose} className="rounded p-1.5 text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><X className="h-5 w-5" /></button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <MediaBrowser namespace={namespace} selectionMode="none" showUploader={false} hideActions />
                </div>
            </DialogPanel>
        </div>
    </Dialog>
)

export default DesignerMediaLibraryDialog
