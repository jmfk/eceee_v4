/**
 * LinkModal - Modal dialog for inserting/editing links in table cells
 * 
 * Based on ContentWidgetEditorRenderer link modal implementation
 */

export class LinkModal {
    constructor(options = {}) {
        this.options = options
        this.overlay = null
        this.currentResolve = null
        this.currentReject = null
    }

    /**
     * Show the link modal
     * @param {Object} linkData - { url, text, openInNewTab, linkElement, range }
     * @returns {Promise} Resolves with { url, text, openInNewTab, action: 'insert'|'remove' }
     */
    show(linkData = {}) {
        return new Promise((resolve, reject) => {
            this.currentResolve = resolve
            this.currentReject = reject

            const {
                url = '',
                text = '',
                openInNewTab = false,
                linkElement = null
            } = linkData

            // Create modal overlay
            this.overlay = document.createElement('div')
            this.overlay.className = 'table-link-modal-overlay'

            // Create dialog
            const dialog = document.createElement('div')
            dialog.className = 'table-link-modal'

            // Dialog title
            const title = document.createElement('h3')
            title.className = 'text-lg font-semibold mb-4'
            title.textContent = linkElement ? 'Edit Link' : 'Insert Link'
            dialog.appendChild(title)

            // URL input
            const urlLabel = document.createElement('label')
            urlLabel.className = 'block text-sm font-medium text-gray-700 mb-2'
            urlLabel.textContent = 'URL'
            dialog.appendChild(urlLabel)

            const urlInput = document.createElement('input')
            urlInput.type = 'url'
            urlInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4'
            urlInput.placeholder = 'https://example.com'
            urlInput.value = url
            dialog.appendChild(urlInput)

            // Text input
            const textLabel = document.createElement('label')
            textLabel.className = 'block text-sm font-medium text-gray-700 mb-2'
            textLabel.textContent = 'Link Text'
            dialog.appendChild(textLabel)

            const textInput = document.createElement('input')
            textInput.type = 'text'
            textInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4'
            textInput.placeholder = 'Link text'
            textInput.value = text
            dialog.appendChild(textInput)

            // Target checkbox
            const checkboxContainer = document.createElement('div')
            checkboxContainer.className = 'flex items-center mb-4'
            dialog.appendChild(checkboxContainer)

            const targetCheckbox = document.createElement('input')
            targetCheckbox.type = 'checkbox'
            targetCheckbox.id = 'link-target-checkbox'
            targetCheckbox.className = 'mr-2'
            targetCheckbox.checked = openInNewTab
            checkboxContainer.appendChild(targetCheckbox)

            const checkboxLabel = document.createElement('label')
            checkboxLabel.htmlFor = 'link-target-checkbox'
            checkboxLabel.className = 'text-sm text-gray-700'
            checkboxLabel.textContent = 'Open in new tab'
            checkboxContainer.appendChild(checkboxLabel)

            // Buttons container
            const buttonsContainer = document.createElement('div')
            buttonsContainer.className = 'flex justify-end gap-2'
            dialog.appendChild(buttonsContainer)

            // Cancel button
            const cancelButton = document.createElement('button')
            cancelButton.type = 'button'
            cancelButton.className = 'px-4 py-2 text-gray-600 hover:text-gray-800'
            cancelButton.textContent = 'Cancel'
            buttonsContainer.appendChild(cancelButton)

            // Remove link button (only if editing existing link)
            if (linkElement) {
                const removeButton = document.createElement('button')
                removeButton.type = 'button'
                removeButton.className = 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700'
                removeButton.textContent = 'Remove Link'
                buttonsContainer.appendChild(removeButton)

                removeButton.addEventListener('click', () => {
                    this.close()
                    resolve({
                        action: 'remove'
                    })
                })
            }

            // Insert/Update button
            const insertButton = document.createElement('button')
            insertButton.type = 'button'
            insertButton.className = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
            insertButton.textContent = linkElement ? 'Update Link' : 'Insert Link'
            buttonsContainer.appendChild(insertButton)

            // Event handlers
            const handleClose = () => {
                this.close()
                reject(new Error('User cancelled'))
            }

            const handleInsert = () => {
                const urlValue = urlInput.value.trim()
                const textValue = textInput.value.trim()
                const openInNewTabValue = targetCheckbox.checked

                if (!urlValue) {
                    urlInput.focus()
                    return
                }

                this.close()
                resolve({
                    url: urlValue,
                    text: textValue,
                    openInNewTab: openInNewTabValue,
                    action: 'insert'
                })
            }

            // Button event listeners
            cancelButton.addEventListener('click', handleClose)
            insertButton.addEventListener('click', handleInsert)

            // Close on overlay click
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    handleClose()
                }
            })

            // Handle Enter key
            const handleKeyDown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault()
                    handleInsert()
                } else if (e.key === 'Escape') {
                    e.preventDefault()
                    handleClose()
                }
            }

            urlInput.addEventListener('keydown', handleKeyDown)
            textInput.addEventListener('keydown', handleKeyDown)

            // Show dialog
            this.overlay.appendChild(dialog)
            document.body.appendChild(this.overlay)

            // Focus URL input
            setTimeout(() => urlInput.focus(), 100)
        })
    }

    /**
     * Close and remove the modal
     */
    close() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay)
        }
        this.overlay = null
    }

    /**
     * Hide (alias for close)
     */
    hide() {
        this.close()
    }
}

export default LinkModal

