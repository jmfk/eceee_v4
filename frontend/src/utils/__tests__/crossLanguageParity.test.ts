/**
 * Cross-Language Parity Tests
 * 
 * These tests compare TypeScript and Python implementations to ensure
 * they return identical results for the same input data.
 */

import testData from '../../../docs/inheritance-tree-test-data.json'
import { InheritanceTreeHelpers } from '../inheritanceTree'
import { 
    InheritanceTreeNode, 
    TreeWidget, 
    WidgetInheritanceBehavior 
} from '../../types/inheritanceTree'


describe('Cross-Language Parity Tests', () => {
    let testTree: InheritanceTreeNode
    
    beforeEach(() => {
        // Create tree from canonical test data
        testTree = createTreeFromTestData(testData.testCases.basic_hierarchy.pages)
    })
    
    test('getAllWidgets matches Python implementation', () => {
        const helpers = new InheritanceTreeHelpers(testTree)
        const result = helpers.getAllWidgets('main')
        const expected = testData.testCases.basic_hierarchy.expectedResults.pageId4_getAllWidgets_main
        
        expect(result).toHaveLength(expected.length)
        
        for (let i = 0; i < result.length; i++) {
            expect(result[i].id).toBe(expected[i].id)
            expect(result[i].depth).toBe(expected[i].depth)
            expect(result[i].isLocal).toBe(expected[i].isLocal)
            expect(result[i].isInherited).toBe(expected[i].isInherited)
        }
    })
    
    test('getInheritedWidgets matches Python implementation', () => {
        const helpers = new InheritanceTreeHelpers(testTree)
        const result = helpers.getInheritedWidgets('sidebar')
        const expected = testData.testCases.basic_hierarchy.expectedResults.pageId4_getInheritedWidgets_sidebar
        
        expect(result).toHaveLength(expected.length)
        
        for (let i = 0; i < result.length; i++) {
            expect(result[i].id).toBe(expected[i].id)
            expect(result[i].depth).toBe(expected[i].depth)
            expect(result[i].isInherited).toBe(expected[i].isInherited)
        }
    })
    
    test('getMergedWidgets behavior ordering matches Python', () => {
        const helpers = new InheritanceTreeHelpers(testTree)
        const result = helpers.getMergedWidgets('sidebar')
        const expected = testData.testCases.basic_hierarchy.expectedResults.pageId4_getMergedWidgets_sidebar
        
        expect(result).toHaveLength(expected.length)
        
        for (let i = 0; i < result.length; i++) {
            expect(result[i].id).toBe(expected[i].id)
            expect(result[i].depth).toBe(expected[i].depth)
            expect(result[i].order).toBe(expected[i].order)
        }
    })
    
    test('hasInheritedContent boolean checks match Python', () => {
        const helpers = new InheritanceTreeHelpers(testTree)
        
        const hasMain = helpers.hasInheritedContent('main')
        const expectedMain = testData.testCases.basic_hierarchy.expectedResults.pageId4_hasInheritedContent_main
        expect(hasMain).toBe(expectedMain)
        
        const hasFooter = helpers.hasInheritedContent('footer')
        const expectedFooter = testData.testCases.basic_hierarchy.expectedResults.pageId4_hasInheritedContent_footer
        expect(hasFooter).toBe(expectedFooter)
    })
    
    test('getWidgetsAtDepth filtering matches Python', () => {
        const helpers = new InheritanceTreeHelpers(testTree)
        const result = helpers.getWidgetsAtDepth(1)
        const expected = testData.testCases.basic_hierarchy.expectedResults.pageId4_getWidgetsAtDepth_1
        
        expect(result).toHaveLength(expected.length)
        
        // Sort both by ID for consistent comparison
        const sortedResult = result.sort((a, b) => a.id.localeCompare(b.id))
        const sortedExpected = expected.sort((a, b) => a.id.localeCompare(b.id))
        
        for (let i = 0; i < sortedResult.length; i++) {
            expect(sortedResult[i].id).toBe(sortedExpected[i].id)
            expect(sortedResult[i].depth).toBe(sortedExpected[i].depth)
        }
    })
    
    test('JSON serialization format matches between languages', () => {
        const helpers = new InheritanceTreeHelpers(testTree)
        
        // Create JSON representation (as would be sent by API)
        const serialized = serializeTreeForApi(testTree)
        
        // Verify structure matches expected format
        expect(serialized).toHaveProperty('pageId', 4)
        expect(serialized).toHaveProperty('depth', 0)
        expect(serialized).toHaveProperty('page')
        expect(serialized).toHaveProperty('slots')
        expect(serialized).toHaveProperty('parent')
        
        // Verify nested parent structure
        expect(serialized.parent).toHaveProperty('pageId', 2)
        expect(serialized.parent?.parent).toHaveProperty('pageId', 1)
        expect(serialized.parent?.parent?.parent).toBeNull()
        
        // Verify widget structure
        const mainWidgets = serialized.slots.main
        expect(Array.isArray(mainWidgets)).toBe(true)
        
        if (mainWidgets.length > 0) {
            const widget = mainWidgets[0]
            expect(widget).toHaveProperty('id')
            expect(widget).toHaveProperty('type')
            expect(widget).toHaveProperty('config')
            expect(widget).toHaveProperty('depth')
            expect(widget).toHaveProperty('inheritanceBehavior')
            expect(widget).toHaveProperty('isLocal')
            expect(widget).toHaveProperty('isInherited')
        }
    })
})


