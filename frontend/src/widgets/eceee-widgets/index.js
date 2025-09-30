/**
 * ECEEE Widgets Package
 * 
 * ECEEE-specific widget implementations that mirror the backend eceee_widgets app.
 * This package can override default widgets by registering widgets with the same widget type.
 */

// Import the registerWidget utility from default-widgets
import { registerWidget } from '../default-widgets/registry';

// Import ECEEE-specific widgets
import eceeeFooterWidget from './eceeeFooterWidget';

/**
 * ECEEE Widget Registry
 * 
 * This registry can override default widgets by using the same widget type.
 * For example, to override the default FooterWidget:
 * 
 * 'core_widgets.FooterWidget': registerWidget(eceeeFooterWidget, 'core_widgets.FooterWidget')
 * 
 * This will replace the default FooterWidget with the ECEEE-specific implementation.
 */
export const ECEEE_WIDGET_REGISTRY = {
    // Override the default FooterWidget with ECEEE-specific implementation
    'core_widgets.FooterWidget': registerWidget(eceeeFooterWidget, 'core_widgets.FooterWidget'),

    // Example of how to add a new ECEEE-specific widget:
    // 'eceee_widgets.BlogPostWidget': registerWidget(BlogPostWidget, 'eceee_widgets.BlogPostWidget'),

    // Future ECEEE-specific widgets will be registered here
};

/**
 * Get ECEEE widget component by type
 * @param {string} widgetType - Widget type identifier
 * @returns {React.Component|null} Widget component or null if not found
 */
export const getEceeeWidgetComponent = (widgetType) => {
    return ECEEE_WIDGET_REGISTRY[widgetType]?.component || null;
};

/**
 * Get ECEEE widget metadata
 * @param {string} widgetType - Widget type identifier
 * @returns {Object} Widget metadata
 */
export const getEceeeWidgetMetadata = (widgetType) => {
    return ECEEE_WIDGET_REGISTRY[widgetType] || null;
};

/**
 * Get all available ECEEE widgets
 * @returns {Array} Array of widget metadata objects
 */
export const getAvailableEceeeWidgets = () => {
    return Object.values(ECEEE_WIDGET_REGISTRY);
};

/**
 * Get all ECEEE widget types
 * @returns {Array} Array of widget type strings
 */
export const getAvailableEceeeWidgetTypes = () => {
    return Object.keys(ECEEE_WIDGET_REGISTRY);
};

/**
 * Check if ECEEE widget type exists
 * @param {string} widgetType - Widget type identifier
 * @returns {boolean} True if exists
 */
export const isEceeeWidgetType = (widgetType) => {
    return widgetType in ECEEE_WIDGET_REGISTRY;
};

// Export individual widget components
export { default as eceeeFooterWidget } from './eceeeFooterWidget';

// Export the registry for direct access
export default ECEEE_WIDGET_REGISTRY;
