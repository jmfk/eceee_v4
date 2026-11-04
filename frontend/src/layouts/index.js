/**
 * Layouts Main Export
 * 
 * Uses easy-layouts only. The default-layouts have been removed from the system.
 */

// Export everything from easy layouts
export * from './easy-layouts';

// Import easy layout registry
import { EASY_LAYOUT_REGISTRY } from './easy-layouts';

// Use EASY layouts as the main registry
export const LAYOUT_REGISTRY = EASY_LAYOUT_REGISTRY;

// Export easy layout components for easy access
export {
    MainLayout,
    LandingPage,
    WidgetSlot
} from './easy-layouts';
