/**
 * Upload Queue Store using Zustand
 * 
 * Manages file upload queue with:
 * - Queue management (add, remove, retry)
 * - Progress tracking per file and overall
 * - Upload status tracking
 * - Retry mechanism for failed uploads
 * - Pause/resume functionality
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { mediaApi } from '../api';

const UPLOAD_STATUS = {
    PENDING: 'pending',
    UPLOADING: 'uploading',
    COMPLETED: 'completed',
    FAILED: 'failed',
    PAUSED: 'paused',
    CANCELLED: 'cancelled'
};

const useUploadStore = create(
    devtools(
        (set, get) => ({
            // State
            queue: [], // Array of upload items
            isUploading: false,
            currentUpload: null,
            globalProgress: 0,

            // Upload item structure:
            // {
            //   id: string,
            //   file: File,
            //   namespace: string,
            //   folderPath?: string,
            //   status: UPLOAD_STATUS,
            //   progress: number (0-100),
            //   error?: string,
            //   result?: object,
            //   retryCount: number,
            //   createdAt: Date,
            //   startedAt?: Date,
            //   completedAt?: Date
            // }

            // Actions
            addFiles: (files, namespace, folderPath = '') => {
                const newItems = Array.from(files).map(file => ({
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    file,
                    namespace,
                    folderPath,
                    status: UPLOAD_STATUS.PENDING,
                    progress: 0,
                    retryCount: 0,
                    createdAt: new Date()
                }));

                set(state => ({
                    queue: [...state.queue, ...newItems]
                }));

                // Auto-start upload if not already uploading
                if (!get().isUploading) {
                    get().startNextUpload();
                }

                return newItems.map(item => item.id);
            },

            removeFromQueue: (id) => {
                set(state => ({
                    queue: state.queue.filter(item => item.id !== id)
                }));
            },

            clearCompleted: () => {
                set(state => ({
                    queue: state.queue.filter(item =>
                        item.status !== UPLOAD_STATUS.COMPLETED &&
                        item.status !== UPLOAD_STATUS.CANCELLED
                    )
                }));
            },

            clearAll: () => {
                set({ queue: [], currentUpload: null, isUploading: false, globalProgress: 0 });
            },

            retryUpload: (id) => {
                set(state => ({
                    queue: state.queue.map(item =>
                        item.id === id
                            ? { ...item, status: UPLOAD_STATUS.PENDING, error: undefined, progress: 0 }
                            : item
                    )
                }));

                if (!get().isUploading) {
                    get().startNextUpload();
                }
            },

            cancelUpload: (id) => {
                const state = get();

                // If it's the current upload, we need to handle cancellation
                if (state.currentUpload?.id === id) {
                    // TODO: Implement actual upload cancellation
                    set(state => ({
                        currentUpload: null,
                        isUploading: false,
                        queue: state.queue.map(item =>
                            item.id === id
                                ? { ...item, status: UPLOAD_STATUS.CANCELLED }
                                : item
                        )
                    }));

                    // Start next upload
                    setTimeout(() => get().startNextUpload(), 100);
                } else {
                    set(state => ({
                        queue: state.queue.map(item =>
                            item.id === id
                                ? { ...item, status: UPLOAD_STATUS.CANCELLED }
                                : item
                        )
                    }));
                }
            },

            pauseQueue: () => {
                set({ isUploading: false });
            },

            resumeQueue: () => {
                if (!get().isUploading) {
                    get().startNextUpload();
                }
            },

            startNextUpload: async () => {
                const state = get();

                if (state.isUploading) return;

                const nextItem = state.queue.find(item => item.status === UPLOAD_STATUS.PENDING);
                if (!nextItem) {
                    set({ isUploading: false, currentUpload: null });
                    get().updateGlobalProgress();
                    return;
                }

                set({
                    isUploading: true,
                    currentUpload: nextItem,
                    queue: state.queue.map(item =>
                        item.id === nextItem.id
                            ? { ...item, status: UPLOAD_STATUS.UPLOADING, startedAt: new Date() }
                            : item
                    )
                });

                try {
                    const uploadData = {
                        files: [nextItem.file],
                        namespace: nextItem.namespace,
                        folderPath: nextItem.folderPath
                    };

                    const result = await mediaApi.upload.upload(uploadData, (progress) => {
                        set(state => ({
                            queue: state.queue.map(item =>
                                item.id === nextItem.id
                                    ? { ...item, progress }
                                    : item
                            )
                        }));
                        get().updateGlobalProgress();
                    });

                    // Check if file was rejected as duplicate
                    const rejectedFiles = result.rejectedFiles || result.rejected_files || [];
                    const wasRejected = rejectedFiles.some(rejected =>
                        rejected.filename === nextItem.file.name
                    );

                    // Upload completed (successful or rejected)
                    set(state => ({
                        queue: state.queue.map(item =>
                            item.id === nextItem.id
                                ? {
                                    ...item,
                                    status: wasRejected ? UPLOAD_STATUS.FAILED : UPLOAD_STATUS.COMPLETED,
                                    progress: 100,
                                    result,
                                    error: wasRejected ? rejectedFiles.find(r => r.filename === nextItem.file.name)?.error : null,
                                    completedAt: new Date()
                                }
                                : item
                        ),
                        currentUpload: null,
                        isUploading: false
                    }));

                } catch (error) {
                    console.error('Upload failed:', error);

                    const maxRetries = 3;
                    const shouldRetry = nextItem.retryCount < maxRetries;

                    set(state => ({
                        queue: state.queue.map(item =>
                            item.id === nextItem.id
                                ? {
                                    ...item,
                                    status: shouldRetry ? UPLOAD_STATUS.PENDING : UPLOAD_STATUS.FAILED,
                                    error: error.message,
                                    retryCount: item.retryCount + 1,
                                    progress: 0
                                }
                                : item
                        ),
                        currentUpload: null,
                        isUploading: false
                    }));
                }

                get().updateGlobalProgress();

                // Continue with next upload
                setTimeout(() => get().startNextUpload(), 500);
            },

            updateGlobalProgress: () => {
                const state = get();
                const totalItems = state.queue.length;

                if (totalItems === 0) {
                    set({ globalProgress: 0 });
                    return;
                }

                const totalProgress = state.queue.reduce((sum, item) => {
                    if (item.status === UPLOAD_STATUS.COMPLETED) return sum + 100;
                    if (item.status === UPLOAD_STATUS.UPLOADING) return sum + item.progress;
                    return sum;
                }, 0);

                const globalProgress = Math.round(totalProgress / totalItems);
                set({ globalProgress });
            },

            // Getters
            getQueueStats: () => {
                const state = get();
                return {
                    total: state.queue.length,
                    pending: state.queue.filter(item => item.status === UPLOAD_STATUS.PENDING).length,
                    uploading: state.queue.filter(item => item.status === UPLOAD_STATUS.UPLOADING).length,
                    completed: state.queue.filter(item => item.status === UPLOAD_STATUS.COMPLETED).length,
                    failed: state.queue.filter(item => item.status === UPLOAD_STATUS.FAILED).length,
                    cancelled: state.queue.filter(item => item.status === UPLOAD_STATUS.CANCELLED).length
                };
            },

            getUploadById: (id) => {
                return get().queue.find(item => item.id === id);
            }
        }),
        {
            name: 'upload-store'
        }
    )
);

export { UPLOAD_STATUS };
export default useUploadStore;
