import { api } from '../api/client.js'
import toast from 'react-hot-toast'

/**
 * Command pattern implementation for widget operations
 * Following Sandi Metz principle: "separate the things that change from the things that stay the same"
 */

class WidgetCommand {
    constructor(apiClient = api) {
        this.apiClient = apiClient
    }

    async execute() {
        throw new Error('Command must implement execute method')
    }

    handleError(error, defaultMessage) {
        console.error(error)
        const message = error.response?.data?.detail || defaultMessage
        toast.error(message)
        throw error
    }

    handleSuccess(message) {
        if (message) toast.success(message)
    }
}

export class AddWidgetCommand extends WidgetCommand {
    constructor(apiClient, { pageId, widgetTypeId, slotName, configuration, ...inheritanceSettings }) {
        super(apiClient)
        this.pageId = pageId
        this.widgetTypeId = widgetTypeId
        this.slotName = slotName
        this.configuration = configuration
        this.inheritanceSettings = inheritanceSettings
    }

    async execute() {
        try {
            const response = await this.apiClient.post('/api/v1/webpages/widgets/', {
                page: this.pageId,
                widget_type: this.widgetTypeId,
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
}

export class UpdateWidgetCommand extends WidgetCommand {
    constructor(apiClient, { widgetId, configuration, ...inheritanceSettings }) {
        super(apiClient)
        this.widgetId = widgetId
        this.configuration = configuration
        this.inheritanceSettings = inheritanceSettings
    }

    async execute() {
        try {
            const response = await this.apiClient.patch(`/api/v1/webpages/widgets/${this.widgetId}/`, {
                configuration: this.configuration,
                ...this.inheritanceSettings
            })

            this.handleSuccess('Widget updated successfully')
            return response.data
        } catch (error) {
            this.handleError(error, 'Failed to update widget')
        }
    }
}

export class DeleteWidgetCommand extends WidgetCommand {
    constructor(apiClient, { widgetId }) {
        super(apiClient)
        this.widgetId = widgetId
    }

    async execute() {
        try {
            await this.apiClient.delete(`/api/v1/webpages/widgets/${this.widgetId}/`)
            this.handleSuccess('Widget deleted successfully')
            return true
        } catch (error) {
            this.handleError(error, 'Failed to delete widget')
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