/**
 * Widget Override System Tests
 * 
 * Tests to verify that the widget override system works correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WidgetRegistryManager } from '../WidgetRegistryManager';
import { CORE_WIDGET_REGISTRY } from '../default-widgets/registry';
import { ECEEE_WIDGET_REGISTRY } from '../eceee-widgets';

describe('Widget Override System', () => {
    let manager;

    beforeEach(() => {
        manager = new WidgetRegistryManager();
        manager.registerRegistry(CORE_WIDGET_REGISTRY, manager.priorities.DEFAULT, 'default-widgets');
        manager.registerRegistry(ECEEE_WIDGET_REGISTRY, manager.priorities.ECEEE, 'eceee-widgets');
    });

    it('should register registries with correct priorities', () => {
        const registryInfo = manager.getRegistryInfo();

        expect(registryInfo).toHaveLength(2);
        expect(registryInfo.find(r => r.name === 'default-widgets')).toBeTruthy();
        expect(registryInfo.find(r => r.name === 'eceee-widgets')).toBeTruthy();
    });

    it('should return ECEEE widget when overriding default widget', () => {
        // Test that FooterWidget is overridden by ECEEE implementation
        const footerComponent = manager.getWidgetComponent('core_widgets.FooterWidget');

        expect(footerComponent).toBeTruthy();
        expect(footerComponent.displayName).toBe('eceeeFooterWidget');
    });

    it('should return default widget when no override exists', () => {
        // Test that ContentWidget still comes from default registry
        const contentComponent = manager.getWidgetComponent('core_widgets.ContentWidget');

        expect(contentComponent).toBeTruthy();
        expect(contentComponent.displayName).toBe('ContentWidget');
    });

    it('should return null for non-existent widget types', () => {
        const nonExistentComponent = manager.getWidgetComponent('non_existent.Widget');

        expect(nonExistentComponent).toBeNull();
    });

    it('should get widget metadata with priority resolution', () => {
        // Test ECEEE override metadata
        const footerMetadata = manager.getWidgetMetadata('core_widgets.FooterWidget');

        expect(footerMetadata).toBeTruthy();
        expect(footerMetadata.metadata.name).toBe('ECEEE Footer');

        // Test default widget metadata
        const contentMetadata = manager.getWidgetMetadata('core_widgets.ContentWidget');

        expect(contentMetadata).toBeTruthy();
        expect(contentMetadata.metadata.name).toBe('Content');
    });

    it('should get widget default config with priority resolution', () => {
        const footerConfig = manager.getWidgetDefaultConfig('core_widgets.FooterWidget');

        expect(footerConfig).toBeTruthy();
        expect(footerConfig.companyName).toBe('ECEEE');
        expect(footerConfig.tagline).toBe('European Council for an Energy Efficient Economy');
    });

    it('should check widget type support correctly', () => {
        expect(manager.isWidgetTypeSupported('core_widgets.FooterWidget')).toBe(true);
        expect(manager.isWidgetTypeSupported('core_widgets.ContentWidget')).toBe(true);
        expect(manager.isWidgetTypeSupported('non_existent.Widget')).toBe(false);
    });

    it('should get all available widget types', () => {
        const availableTypes = manager.getAvailableWidgetTypes();

        expect(availableTypes).toContain('core_widgets.FooterWidget');
        expect(availableTypes).toContain('core_widgets.ContentWidget');
        expect(availableTypes).toContain('core_widgets.ImageWidget');
    });

    it('should search widgets across all registries', () => {
        const searchResults = manager.searchWidgets('footer');

        expect(searchResults).toContain('core_widgets.FooterWidget');

        const eceeeResults = manager.searchWidgets('ECEEE');
        expect(eceeeResults).toContain('core_widgets.FooterWidget');
    });

    it('should filter widgets by category', () => {
        const layoutWidgets = manager.filterWidgetsByCategory('layout');

        // ECEEE Footer should be in layout category
        expect(layoutWidgets).toContain('core_widgets.FooterWidget');
    });

    it('should get available categories from all registries', () => {
        const categories = manager.getAvailableCategories();

        expect(categories).toContain('layout');
        expect(categories).toContain('content');
    });

    it('should handle widget display names correctly', () => {
        // Test with widget type string
        const footerDisplayName = manager.getWidgetDisplayName('core_widgets.FooterWidget');
        expect(footerDisplayName).toBe('ECEEE Footer');

        const contentDisplayName = manager.getWidgetDisplayName('core_widgets.ContentWidget');
        expect(contentDisplayName).toBe('Content');

        // Test with widget data object
        const widgetData = { name: 'Custom Widget', type: 'custom.Widget' };
        const customDisplayName = manager.getWidgetDisplayName(widgetData);
        expect(customDisplayName).toBe('Custom Widget');
    });

    it('should maintain registry priority order', () => {
        // Create a new manager and register in different order
        const newManager = new WidgetRegistryManager();

        // Register ECEEE first, then default (reverse order)
        newManager.registerRegistry(ECEEE_WIDGET_REGISTRY, newManager.priorities.ECEEE, 'eceee-widgets');
        newManager.registerRegistry(CORE_WIDGET_REGISTRY, newManager.priorities.DEFAULT, 'default-widgets');

        // Should still return ECEEE widget due to higher priority
        const footerComponent = newManager.getWidgetComponent('core_widgets.FooterWidget');
        expect(footerComponent.displayName).toBe('eceeeFooterWidget');
    });
});
