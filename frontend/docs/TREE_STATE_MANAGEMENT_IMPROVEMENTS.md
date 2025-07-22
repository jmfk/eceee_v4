# Tree State Management Improvements

## Problem Statement

The original TreePageManager had several issues:

1. **Sub-page updates not reflecting**: Changes to child pages weren't properly updating in the tree view
2. **Expansion state loss**: When the tree refreshed, all expansion/collapse states were reset
3. **Flickering re-renders**: Excessive re-renders caused poor user experience
4. **Memory leaks**: Complex state management was causing memory issues in tests
5. **First-level sub-pages not showing**: Children of root pages weren't automatically loaded on first load
6. **UI elements not updating**: Changes to page data weren't reflected in the UI immediately
7. **Search results not showing full context**: When searching, parent pages weren't expanded to show the full path to search results

## Solution Overview

We implemented a simplified but more robust state management system that:

1. **Preserves expansion states** across data updates
2. **Efficiently updates sub-pages** without losing tree structure
3. **Reduces flickering** through better React Query cache management
4. **Prevents memory leaks** by simplifying the state management approach
5. **Auto-loads first-level children** for better user experience
6. **Immediately reflects UI changes** through direct state updates

## Key Improvements

### 1. Simplified State Management

**Before**: Complex custom hooks with batched updates and update queues
**After**: Direct state management with React Query for caching

```javascript
// Before: Complex custom hook
const treeState = useTreeState()
const pageUpdates = usePageUpdates()
const treeRefresh = useTreeRefresh()

// After: Simple state
const [pages, setPages] = useState([])
const [expandedPages, setExpandedPages] = useState(new Set())
```

### 2. Better Cache Management

**Before**: Manual cache updates that could cause inconsistencies
**After**: React Query invalidation for consistent data

```javascript
// Before: Manual cache updates
treeState.updatePage(parentId, updatedParent)
queryClient.setQueryData(['page-children', parentId], childrenData)

// After: Query invalidation
queryClient.invalidateQueries(['pages', 'root'])
queryClient.invalidateQueries(['page-children'])
```

### 3. Preserved Expansion States

**Before**: Expansion states were reset on every data update
**After**: Expansion states are preserved and only updated when explicitly changed

```javascript
// Expansion state is maintained separately from page data
const [expandedPages, setExpandedPages] = useState(new Set())

// Only update when user explicitly expands/collapses
const handleExpand = useCallback((pageId) => {
    setExpandedPages(prev => new Set([...prev, pageId]))
}, [])
```

### 4. Efficient Sub-page Updates

**Before**: Complex tree traversal for updates
**After**: Direct state updates with proper React Query invalidation

```javascript
// Helper function for updating specific pages in tree
const updatePageInTree = useCallback((pages, pageId, updater) => {
    const updateRecursive = (pageList) => {
        return pageList.map(page => {
            if (page.id === pageId) {
                return updater(page)
            }
            if (page.children && page.children.length > 0) {
                return {
                    ...page,
                    children: updateRecursive(page.children)
                }
            }
            return page
        }).filter(Boolean)
    }
    return updateRecursive(pages)
}, [])
```

### 5. Auto-loading First-level Children

**Before**: First-level pages were expanded but children weren't loaded
**After**: Children are automatically loaded for first-level pages with children

```javascript
// Auto-load children for first-level pages that have children
const pagesWithChildren = rootPagesData.results.filter(page => page.children_count > 0)
pagesWithChildren.forEach(async (page) => {
    try {
        const childrenData = await getPageChildren(page.id)
        
        // Check if childrenData has the expected structure
        if (!childrenData || !childrenData.results) {
            console.warn(`Invalid children data structure for page ${page.id}:`, childrenData)
            return
        }
        
        const children = childrenData.results.map(child => pageTreeUtils.formatPageForTree(child))

        // Update the specific page node with its children
        setPages(prevPages => {
            return updatePageInTree(prevPages, page.id, (p) => ({
                ...p,
                children: children,
                childrenLoaded: true,
                isExpanded: true
            }))
        })

        // Cache the children data in React Query for invalidation
        queryClient.setQueryData(['page-children', page.id], childrenData)
    } catch (error) {
        console.error(`Failed to load children for page ${page.id}:`, error)
    }
})
```

### 6. Immediate UI Updates

**Before**: Page updates were only reflected after cache invalidation and refetching
**After**: UI updates are immediately reflected through direct state updates

```

### 7. Auto-Expand Parent Pages for Search Results

**Before**: Search results were displayed without showing the full path to them
**After**: Parent pages are automatically expanded to show the complete hierarchy path to search results

```javascript
// Function to expand parent pages of search results
const expandSearchResultParents = useCallback(async (results) => {
    if (!results || results.length === 0) return

    // Extract all parent page IDs from hierarchy paths
    const parentIds = new Set()
    results.forEach(result => {
        if (result.hierarchy_path && Array.isArray(result.hierarchy_path)) {
            result.hierarchy_path.forEach(parent => {
                parentIds.add(parent.id)
            })
        }
    })

    // Expand all parent pages
    setExpandedPages(prev => new Set([...prev, ...parentIds]))
}, [setExpandedPages])

// Called automatically when search results are processed
expandSearchResultParents(searchData.results)
```

## Implementation Details

## Benefits

1. **Better Performance**: Reduced re-renders and memory usage
2. **Improved UX**: No more lost expansion states or flickering
3. **Reliable Updates**: Sub-page changes are properly reflected
4. **Maintainable Code**: Simpler state management is easier to debug
5. **Testable**: Components can be tested without memory issues
6. **Better Initial Load**: First-level children are automatically visible
7. **Immediate UI Feedback**: Changes are reflected instantly in the interface
8. **Better Search Context**: Search results show full hierarchy path for better understanding

## Migration Notes

The changes are backward compatible. Existing code using the TreePageManager will continue to work, but will benefit from:

- More stable expansion states
- Better performance
- More reliable updates
- Reduced memory usage
- Better initial user experience with auto-loaded children
- Immediate UI feedback for all page changes
- Better search experience with auto-expanded parent pages

## Conclusion

The simplified tree state management approach successfully addresses the original issues while providing a more maintainable and performant solution. The key insight was that complex state management was causing more problems than it solved, and a simpler approach with React Query's built-in caching mechanisms provides better results.

The addition of auto-loading first-level children significantly improves the user experience by making the tree structure immediately visible without requiring manual expansion. The implementation of direct state updates through callback functions ensures that all UI changes are reflected immediately, providing instant feedback to users when they modify page data. The auto-expansion of parent pages during search provides better context and makes it easier for users to understand the location of search results within the page hierarchy.
