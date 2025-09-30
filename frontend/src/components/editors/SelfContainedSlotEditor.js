/**
 * Self-Contained Slot Editor
 * 
 * Vanilla JS slot editor that manages slot widgets without React rerenders.
 * Integrates directly with UDC for real-time synchronization.
 */

import { OperationTypes } from '../../contexts/unified-data/types/operations';

/**
 * Central Slot Registry (Singleton)
 * Manages all active slot editors and provides event broadcasting
 */
class SlotRegistry {
    constructor() {
        if (SlotRegistry.instance) {
            return SlotRegistry.instance;
        }

        this.slots = new Map(); // slotId -> slot editor instance
        this.listeners = new Map(); // event type -> Set of listeners
        SlotRegistry.instance = this;
    }

    register(slotEditor) {
        this.slots.set(slotEditor.slotId, slotEditor);
        console.log(`SlotRegistry: Registered slot ${slotEditor.slotId}`);
    }

    unregister(slotId) {
        this.slots.delete(slotId);
        console.log(`SlotRegistry: Unregistered slot ${slotId}`);
    }

    // Event system for slot communication
    emit(eventType, data) {
        const listeners = this.listeners.get(eventType) || new Set();
        listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error('Slot registry listener error:', error);
            }
        });
    }

    subscribe(eventType, listener) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType).add(listener);

        return () => this.listeners.get(eventType)?.delete(listener);
    }

    // Get all slots for debugging
    getAllSlots() {
        return Array.from(this.slots.keys());
    }
}

/**
 * Self-Contained Slot Editor Class
 * Manages slot widgets without React rerenders
 */
class SelfContainedSlotEditor {
    constructor(slotData, options = {}) {
        // Core data
        this.slotName = slotData.slotName;
        this.slotLabel = slotData.slotLabel;
        this.parentWidgetId = slotData.parentWidgetId;
        this.contextType = slotData.contextType || 'page';
        this.slotId = `${this.parentWidgetId}-${this.slotName}`;

        // Widget data
        this.widgets = [...(slotData.widgets || [])];
        this.availableWidgetTypes = slotData.availableWidgetTypes || [];
        this.maxWidgets = slotData.maxWidgets || null;

        // DOM management
        this.container = null;
        this.widgetListElement = null;
        this.addButtonElement = null;
        this.headerElement = null;
        this.slotCountElement = null;

        // UDC integration
        this.publishUpdate = options.publishUpdate;
        this.componentId = `slot-editor-${this.slotId}`;

        // State tracking
        this.isDestroyed = false;
        this.isInitialized = false;
        this.updateLock = false;

        // Options
        this.showAddButton = options.showAddButton !== false;
        this.showMoveButtons = options.showMoveButtons !== false;
        this.showEditButton = options.showEditButton !== false;
        this.showRemoveButton = options.showRemoveButton !== false;
        this.emptyMessage = options.emptyMessage || `No widgets in ${this.slotLabel.toLowerCase()}`;

        // Registry integration
        this.registry = options.registry || new SlotRegistry();

        // Callbacks
        this.onWidgetEdit = options.onWidgetEdit;

        // Event handlers cleanup
        this.eventHandlers = [];

        // Bind methods
        this.handleAddWidget = this.handleAddWidget.bind(this);
        this.handleRemoveWidget = this.handleRemoveWidget.bind(this);
        this.handleMoveWidget = this.handleMoveWidget.bind(this);
        this.handleEditWidget = this.handleEditWidget.bind(this);
        this.handleContainerClick = this.handleContainerClick.bind(this);
        this.handleAddSelectChange = this.handleAddSelectChange.bind(this);
    }

    /**
     * Initialize the slot editor (replaces React mounting)
     */
    async initialize(container) {
        if (this.isDestroyed) {
            throw new Error('Cannot initialize destroyed slot editor');
        }

        this.container = container;

        try {
            // Render the slot editor
            this.render();

            // Setup event listeners
            this.setupEventListeners();

            // Register with central registry
            this.registry.register(this);

            // Setup UDC subscription
            this.setupUDCSubscription();

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize slot editor:', error);
            return false;
        }
    }

