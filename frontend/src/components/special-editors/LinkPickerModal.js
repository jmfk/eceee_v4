/**
 * LinkPickerModal - Vanilla JS wrapper for the React LinkPicker component
 * 
 * Allows the LinkPicker to be used from vanilla JS editors like
 * ContentWidgetEditorRenderer and TableEditorCore.
 */

import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LinkPicker from '../LinkPicker'

// Shared query client for link picker
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30000,
            retry: 1
        }
    }
})

/**
 * LinkPickerModal class - Shows the LinkPicker in a modal
 */
export class LinkPickerModal {
    constructor(options = {}) {
        this.options = options
        this.container = null
        this.root = null
        this.currentResolve = null
        this.currentReject = null
    }

    /**
     * Show the link picker modal
     * @param {Object} linkData - Initial link data
     * @param {string|Object} linkData.url - Current URL or link object
     * @param {string} linkData.text - Selected text
     * @param {boolean} linkData.openInNewTab - Whether link opens in new tab
     * @param {HTMLElement} linkData.linkElement - Existing link element (for edit mode)
     * @param {number} linkData.currentPageId - Current page ID for context
     * @param {number} linkData.currentSiteRootId - Site root page ID
     * @returns {Promise} Resolves with link result or rejects on cancel
     */
    show(linkData = {}) {
        return new Promise((resolve, reject) => {
            this.currentResolve = resolve
            this.currentReject = reject

            const {
                url = null,
                text = '',
                openInNewTab = false,
                linkElement = null,
                currentPageId = null,
                currentSiteRootId = null
            } = linkData

            // Create container
            this.container = document.createElement('div')
            this.container.id = 'link-picker-modal-container'
            document.body.appendChild(this.container)

            // Create React root
            this.root = createRoot(this.container)

            // Handle save
            const handleSave = (result) => {
                this.close()
                
                // Convert link object to URL string for backward compatibility
                let urlValue = ''
                if (result.link) {
                    // Store as JSON string for new link format
                    urlValue = JSON.stringify(result.link)
                }

                resolve({
                    url: urlValue,
                    link: result.link,
                    text: result.replaceText ? result.text : text,
                    title: result.title,
                    openInNewTab: result.targetBlank,
                    replaceText: result.replaceText,
                    action: result.action
                })
            }

            // Handle close/cancel
            const handleClose = () => {
                this.close()
                reject(new Error('User cancelled'))
            }

            // Render LinkPicker
            this.root.render(
                createElement(QueryClientProvider, { client: queryClient },
                    createElement(LinkPicker, {
                        isOpen: true,
                        onClose: handleClose,
                        onSave: handleSave,
                        initialLink: url,
                        initialText: text,
                        currentPageId: currentPageId,
                        currentSiteRootId: currentSiteRootId,
                        showRemoveButton: !!linkElement
                    })
                )
            )
        })
    }

    /**
     * Close and cleanup
     */
    close() {
        if (this.root) {
            this.root.unmount()
            this.root = null
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container)
        }
        this.container = null
    }

    /**
     * Hide (alias for close)
     */
    hide() {
        this.close()
    }
}

export default LinkPickerModal