// Helper function to create tree from test data
function createTreeFromTestData(pagesData: any): InheritanceTreeNode {
    // Convert test data to tree structure (simplified for testing)
    const pages = pagesData
    
    const buildNode = (pageId: string, depth: number): InheritanceTreeNode => {
        const pageData = pages[pageId]
        
        const slots: Record<string, TreeWidget[]> = {}
        
        Object.entries(pageData.widgets).forEach(([slotName, widgets]: [string, any[]]) => {
            slots[slotName] = widgets.map(w => ({
                id: w.id,
                type: w.type,
                config: w.config,
                order: w.order || 0,
                depth,
                inheritanceBehavior: w.inheritanceBehavior as WidgetInheritanceBehavior,
                isPublished: w.isPublished,
                inheritanceLevel: w.inheritanceLevel,
                isLocal: depth === 0,
                isInherited: depth > 0,
                canBeOverridden: true
            }))
        })
        
        // Build parent recursively
        const parentId = pageData.parent_id?.toString()
        const parent = parentId ? buildNode(parentId, depth + 1) : null
        
        return {
            pageId: parseInt(pageId),
            depth,
            page: {
                id: parseInt(pageId),
                title: pageData.title,
                slug: pageData.slug,
                parent_id: pageData.parent_id
            },
            slots,
            parent
        }
    }
    
    return buildNode('4', 0) // Build tree for History page (ID 4)
}


// Helper function to serialize tree for API compatibility testing
function serializeTreeForApi(tree: InheritanceTreeNode): any {
    return {
        pageId: tree.pageId,
        depth: tree.depth,
        page: {
            id: tree.page.id,
            title: tree.page.title,
            slug: tree.page.slug,
            parentId: tree.page.parent_id
        },
        slots: Object.fromEntries(
            Object.entries(tree.slots).map(([slotName, widgets]) => [
                slotName,
                widgets.map(w => ({
                    id: w.id,
                    type: w.type,
                    config: w.config,
                    order: w.order,
                    depth: w.depth,
                    inheritanceBehavior: w.inheritanceBehavior,
                    isPublished: w.isPublished,
                    inheritanceLevel: w.inheritanceLevel,
                    isLocal: w.isLocal,
                    isInherited: w.isInherited,
                    canBeOverridden: w.canBeOverridden
                }))
            ])
        ),
        parent: tree.parent ? serializeTreeForApi(tree.parent) : null
    }
}