    /**
     * Render the slot editor DOM
     */
    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="slot-editor border border-gray-200 rounded-lg p-4">
                <div class="slot-header flex justify-between items-center mb-3">
                    <div class="slot-info">
                        <h4 class="font-medium text-gray-800">${this.slotLabel}</h4>
                        ${this.maxWidgets ? `<span class="text-xs text-gray-500 slot-count">${this.widgets.length}/${this.maxWidgets} widgets</span>` : ''}
                    </div>
                    ${this.showAddButton && this.canAddWidget() ? `
                        <div class="slot-actions">
                            <select class="add-widget-select text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">+ Add Widget</option>
                                ${this.availableWidgetTypes.map(type =>
            `<option value="${type.type}">${type.name}</option>`
        ).join('')}
                            </select>
                        </div>
                    ` : ''}
                </div>
                <div class="widgets-list space-y-2"></div>
            </div>
        `;

        // Cache DOM elements
        this.headerElement = this.container.querySelector('.slot-header');
        this.widgetListElement = this.container.querySelector('.widgets-list');
        this.addButtonElement = this.container.querySelector('.add-widget-select');
        this.slotCountElement = this.container.querySelector('.slot-count');

        // Render widgets
        this.renderWidgets();
    }

    /**
     * Render widgets list without React
     */
    renderWidgets() {
        if (!this.widgetListElement) return;

        if (this.widgets.length === 0) {
            this.widgetListElement.innerHTML = `
                <div class="empty-slot text-center py-6 text-gray-500 border-2 border-dashed border-gray-300 rounded">
                    <p class="mb-2">${this.emptyMessage}</p>
                    ${this.showAddButton && this.availableWidgetTypes.length > 0 && this.canAddWidget() ? `
                        <button class="add-first-widget text-blue-600 hover:text-blue-800 text-sm px-3 py-1 rounded border border-blue-300 hover:bg-blue-50">
                            Add first widget
                        </button>
                    ` : ''}
                </div>
            `;
            return;
        }

        const widgetsHTML = this.widgets.map((widget, index) => `
            <div class="widget-item bg-gray-50 border border-gray-200 rounded p-3" data-widget-id="${widget.id}" data-widget-index="${index}">
                <div class="widget-controls flex justify-between items-center mb-2">
                    <div class="widget-info flex items-center space-x-2">
                        <span class="drag-handle text-gray-400 cursor-grab">⋮⋮</span>
                        <span class="widget-type font-medium text-sm text-gray-700">
                            ${this.getWidgetDisplayName(widget.type)}
                        </span>
                    </div>
                    
                    <div class="actions flex items-center space-x-1">
                        ${this.showMoveButtons && index > 0 ? `
                            <button class="move-up-btn text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-200" 
                                    data-widget-index="${index}" title="Move up">↑</button>
                        ` : ''}
                        ${this.showMoveButtons && index < this.widgets.length - 1 ? `
                            <button class="move-down-btn text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-200" 
                                    data-widget-index="${index}" title="Move down">↓</button>
                        ` : ''}
                        ${this.showEditButton ? `
                            <button class="edit-widget-btn text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-100" 
                                    data-widget-index="${index}" title="Edit widget">✏️</button>
                        ` : ''}
                        ${this.showRemoveButton ? `
                            <button class="remove-widget-btn text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100" 
                                    data-widget-index="${index}" title="Remove widget">×</button>
                        ` : ''}
                    </div>
                </div>
                
