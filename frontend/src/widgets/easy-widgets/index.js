/**
 * EASY Widgets Package
 * 
 * EASY-specific widget implementations that mirror the backend easy_widgets app.
 * These are NEW widgets with their own namespace (easy_widgets.*), not overrides.
 */

// Import the registerWidget utility
import { registerWidget } from './registry';

// Import ECEEE-specific widgets
import FooterWidget from './FooterWidget';
import ContentWidget from './ContentWidget';
import ContentCardWidget from './ContentCardWidget';
import BannerWidget from './BannerWidget';
import ImageWidget from './ImageWidget';
import TableWidget from './TableWidget';
import HeaderWidget from './HeaderWidget';
import HeroWidget from './HeroWidget';
import NavbarWidget from './NavbarWidget';
import NavigationWidget from './NavigationWidget';
import SidebarWidget from './SidebarWidget';
import FormsWidget from './FormsWidget';
import TwoColumnsWidget from './TwoColumnsWidget';
import ThreeColumnsWidget from './ThreeColumnsWidget';
import PathDebugWidget from './PathDebugWidget';
import NewsListWidget from './NewsListWidget';
import NewsDetailWidget from './NewsDetailWidget';
import TopNewsPlugWidget from './TopNewsPlugWidget';
import SidebarTopNewsWidget from './SidebarTopNewsWidget';
import SectionWidget from './SectionWidget';

/**
 * EASY Widget Registry
 * 
 * These are EASY-specific widgets with their own namespace (easy_widgets.*)
 * They are separate from default widgets and don't override them.
 */
export const EASY_WIDGET_REGISTRY = {
    // EASY-specific widgets (new widgets, not overrides)
    'easy_widgets.FooterWidget': registerWidget(FooterWidget, 'easy_widgets.FooterWidget'),
    'easy_widgets.ContentWidget': registerWidget(ContentWidget, 'easy_widgets.ContentWidget'),
    'easy_widgets.ContentCardWidget': registerWidget(ContentCardWidget, 'easy_widgets.ContentCardWidget'),
    'easy_widgets.BannerWidget': registerWidget(BannerWidget, 'easy_widgets.BannerWidget'),
    'easy_widgets.ImageWidget': registerWidget(ImageWidget, 'easy_widgets.ImageWidget'),
    'easy_widgets.TableWidget': registerWidget(TableWidget, 'easy_widgets.TableWidget'),
    'easy_widgets.HeaderWidget': registerWidget(HeaderWidget, 'easy_widgets.HeaderWidget'),
    'easy_widgets.HeroWidget': registerWidget(HeroWidget, 'easy_widgets.HeroWidget'),
    'easy_widgets.NavbarWidget': registerWidget(NavbarWidget, 'easy_widgets.NavbarWidget'),
    'easy_widgets.NavigationWidget': registerWidget(NavigationWidget, 'easy_widgets.NavigationWidget'),
    'easy_widgets.SidebarWidget': registerWidget(SidebarWidget, 'easy_widgets.SidebarWidget'),
    'easy_widgets.FormsWidget': registerWidget(FormsWidget, 'easy_widgets.FormsWidget'),
    'easy_widgets.TwoColumnsWidget': registerWidget(TwoColumnsWidget, 'easy_widgets.TwoColumnsWidget'),
    'easy_widgets.ThreeColumnsWidget': registerWidget(ThreeColumnsWidget, 'easy_widgets.ThreeColumnsWidget'),
    'easy_widgets.PathDebugWidget': registerWidget(PathDebugWidget, 'easy_widgets.PathDebugWidget'),
    'easy_widgets.NewsListWidget': registerWidget(NewsListWidget, 'easy_widgets.NewsListWidget'),
    'easy_widgets.NewsDetailWidget': registerWidget(NewsDetailWidget, 'easy_widgets.NewsDetailWidget'),
    'easy_widgets.TopNewsPlugWidget': registerWidget(TopNewsPlugWidget, 'easy_widgets.TopNewsPlugWidget'),
    'easy_widgets.SidebarTopNewsWidget': registerWidget(SidebarTopNewsWidget, 'easy_widgets.SidebarTopNewsWidget'),
    'easy_widgets.SectionWidget': registerWidget(SectionWidget, 'easy_widgets.SectionWidget'),
};

/**
 * Get EASY widget component by type
 * @param {string} widgetType - Widget type identifier
 * @returns {React.Component|null} Widget component or null if not found
 */
export const getEceeeWidgetComponent = (widgetType) => {
    return EASY_WIDGET_REGISTRY[widgetType]?.component || null;
};

/**
 * Get ECEEE widget metadata
 * @param {string} widgetType - Widget type identifier
 * @returns {Object} Widget metadata
 */
export const getEceeeWidgetMetadata = (widgetType) => {
    return EASY_WIDGET_REGISTRY[widgetType] || null;
};

/**
 * Get all available ECEEE widgets
 * @returns {Array} Array of widget metadata objects
 */
export const getAvailableEceeeWidgets = () => {
    return Object.values(EASY_WIDGET_REGISTRY);
};

/**
 * Get all ECEEE widget types
 * @returns {Array} Array of widget type strings
 */
export const getAvailableEceeeWidgetTypes = () => {
    return Object.keys(EASY_WIDGET_REGISTRY);
};

/**
 * Check if ECEEE widget type exists
 * @param {string} widgetType - Widget type identifier
 * @returns {boolean} True if exists
 */
export const isEceeeWidgetType = (widgetType) => {
    return widgetType in EASY_WIDGET_REGISTRY;
};

// Export individual widget components
export { default as FooterWidget } from './FooterWidget';
export { default as ContentWidget } from './ContentWidget';
export { default as ContentCardWidget } from './ContentCardWidget';
export { default as BannerWidget } from './BannerWidget';
export { default as ImageWidget } from './ImageWidget';
export { default as TableWidget } from './TableWidget';
export { default as HeaderWidget } from './HeaderWidget';
export { default as HeroWidget } from './HeroWidget';
export { default as NavbarWidget } from './NavbarWidget';
export { default as NavigationWidget } from './NavigationWidget';
export { default as SidebarWidget } from './SidebarWidget';
export { default as FormsWidget } from './FormsWidget';
export { default as TwoColumnsWidget } from './TwoColumnsWidget';
export { default as ThreeColumnsWidget } from './ThreeColumnsWidget';
export { default as NewsListWidget } from './NewsListWidget';
export { default as NewsDetailWidget } from './NewsDetailWidget';
export { default as TopNewsPlugWidget } from './TopNewsPlugWidget';
export { default as SidebarTopNewsWidget } from './SidebarTopNewsWidget';
export { default as PathDebugWidget } from './PathDebugWidget';
export { default as SectionWidget } from './SectionWidget';

// Export utility components
export { default as ContentWidgetEditorRenderer } from './ContentWidgetEditorRenderer';

// Export the registerWidget utility for custom widgets
export { registerWidget } from './registry';

// Export the registry for direct access
export default EASY_WIDGET_REGISTRY;
