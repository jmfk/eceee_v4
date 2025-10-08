/**
 * Tests for Widget Inheritance Tree Implementation
 * 
 * These tests verify that the TypeScript inheritance tree implementation
 * behaves correctly and matches the canonical test cases.
 */

import { 
    InheritanceTreeNode, 
    TreeWidget, 
    WidgetInheritanceBehavior,
    TreePageData
} from '../../types/inheritanceTree'
import { InheritanceTreeHelpers } from '../inheritanceTree'


describe('InheritanceTreeHelpers', () => {
    let testTree: InheritanceTreeNode
    let helpers: InheritanceTreeHelpers
    
    beforeEach(() => {
        // Create test tree structure: Home -> About -> History
        const homeNode: InheritanceTreeNode = {
            pageId: 1,
            depth: 2,
            page: {
                id: 1,
                title: 'Home',
                slug: 'home',
                parent_id: null
            },
            slots: {
                header: [
                    {
                        id: 'home-header-1',
                        type: 'HeaderWidget',
                        config: { title: 'Site Header' },
                        order: 0,
                        depth: 2,
                        inheritanceBehavior: WidgetInheritanceBehavior.INSERT_AFTER_PARENT,
                        isPublished: true,
                        inheritanceLevel: -1,
                        isLocal: false,
                        isInherited: true,
                        canBeOverridden: true
                    }
                ],
                sidebar: [
                    {
                        id: 'home-nav-1',
                        type: 'NavigationWidget', 
                        config: { menu: ['Home', 'About'] },
                        order: 0,
                        depth: 2,
                        inheritanceBehavior: WidgetInheritanceBehavior.INSERT_AFTER_PARENT,
                        isPublished: true,
                        inheritanceLevel: 1, // Only inherits 1 level deep
                        isLocal: false,
                        isInherited: true,
                        canBeOverridden: true
                    }
                ],
                main: [],
                footer: []
            },
            parent: null
        }
        
        const aboutNode: InheritanceTreeNode = {
            pageId: 2,
            depth: 1,
            page: {
                id: 2,
                title: 'About',
                slug: 'about', 
                parent_id: 1
            },
            slots: {
                main: [
                    {
                        id: 'about-content-1',
                        type: 'ContentWidget',
                        config: { content: 'About page content' },
                        order: 0,
                        depth: 1,
                        inheritanceBehavior: WidgetInheritanceBehavior.INSERT_AFTER_PARENT,
                        isPublished: true,
                        inheritanceLevel: -1,
                        isLocal: false,
                        isInherited: true,
                        canBeOverridden: true
                    }
                ],
                sidebar: [
                    {
                        id: 'about-nav-1',
                        type: 'NavigationWidget',
                        config: { menu: ['About', 'History'] },
                        order: 0,
                        depth: 1,
                        inheritanceBehavior: WidgetInheritanceBehavior.OVERRIDE_PARENT,
                        isPublished: true,
                        inheritanceLevel: -1,
                        isLocal: false,
                        isInherited: true,
                        canBeOverridden: true
                    }
                ],
                header: [],
                footer: []
            },
            parent: homeNode
        }
        
        testTree = {
            pageId: 4,
            depth: 0,
            page: {
                id: 4,
                title: 'History',
                slug: 'history',
                parent_id: 2
            },
            slots: {
                main: [
                    {
                        id: 'history-content-1',
                        type: 'ContentWidget',
                        config: { content: 'History page content' },
                        order: 0,
                        depth: 0,
                        inheritanceBehavior: WidgetInheritanceBehavior.INSERT_AFTER_PARENT,
                        isPublished: true,
                        inheritanceLevel: -1,
                        isLocal: true,
                        isInherited: false,
                        canBeOverridden: true
                    }
                ],
                sidebar: [
                    {
                        id: 'history-sidebar-1',
                        type: 'ContentWidget',
                        config: { content: 'History sidebar' },
                        order: 0,
                        depth: 0,
                        inheritanceBehavior: WidgetInheritanceBehavior.INSERT_BEFORE_PARENT,
                        isPublished: true,
                        inheritanceLevel: -1,
                        isLocal: true,
                        isInherited: false,
                        canBeOverridden: true
                    }
                ],
                header: [],
                footer: []
            },
            parent: aboutNode
        }
        
        helpers = new InheritanceTreeHelpers(testTree)
    })
    
    describe('Core Query Functions', () => {
        test('getAllWidgets returns all widgets in slot from all levels', () => {
            const mainWidgets = helpers.getAllWidgets('main')
            
            expect(mainWidgets).toHaveLength(2)
            expect(mainWidgets[0].id).toBe('history-content-1') // depth 0 first
            expect(mainWidgets[0].depth).toBe(0)
            expect(mainWidgets[0].isLocal).toBe(true)
            
            expect(mainWidgets[1].id).toBe('about-content-1') // depth 1 second  
            expect(mainWidgets[1].depth).toBe(1)
            expect(mainWidgets[1].isInherited).toBe(true)
        })
        
        test('getInheritedWidgets returns only inherited widgets', () => {
            const inherited = helpers.getInheritedWidgets('sidebar')
            
            expect(inherited).toHaveLength(1)
            expect(inherited[0].id).toBe('about-nav-1')
            expect(inherited[0].depth).toBe(1)
            expect(inherited[0].isInherited).toBe(true)
        })
        
        test('getLocalWidgets returns only current page widgets', () => {
            const local = helpers.getLocalWidgets('main')
            
            expect(local).toHaveLength(1)
            expect(local[0].id).toBe('history-content-1')
            expect(local[0].depth).toBe(0)
            expect(local[0].isLocal).toBe(true)
        })
        
        test('getWidgetsAtDepth filters by inheritance depth', () => {
            const depthOne = helpers.getWidgetsAtDepth(1)
            
            expect(depthOne).toHaveLength(2) // About main + About sidebar
            expect(depthOne.map(w => w.id)).toEqual(['about-content-1', 'about-nav-1'])
        })
    })
    
    describe('Inheritance Behavior', () => {
        test('getMergedWidgets applies override_parent behavior', () => {
            // About nav has override_parent, should hide Home nav
            const merged = helpers.getMergedWidgets('sidebar')
            
            expect(merged).toHaveLength(2)
            expect(merged[0].id).toBe('history-sidebar-1') // insert_before_parent
            expect(merged[1].id).toBe('about-nav-1')       // override_parent (replaces Home nav)
            
            // Home nav should be excluded due to About's override
            expect(merged.map(w => w.id)).not.toContain('home-nav-1')
        })
        
        test('getMergedWidgets applies insert_before_parent behavior', () => {
            const merged = helpers.getMergedWidgets('main')
            
            expect(merged).toHaveLength(2)
            // Both have insert_after_parent, so order by depth
            expect(merged[0].id).toBe('about-content-1')   // depth 1 first
            expect(merged[1].id).toBe('history-content-1') // depth 0 second
        })
    })
    
    describe('Content Checks', () => {
        test('hasInheritedContent detects inherited widgets', () => {
            expect(helpers.hasInheritedContent('main')).toBe(true)     // About content
            expect(helpers.hasInheritedContent('sidebar')).toBe(true)  // About nav  
            expect(helpers.hasInheritedContent('footer')).toBe(false)  // Empty
        })
        
        test('hasLocalContent detects local widgets', () => {
            expect(helpers.hasLocalContent('main')).toBe(true)         // History content
            expect(helpers.hasLocalContent('sidebar')).toBe(true)      // History sidebar
            expect(helpers.hasLocalContent('header')).toBe(false)      // No local header
        })
    })
    
    describe('Advanced Queries', () => {
        test('findWidget locates widget by ID', () => {
            const widget = helpers.findWidget('about-content-1')
            
            expect(widget).not.toBeNull()
            expect(widget?.id).toBe('about-content-1')
            expect(widget?.type).toBe('ContentWidget')
            expect(widget?.depth).toBe(1)
            
            // Non-existent widget
            const missing = helpers.findWidget('nonexistent-id')
            expect(missing).toBeNull()
        })
        
        test('getWidgetsByType filters by widget type', () => {
            const contentWidgets = helpers.getWidgetsByType('ContentWidget')
            
            expect(contentWidgets).toHaveLength(3) // History main, About main, History sidebar
            expect(contentWidgets.map(w => w.id)).toEqual([
                'about-content-1',     // depth 1, order 0
                'history-content-1',   // depth 0, order 0  
                'history-sidebar-1'    // depth 0, order 0
            ])
        })
        
        test('getWidgetsByBehavior filters by inheritance behavior', () => {
            const overrideWidgets = helpers.getWidgetsByBehavior(WidgetInheritanceBehavior.OVERRIDE_PARENT)
            
            expect(overrideWidgets).toHaveLength(1)
            expect(overrideWidgets[0].id).toBe('about-nav-1')
        })
    })
    
    describe('Tree Navigation', () => {
        test('getRoot finds deepest ancestor', () => {
            const root = helpers.getRoot()
            
            expect(root.pageId).toBe(1)
            expect(root.page.slug).toBe('home')
            expect(root.parent).toBeNull()
        })
        
        test('getAncestors returns parent chain', () => {
            const ancestors = helpers.getAncestors()
            
            expect(ancestors).toHaveLength(2)
            expect(ancestors[0].pageId).toBe(2) // About (immediate parent)
            expect(ancestors[1].pageId).toBe(1) // Home (grandparent)
        })
        
        test('traverseUp finds node by predicate', () => {
            const aboutNode = helpers.traverseUp(node => node.page.slug === 'about')
            
            expect(aboutNode).not.toBeNull()
            expect(aboutNode?.pageId).toBe(2)
            expect(aboutNode?.page.title).toBe('About')
            
            // Non-existent node
            const missing = helpers.traverseUp(node => node.page.slug === 'nonexistent')
            expect(missing).toBeNull()
        })
    })
    
    describe('Performance', () => {
        test('helper functions execute quickly', () => {
            // Simple query should be under 1ms
            const start = performance.now()
            helpers.getAllWidgets('main')
            const time = performance.now() - start
            
            expect(time).toBeLessThan(1)
        })
        
        test('complex query should be under 10ms', () => {
            const start = performance.now()
            helpers.analyzeInheritance()
            const time = performance.now() - start
            
            expect(time).toBeLessThan(10)
        })
    })
})
