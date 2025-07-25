import { api } from '../api/client.js'
import { extractErrorMessage } from './errorHandling.js'

/**
 * Command pattern implementation for widget operations
 * Following Sandi Metz principle: "separate the things that change from the things that stay the same"
 */

class WidgetCommand {
    constructor(apiClient = api, notificationHandler = null) {
        this.apiClient = apiClient
        this.notificationHandler = notificationHandler
    }

    async execute() {
        throw new Error('Command must implement execute method')
    }

    handleError(error, defaultMessage, category = 'widget-error') {
        console.error(error)
        const message = extractErrorMessage(error, defaultMessage)
        if (this.notificationHandler) {
            this.notificationHandler(message, 'error', category)
        }
        throw error
    }

    handleSuccess(message, category = 'widget-success') {
        if (message && this.notificationHandler) {
            this.notificationHandler(message, 'success', category)
        }
    }
}

export class AddWidgetCommand extends WidgetCommand {
    constructor(apiClient, { pageId, widgetTypeName, slotName, configuration, ...inheritanceSettings }) {
        super(apiClient)
        this.pageId = pageId
        this.widgetTypeName = widgetTypeName
        this.slotName = slotName
        this.configuration = configuration
        this.inheritanceSettings = inheritanceSettings
    }

    async execute() {
        try {
            const response = await this.apiClient.post('/api/v1/webpages/widgets/', {
                page: this.pageId,
                widget_type: this.widgetTypeName,
                slot_name: this.slotName,
                configuration: this.configuration,
                ...this.inheritanceSettings
            })

            this.handleSuccess('Widget added successfully')
            return response.data
        } catch (error) {
            this.handleError(error, 'Failed to add widget')
        }
    }

    async undo() {
        // Implementation would require storing the created widget ID
        // This is typically handled by the calling component
        throw new Error('Undo not implemented for AddWidgetCommand')
    }
}

export class UpdateWidgetCommand extends WidgetCommand {
    constructor(apiClient, { widgetId, updates }) {
        super(apiClient)
        this.widgetId = widgetId
        this.updates = updates
        this.previousState = null
    }

    async execute() {
        try {
            // Store previous state for undo
            const currentWidget = await this.apiClient.get(`/api/v1/webpages/widgets/${this.widgetId}/`)
            this.previousState = currentWidget.data

            const response = await this.apiClient.patch(`/api/v1/webpages/widgets/${this.widgetId}/`, this.updates)

            this.handleSuccess('Widget updated successfully')
            return response.data
        } catch (error) {
            this.handleError(error, 'Failed to update widget')
        }
    }

    async undo() {
        if (!this.previousState) {
            throw new Error('No previous state available for undo')
        }

        try {
            const response = await this.apiClient.patch(`/api/v1/webpages/widgets/${this.widgetId}/`, this.previousState)
            this.handleSuccess('Widget update undone')
            return response.data
        } catch (error) {
            this.handleError(error, 'Failed to undo widget update')
        }
    }
}

export class DeleteWidgetCommand extends WidgetCommand {
    constructor(apiClient, { widgetId }) {
        super(apiClient)
        this.widgetId = widgetId
        this.deletedWidget = null
    }

    async execute() {
        try {
            // Store widget data for potential undo
            const widget = await this.apiClient.get(`/api/v1/webpages/widgets/${this.widgetId}/`)
            this.deletedWidget = widget.data

            await this.apiClient.delete(`/api/v1/webpages/widgets/${this.widgetId}/`)

            this.handleSuccess('Widget deleted successfully')
            return { deleted: true, widgetId: this.widgetId }
        } catch (error) {
            this.handleError(error, 'Failed to delete widget')
        }
    }

    async undo() {
        if (!this.deletedWidget) {
            throw new Error('No deleted widget data available for undo')
        }

        try {
            // Recreate the widget
            const { id, created_at, updated_at, ...widgetData } = this.deletedWidget
            const response = await this.apiClient.post('/api/v1/webpages/widgets/', widgetData)

            this.handleSuccess('Widget deletion undone')
            return response.data
        } catch (error) {
            this.handleError(error, 'Failed to undo widget deletion')
        }
    }
}

export class ReorderWidgetCommand extends WidgetCommand {
    constructor(apiClient, { widgetId, newSortOrder }) {
        super(apiClient)
        this.widgetId = widgetId
        this.newSortOrder = newSortOrder
    }

    async execute() {
        try {
            const response = await this.apiClient.post(`/api/v1/webpages/widgets/${this.widgetId}/reorder/`, {
                sort_order: this.newSortOrder
            })

            return response.data
        } catch (error) {
            this.handleError(error, 'Failed to reorder widget')
        }
    }
}

/**
 * Factory for creating widget commands
 * Encapsulates command creation logic and provides a clean interface
 */
export class WidgetCommandFactory {
    constructor(apiClient = axios) {
        this.apiClient = apiClient
    }

    createAddCommand(params) {
        return new AddWidgetCommand(this.apiClient, params)
    }

    createUpdateCommand(params) {
        return new UpdateWidgetCommand(this.apiClient, params)
    }

    createDeleteCommand(params) {
        return new DeleteWidgetCommand(this.apiClient, params)
    }

    createReorderCommand(params) {
        return new ReorderWidgetCommand(this.apiClient, params)
    }
}

/**
 * Composable widget operations manager
 * Coordinates multiple commands and provides high-level operations
 */
export class WidgetOperations {
    constructor(commandFactory, queryClient) {
        this.commandFactory = commandFactory
        this.queryClient = queryClient
    }

    async addWidget(params) {
        const command = this.commandFactory.createAddCommand(params)
        const result = await command.execute()
        this.invalidateQueries(params.pageId)
        return result
    }

    async updateWidget(params) {
        const command = this.commandFactory.createUpdateCommand(params)
        const result = await command.execute()
        this.invalidateQueries(params.pageId)
        return result
    }

    async deleteWidget(params) {
        const command = this.commandFactory.createDeleteCommand(params)
        const result = await command.execute()
        this.invalidateQueries(params.pageId)
        return result
    }

    async reorderWidget(params) {
        const command = this.commandFactory.createReorderCommand(params)
        const result = await command.execute()
        this.invalidateQueries(params.pageId)
        return result
    }

    invalidateQueries(pageId) {
        if (this.queryClient && pageId) {
            this.queryClient.invalidateQueries(['page-widgets', pageId])
        }
    }
} 