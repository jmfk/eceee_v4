# Widget Inheritance Tree - Canonical Test Cases

## Overview

These test cases define the expected behavior for widget inheritance tree implementations in both Python and TypeScript. Both implementations must pass identical tests and return identical results.

## Test Data Structure

### Sample Page Hierarchy
```
Home (id: 1, depth: 2)
├── header: [HeaderWidget]
├── sidebar: [HomeNavigationWidget] 
└── About (id: 2, depth: 1)
    ├── main: [AboutContentWidget]
    ├── sidebar: [AboutNavigationWidget] (override_parent)
    └── History (id: 4, depth: 0) 
        ├── main: [HistoryContentWidget] (insert_after_parent)
        └── sidebar: [HistorySidebarWidget] (insert_before_parent)
```

### Widget Test Data
```json
{
  "pages": {
    "1": {
      "id": 1,
      "title": "Home", 
      "slug": "home",
      "parent_id": null,
      "widgets": {
        "header": [
          {
            "id": "home-header-1",
            "type": "HeaderWidget", 
            "config": {"title": "Site Header"},
            "inheritanceBehavior": "insert_after_parent",
            "isPublished": true,
            "inheritanceLevel": -1,
            "order": 0
          }
        ],
        "sidebar": [
          {
            "id": "home-nav-1", 
            "type": "NavigationWidget",
            "config": {"menu": ["Home", "About"]},
            "inheritanceBehavior": "insert_after_parent",
            "isPublished": true,
            "inheritanceLevel": 1,
            "order": 0
          }
        ]
      }
    },
    "2": {
      "id": 2,
      "title": "About",
      "slug": "about", 
      "parent_id": 1,
      "widgets": {
        "main": [
          {
            "id": "about-content-1",
            "type": "ContentWidget",
            "config": {"content": "About content"},
            "inheritanceBehavior": "insert_after_parent", 
            "isPublished": true,
            "inheritanceLevel": -1,
            "order": 0
          }
        ],
        "sidebar": [
          {
            "id": "about-nav-1",
            "type": "NavigationWidget", 
            "config": {"menu": ["About", "History"]},
            "inheritanceBehavior": "override_parent",
            "isPublished": true,
            "inheritanceLevel": -1,
            "order": 0
          }
        ]
      }
    },
    "4": {
      "id": 4,
      "title": "History",
      "slug": "history",
      "parent_id": 2,
      "widgets": {
        "main": [
          {
            "id": "history-content-1",
            "type": "ContentWidget",
            "config": {"content": "History content"},
            "inheritanceBehavior": "insert_after_parent",
            "isPublished": true, 
            "inheritanceLevel": -1,
            "order": 0
          }
        ],
        "sidebar": [
          {
            "id": "history-sidebar-1",
            "type": "ContentWidget",
            "config": {"content": "History sidebar"}, 
            "inheritanceBehavior": "insert_before_parent",
            "isPublished": true,
            "inheritanceLevel": -1,
            "order": 0
          }
        ]
      }
    }
  }
}
```

## Test Cases

### Test Group 1: Basic Tree Structure

#### Test 1.1: Tree Generation
**Input**: Page ID 4 (History)
**Expected Tree Structure**:
- Root: History (depth=0) with 1 main widget, 1 sidebar widget
- Parent: About (depth=1) with 1 main widget, 1 sidebar widget  
- Grandparent: Home (depth=2) with 1 header widget, 1 sidebar widget

#### Test 1.2: Depth Calculation  
**Function**: `getWidgetsAtDepth(1)`
**Expected Result**: [about-content-1, about-nav-1] (2 widgets from About page)

#### Test 1.3: Root Finding
**Function**: `getRoot()`
**Expected Result**: Home page node (id=1, depth=2)

### Test Group 2: Widget Filtering

#### Test 2.1: Get All Widgets in Slot
**Function**: `getAllWidgets('sidebar')`
**Expected Result**: [history-sidebar-1, about-nav-1] (History's + About's, NO Home nav due to override)

#### Test 2.2: Get Inherited Only
**Function**: `getInheritedWidgets('sidebar')`  
**Expected Result**: [about-nav-1] (only inherited widgets, depth > 0)

#### Test 2.3: Get Local Only
**Function**: `getLocalWidgets('main')`
**Expected Result**: [history-content-1] (only depth=0 widgets)

### Test Group 3: Inheritance Behavior

#### Test 3.1: Override Parent Behavior
**Function**: `getMergedWidgets('sidebar')`
**Expected Result**: [history-sidebar-1, about-nav-1]
**Logic**: History widget is insert_before_parent, About widget overrides Home widget

