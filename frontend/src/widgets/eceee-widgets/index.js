/**
 * ECEEE Widgets Package
 * 
 * ECEEE-specific widget implementations that mirror the backend eceee_widgets app.
 * These are NEW widgets with their own namespace (eceee_widgets.*), not overrides.
 */

// Import the registerWidget utility
import { registerWidget } from './registry';

// Import ECEEE-specific widgets
import eceeeFooterWidget from './eceeeFooterWidget';
import eceeeContentWidget from './eceeeContentWidget';
import eceeeImageWidget from './eceeeImageWidget';
import eceeeTableWidget from './eceeeTableWidget';
import eceeeHeaderWidget from './eceeeHeaderWidget';
import eceeeNavigationWidget from './eceeeNavigationWidget';
import eceeeSidebarWidget from './eceeeSidebarWidget';
import eceeeFormsWidget from './eceeeFormsWidget';
import eceeeTwoColumnsWidget from './eceeeTwoColumnsWidget';
import eceeeThreeColumnsWidget from './eceeeThreeColumnsWidget';
import eceeePathDebugWidget from './eceeePathDebugWidget';

/**
 * ECEEE Widget Registry
 * 
 * These are ECEEE-specific widgets with their own namespace (eceee_widgets.*)
 * They are separate from default widgets and don't override them.
 * 
 * Note: eceeeFooterWidget is registered with 'default_widgets.FooterWidget' to override it.
 */
export const ECEEE_WIDGET_REGISTRY = {
    // Override the default FooterWidget with ECEEE-specific implementation
    'default_widgets.FooterWidget': registerWidget(eceeeFooterWidget, 'default_widgets.FooterWidget'),

    // ECEEE-specific widgets (new widgets, not overrides)
    'eceee_widgets.ContentWidget': registerWidget(eceeeContentWidget, 'eceee_widgets.ContentWidget'),
    'eceee_widgets.ImageWidget': registerWidget(eceeeImageWidget, 'eceee_widgets.ImageWidget'),
    'eceee_widgets.TableWidget': registerWidget(eceeeTableWidget, 'eceee_widgets.TableWidget'),
    'eceee_widgets.HeaderWidget': registerWidget(eceeeHeaderWidget, 'eceee_widgets.HeaderWidget'),
    'eceee_widgets.NavigationWidget': registerWidget(eceeeNavigationWidget, 'eceee_widgets.NavigationWidget'),
    'eceee_widgets.SidebarWidget': registerWidget(eceeeSidebarWidget, 'eceee_widgets.SidebarWidget'),
    'eceee_widgets.FormsWidget': registerWidget(eceeeFormsWidget, 'eceee_widgets.FormsWidget'),
    'eceee_widgets.TwoColumnsWidget': registerWidget(eceeeTwoColumnsWidget, 'eceee_widgets.TwoColumnsWidget'),
    'eceee_widgets.ThreeColumnsWidget': registerWidget(eceeeThreeColumnsWidget, 'eceee_widgets.ThreeColumnsWidget'),
    'eceee_widgets.PathDebugWidget': registerWidget(eceeePathDebugWidget, 'eceee_widgets.PathDebugWidget'),
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
export { default as eceeeContentWidget } from './eceeeContentWidget';
export { default as eceeeImageWidget } from './eceeeImageWidget';
export { default as eceeeTableWidget } from './eceeeTableWidget';
export { default as eceeeHeaderWidget } from './eceeeHeaderWidget';
export { default as eceeeNavigationWidget } from './eceeeNavigationWidget';
export { default as eceeeSidebarWidget } from './eceeeSidebarWidget';
export { default as eceeeFormsWidget } from './eceeeFormsWidget';
export { default as eceeeTwoColumnsWidget } from './eceeeTwoColumnsWidget';
export { default as eceeeThreeColumnsWidget } from './eceeeThreeColumnsWidget';

// Export the registry for direct access
export default ECEEE_WIDGET_REGISTRY;