                <div class="widget-summary text-xs text-gray-600">
                    ${this.getWidgetSummary(widget)}
                </div>
            </div>
        `).join('');

        this.widgetListElement.innerHTML = widgetsHTML;
    }

    /**
     * Setup event listeners for DOM interactions
     */
    setupEventListeners() {
        if (!this.container) return;

        // Add widget dropdown
        if (this.addButtonElement) {
            const handler = this.handleAddSelectChange;
            this.addButtonElement.addEventListener('change', handler);
            this.eventHandlers.push(() => this.addButtonElement.removeEventListener('change', handler));
        }

        // Widget action buttons (using event delegation)
        const clickHandler = this.handleContainerClick;
        this.container.addEventListener('click', clickHandler);
        this.eventHandlers.push(() => this.container.removeEventListener('click', clickHandler));
    }

    /**
     * Handle add widget select change
     */
    handleAddSelectChange(e) {
        if (e.target.value) {
            this.handleAddWidget(e.target.value);
            e.target.value = '';
        }
    }

    /**
     * Handle container click events (event delegation)
     */
    handleContainerClick(e) {
        const widgetIndex = parseInt(e.target.dataset.widgetIndex);

        if (e.target.classList.contains('move-up-btn')) {
            this.handleMoveWidget(widgetIndex, widgetIndex - 1);
        } else if (e.target.classList.contains('move-down-btn')) {
            this.handleMoveWidget(widgetIndex, widgetIndex + 1);
        } else if (e.target.classList.contains('edit-widget-btn')) {
            this.handleEditWidget(this.widgets[widgetIndex], widgetIndex);
        } else if (e.target.classList.contains('remove-widget-btn')) {
            this.handleRemoveWidget(widgetIndex);
        } else if (e.target.classList.contains('add-first-widget')) {
            if (this.availableWidgetTypes.length > 0) {
                this.handleAddWidget(this.availableWidgetTypes[0].type);
            }
        }
    }

    /**
     * Setup UDC subscription for external changes
     */
    setupUDCSubscription() {
        // Subscribe to registry events for external changes
        this.udcUnsubscribe = this.registry.subscribe('EXTERNAL_CHANGE', (event) => {
            if (event.slotId === this.slotId && !this.updateLock) {
                this.updateWidgets(event.widgets);
            }
        });
    }

    /**
     * Check if widgets can be added to this slot
     */
    canAddWidget() {
        return !this.maxWidgets || this.widgets.length < this.maxWidgets;
    }

    /**
     * Widget operations with UDC integration
     */
    async handleAddWidget(widgetType) {
        if (!this.canAddWidget()) {
            console.warn(`Cannot add widget to slot ${this.slotName}: slot is full`);
            return;
        }

        const newWidget = {
            id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: widgetType,
            config: {},
            slot_name: this.slotName,
            sort_order: this.widgets.length,
            parent_widget_id: this.parentWidgetId
        };

        // Lock updates to prevent feedback loops
        this.lockUpdates();

        // Update local state
        this.widgets.push(newWidget);
        this.renderWidgets();
        this.updateSlotCount();

        // Publish to UDC
        if (this.publishUpdate) {
            try {
                await this.publishUpdate(this.componentId, OperationTypes.ADD_WIDGET, {
                    id: newWidget.id,
                    type: newWidget.type,
                    config: newWidget.config,
                    slot: this.slotName,
                    contextType: this.contextType,
                    parentWidgetId: this.parentWidgetId,
                    order: this.widgets.length - 1
                });
            } catch (error) {
                console.error('Failed to publish ADD_WIDGET:', error);
            }
        }

        // Emit registry event
        this.registry.emit('WIDGET_ADDED', {
            slotId: this.slotId,
            widget: newWidget,
            widgets: [...this.widgets]
        });
    }

    async handleRemoveWidget(widgetIndex) {
        const widget = this.widgets[widgetIndex];
        if (!widget) return;

        // Lock updates to prevent feedback loops
        this.lockUpdates();

        // Update local state
        this.widgets.splice(widgetIndex, 1);
        this.renderWidgets();
        this.updateSlotCount();

        // Publish to UDC
        if (this.publishUpdate) {
            try {
                await this.publishUpdate(this.componentId, OperationTypes.REMOVE_WIDGET, {
                    id: widget.id,
                    slot: this.slotName,
                    contextType: this.contextType,
                    parentWidgetId: this.parentWidgetId
                });
            } catch (error) {
                console.error('Failed to publish REMOVE_WIDGET:', error);
            }
        }

        // Emit registry event
        this.registry.emit('WIDGET_REMOVED', {
            slotId: this.slotId,
            widget,
            widgets: [...this.widgets]
        });
    }

    async handleMoveWidget(fromIndex, toIndex) {
        if (fromIndex === toIndex || toIndex < 0 || toIndex >= this.widgets.length) return;

        const widget = this.widgets[fromIndex];
        if (!widget) return;

        // Lock updates to prevent feedback loops
        this.lockUpdates();

        // Update local state
        const [movedWidget] = this.widgets.splice(fromIndex, 1);
        this.widgets.splice(toIndex, 0, movedWidget);
        this.renderWidgets();

        // Publish to UDC
        if (this.publishUpdate) {
            try {
                await this.publishUpdate(this.componentId, OperationTypes.MOVE_WIDGET, {
                    id: widget.id,
                    slot: this.slotName,
                    fromIndex,
                    toIndex,
                    contextType: this.contextType,
                    parentWidgetId: this.parentWidgetId
                });
            } catch (error) {
                console.error('Failed to publish MOVE_WIDGET:', error);
            }
        }

        // Emit registry event
        this.registry.emit('WIDGET_MOVED', {
            slotId: this.slotId,
            widget,
            fromIndex,
            toIndex,
            widgets: [...this.widgets]
        });
    }

    handleEditWidget(widget, widgetIndex) {
        if (this.onWidgetEdit) {
            this.onWidgetEdit({
                ...widget,
                slotName: this.slotName,
                slotIndex: widgetIndex,
                parentWidgetId: this.parentWidgetId,
                context: {
                    slotName: this.slotName,
                    contextType: this.contextType,
                    mode: 'edit',
                    parentWidgetId: this.parentWidgetId
                }
            });
        }
    }

    /**
     * Update widgets from external source (UDC)
     */
    updateWidgets(newWidgets) {
        if (this.updateLock || this.isDestroyed) return;

        this.widgets = [...newWidgets];
        this.renderWidgets();
        this.updateSlotCount();
    }

    /**
     * Update slot count display
     */
    updateSlotCount() {
        if (this.slotCountElement && this.maxWidgets) {
            this.slotCountElement.textContent = `${this.widgets.length}/${this.maxWidgets} widgets`;
        }

        // Update add button availability
        if (this.addButtonElement) {
            this.addButtonElement.disabled = !this.canAddWidget();
            this.addButtonElement.style.opacity = this.canAddWidget() ? '1' : '0.5';
        }
    }

    /**
     * Get widget display name
     */
    getWidgetDisplayName(widgetType) {
        const widgetTypeDef = this.availableWidgetTypes.find(t => t.type === widgetType);
        return widgetTypeDef?.name || widgetType.split('.').pop() || widgetType;
    }

    /**
     * Get widget summary for preview
     */
    getWidgetSummary(widget) {
        if (widget.config?.content) {
            const textContent = widget.config.content.replace(/<[^>]*>/g, '').trim();
            return textContent.length > 60 ? textContent.substring(0, 60) + '...' : textContent;
        }
        if (widget.config?.title) {
            return widget.config.title;
        }
        if (widget.config?.mediaItems && widget.config.mediaItems.length > 0) {
            return `${widget.config.mediaItems.length} media item(s)`;
        }
        return 'No content configured';
    }

    /**
     * Lock updates to prevent feedback loops
     */
    lockUpdates() {
        this.updateLock = true;
        setTimeout(() => { this.updateLock = false; }, 100);
    }

    /**
     * Check if updates are locked
     */
    isUpdateLocked() {
        return this.updateLock;
    }

    /**
     * Get current widgets
     */
    getWidgets() {
        return [...this.widgets];
    }

    /**
     * Refresh the display
     */
    refresh() {
        if (this.isInitialized && !this.isDestroyed) {
            this.renderWidgets();
            this.updateSlotCount();
        }
    }

    /**
     * Destroy the slot editor
     */
    destroy() {
        if (this.isDestroyed) return;

        console.log(`Destroying slot editor: ${this.slotId}`);

        // Cleanup event listeners
        this.eventHandlers.forEach(cleanup => cleanup());
        this.eventHandlers = [];

        // Cleanup UDC subscription
        if (this.udcUnsubscribe) {
            this.udcUnsubscribe();
        }

        // Unregister from registry
        this.registry.unregister(this.slotId);

        // Clear DOM
        if (this.container) {
            this.container.innerHTML = '';
        }

        this.isDestroyed = true;
    }
}

// Export both the class and registry
export { SelfContainedSlotEditor, SlotRegistry };

// Create global registry instance
if (typeof window !== 'undefined') {
    window.slotRegistry = new SlotRegistry();
}