#### Test 3.2: Insert After Parent
**Function**: `getMergedWidgets('main')`  
**Expected Result**: [about-content-1, history-content-1]
**Logic**: History content appends after About content (insert_after_parent)

#### Test 3.3: Insert Before Parent
**Setup**: Change History sidebar to insert_before_parent
**Function**: `getMergedWidgets('sidebar')`
**Expected Result**: [history-sidebar-1, about-nav-1]
**Logic**: History widget appears before About widget

### Test Group 4: Publishing & Inheritance Level

#### Test 4.1: Published Filter
**Setup**: Set about-content-1.isPublished = false
**Function**: `getAllWidgets('main')`
**Expected Result**: [history-content-1] (unpublished widget filtered out)

#### Test 4.2: Inheritance Level Limiting
**Setup**: Set home-nav-1.inheritanceLevel = 1 (only inherits 1 level deep)
**Function**: `getInheritedWidgets('sidebar')` from History page
**Expected Result**: [about-nav-1] (Home nav excluded - beyond inheritance level)

#### Test 4.3: Page-Only Widgets
**Setup**: Set history-content-1.inheritanceLevel = 0 (page only)
**Function**: `getInheritedWidgets('main')` from hypothetical child page
**Expected Result**: [] (history content not inherited to children)

### Test Group 5: Type-Based Queries

#### Test 5.1: Filter by Widget Type
**Function**: `getWidgetsByType('ContentWidget')`
**Expected Result**: [history-content-1, about-content-1]

#### Test 5.2: Filter by Type in Slot
**Function**: `getWidgetsByType('NavigationWidget', 'sidebar')`
**Expected Result**: [about-nav-1] (Home nav excluded due to About override)

#### Test 5.3: Widget Not Found
**Function**: `getWidgetsByType('NonexistentWidget')`
**Expected Result**: []

### Test Group 6: Advanced Queries

#### Test 6.1: Find Specific Widget
**Function**: `findWidget('about-content-1')`
**Expected Result**: Widget object with id="about-content-1"

#### Test 6.2: Find Widget Not in Tree
**Function**: `findWidget('nonexistent-id')`
**Expected Result**: null

#### Test 6.3: Traverse Up with Predicate
**Function**: `traverseUp(node => node.page.slug === 'home')`
**Expected Result**: Home page tree node

### Test Group 7: Edge Cases

#### Test 7.1: Empty Slot
**Function**: `getAllWidgets('footer')`
**Expected Result**: [] (no widgets in footer across all levels)

#### Test 7.2: Single Page (No Parents)
**Setup**: Test with Home page (no parents)
**Function**: `getInheritedWidgets('header')`
**Expected Result**: [] (no parents to inherit from)

#### Test 7.3: Deep Hierarchy (5+ levels)
**Setup**: Create 5-level deep hierarchy
**Function**: `getWidgetsAtDepth(4)`
**Expected Result**: Widgets from 5th level only

#### Test 7.4: Circular Reference Protection
**Setup**: Attempt to create circular parent reference  
**Expected**: InheritanceTreeError with code 'CIRCULAR_REFERENCE'

### Test Group 8: Content Checks

#### Test 8.1: Has Inherited Content
**Function**: `hasInheritedContent('sidebar')`  
**Expected Result**: true (about-nav-1 is inherited)

#### Test 8.2: Has Local Content
**Function**: `hasLocalContent('main')`
**Expected Result**: true (history-content-1 is local)

#### Test 8.3: Empty Slot Content Check
**Function**: `hasInheritedContent('footer')`
**Expected Result**: false (no widgets in footer)

## Performance Test Cases

### Performance 1: Tree Generation Speed
**Requirement**: Build tree for 5-level hierarchy in <50ms (backend) / <100ms (frontend)

### Performance 2: Helper Function Speed  
**Requirement**: Simple queries (<1ms), Complex queries (<10ms)

### Performance 3: Memory Usage
**Requirement**: Tree size <10MB for reasonable hierarchy depth

## Cross-Language Parity Tests

### Parity Test 1: Identical Results
For each test case above:
1. Generate tree using Python implementation
2. Convert to JSON  
3. Generate tree using TypeScript implementation
4. Convert to JSON
5. Assert JSON structures are byte-for-byte identical

### Parity Test 2: Helper Function Outputs
For each helper function:
1. Call Python version with test data
2. Call TypeScript version with same test data  
3. Assert outputs are identical (accounting for language-specific formatting)

### Parity Test 3: Error Handling
For each error scenario:
1. Trigger error in Python implementation
2. Trigger same error in TypeScript implementation
3. Assert error codes and messages match

These test cases ensure both implementations behave identically and handle all edge cases consistently! 🎯
