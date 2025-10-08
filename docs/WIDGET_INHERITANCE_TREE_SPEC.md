# Widget Inheritance Tree Specification

## Overview

The Widget Inheritance Tree provides a unified data structure and API for widget inheritance across both backend (Python) and frontend (TypeScript). This specification defines the exact data format, helper functions, and behaviors that must be implemented identically in both environments.

## Tree Data Structure

### Core Tree Node

```json
{
  "pageId": 4,
  "depth": 0,
  "page": {
    "id": 4,
    "title": "History",
    "slug": "history",
    "parent_id": 2
  },
  "slots": {
    "main": [
      {
        "id": "widget-123",
        "type": "eceee_widgets.ContentWidget",
        "config": {
          "content": "<h2>Page Content</h2>"
        },
        "depth": 0,
        "inheritanceBehavior": "insert_after_parent",
        "isPublished": true,
        "inheritanceLevel": -1,
        "order": 0
      }
    ],
    "sidebar": [],
    "header": [],
    "footer": []
  },
  "parent": {
    "pageId": 2,
    "depth": 1,
    "page": {
      "id": 2,
      "title": "About", 
      "slug": "about",
      "parent_id": 1
    },
    "slots": {
      "main": [],
      "sidebar": [
        {
          "id": "widget-456",
          "type": "eceee_widgets.NavigationWidget",
          "config": {
            "menu_items": [...]
          },
          "depth": 1,
          "inheritanceBehavior": "insert_after_parent",
          "isPublished": true,
          "inheritanceLevel": -1,
          "order": 0
        }
      ],
      "header": [],
      "footer": []
    },
    "parent": {
      "pageId": 1,
      "depth": 2,
      "page": {
        "id": 1,
        "title": "Home",
        "slug": "home", 
        "parent_id": null
      },
      "slots": {
        "main": [],
        "sidebar": [],
        "header": [
          {
            "id": "widget-789",
            "type": "eceee_widgets.HeaderWidget",
            "config": {
              "image": {...}
            },
            "depth": 2,
            "inheritanceBehavior": "insert_after_parent",
            "isPublished": true,
            "inheritanceLevel": -1,
            "order": 0
          }
        ],
        "footer": []
      },
      "parent": null
    }
  }
}
```

### Widget Data Structure

Each widget in the tree contains:

```typescript
interface TreeWidget {
  // Core widget data
  id: string                                    // Unique widget identifier
  type: string                                  // Widget type (e.g., "eceee_widgets.ContentWidget")
  config: Record<string, any>                   // Widget configuration object
  order: number                                 // Sort order within slot

  // Inheritance metadata
  depth: number                                 // Distance from current page (0 = current, 1 = parent, etc.)
  inheritanceBehavior: WidgetInheritanceBehavior // How widget behaves with parents
  isPublished: boolean                          // Publication status
  inheritanceLevel: number                      // How deep this widget can be inherited (-1 = infinite)
  
  // Optional publishing fields
  publishEffectiveDate?: string                 // When widget becomes visible
  publishExpireDate?: string                    // When widget expires
  
  // Computed fields (added during tree building)
  isLocal: boolean                              // True if depth === 0
  isInherited: boolean                          // True if depth > 0
  canBeOverridden: boolean                      // True if inheritance allows replacement
}
```

### Page Metadata Structure

```typescript
interface TreePageData {
  id: number                    // Page ID
  title: string                 // Page title
  slug: string                  // Page slug
  parent_id: number | null      // Parent page ID (null for root)
  
  // Optional metadata
  description?: string          // Page description
  layout?: string              // Layout name
  theme?: string               // Theme name
  hostname?: string            // Hostname for root pages
}
```

## Tree Generation Rules

### 1. Depth Calculation
- **Current page**: depth = 0
- **Parent page**: depth = 1  
- **Grandparent**: depth = 2
- **Continue until**: parent = null

### 2. Widget Filtering (Applied During Tree Building)
```python
# Each widget must pass ALL filters to be included:
def should_include_widget(widget, current_depth):
    # 1. Publishing status
    if not widget.get("isPublished", True):
        return False
    
    # 2. Effective/expiry dates
    if not is_widget_currently_effective(widget):
        return False
        
    # 3. Inheritance level depth limits
    inheritance_level = widget.get("inheritanceLevel", 0)
    if inheritance_level == 0 and current_depth > 0:
        return False  # Widget only on its own page
    if inheritance_level > 0 and current_depth > inheritance_level:
        return False  # Beyond inheritance depth
        
    return True
```

### 3. Slot Population
- **All layout slots** included in every tree node (even if empty)
- **Consistent slot structure** enables predictable queries
- **Empty slots** represented as empty arrays `[]`

## Helper Function Specifications

### Core Query Functions

#### 1. Get All Widgets
```typescript
getAllWidgets(slotName: string): TreeWidget[]
```
```python
get_all_widgets(slot_name: str) -> List[TreeWidget]
```
**Behavior**: Returns all widgets in the specified slot from ALL tree levels, ordered by depth (current first).

#### 2. Get Widgets by Type
```typescript
getWidgetsByType(widgetType: string, slotName?: string): TreeWidget[]
```
```python
get_widgets_by_type(widget_type: str, slot_name: Optional[str] = None) -> List[TreeWidget]
```
**Behavior**: Returns all widgets of the specified type. If slotName provided, filters to that slot only.

#### 3. Get Inherited Widgets Only
```typescript
getInheritedWidgets(slotName: string): TreeWidget[]  
```
```python
get_inherited_widgets(slot_name: str) -> List[TreeWidget]
```
**Behavior**: Returns only inherited widgets (depth > 0) for the specified slot.

#### 4. Get Local Widgets Only
```typescript
getLocalWidgets(slotName: string): TreeWidget[]
```
```python
get_local_widgets(slot_name: str) -> List[TreeWidget]
```
**Behavior**: Returns only local widgets (depth === 0) for the specified slot.

#### 5. Get Widgets at Specific Depth
```typescript
getWidgetsAtDepth(depth: number, slotName?: string): TreeWidget[]
```
```python
get_widgets_at_depth(depth: int, slot_name: Optional[str] = None) -> List[TreeWidget]
```
**Behavior**: Returns widgets from specific inheritance depth. If slotName provided, filters to that slot.

### Inheritance Logic Functions

#### 6. Get Merged Widgets (Display Logic)
```typescript
getMergedWidgets(slotName: string, options?: MergeOptions): TreeWidget[]
```
```python
get_merged_widgets(slot_name: str, options: Optional[MergeOptions] = None) -> List[TreeWidget]
```

**MergeOptions**:
```typescript
interface MergeOptions {
  mode?: 'edit' | 'preview'           // Display mode
  applyInheritanceBehavior?: boolean  // Apply before/after/override logic (default: true)
  respectPublishing?: boolean         // Filter by publishing status (default: true)
}
```

**Behavior**: Returns widgets for display, applying inheritance behavior rules:
- **override_parent**: Replaces all inherited widgets
- **insert_before_parent**: Prepends to inherited widgets
- **insert_after_parent**: Appends to inherited widgets

#### 7. Check Inheritance Status
```typescript
hasInheritedContent(slotName: string): boolean
hasLocalContent(slotName: string): boolean  
hasContentAtDepth(slotName: string, depth: number): boolean
```
```python
has_inherited_content(slot_name: str) -> bool
has_local_content(slot_name: str) -> bool
has_content_at_depth(slot_name: str, depth: int) -> bool
```

### Tree Navigation Functions

#### 8. Tree Traversal
```typescript
traverseUp(predicate: (node: TreeNode) => boolean): TreeNode | null
traverseDown(predicate: (node: TreeNode) => boolean): TreeNode[]
getAncestors(): TreeNode[]
getRoot(): TreeNode
```
```python
traverse_up(predicate: Callable[[TreeNode], bool]) -> Optional[TreeNode]
traverse_down(predicate: Callable[[TreeNode], bool]) -> List[TreeNode]
get_ancestors() -> List[TreeNode]
get_root() -> TreeNode
```

#### 9. Advanced Queries  
```typescript
getWidgetsByBehavior(behavior: WidgetInheritanceBehavior, slotName?: string): TreeWidget[]
findWidget(widgetId: string): TreeWidget | null
getSlotAtDepth(slotName: string, depth: number): TreeWidget[]
```
```python
get_widgets_by_behavior(behavior: WidgetInheritanceBehavior, slot_name: Optional[str] = None) -> List[TreeWidget]
find_widget(widget_id: str) -> Optional[TreeWidget]
get_slot_at_depth(slot_name: str, depth: int) -> List[TreeWidget]
```

## Error Handling

### Consistent Error Types
Both implementations must throw/raise identical errors:

```typescript
class InheritanceTreeError extends Error {
    code: string
    details?: any
}

// Usage
throw new InheritanceTreeError('SLOT_NOT_FOUND', { slotName })
```

```python
class InheritanceTreeError(Exception):
    def __init__(self, code: str, details: any = None):
        self.code = code
        self.details = details
        super().__init__(f"InheritanceTree error: {code}")

# Usage  
raise InheritanceTreeError('SLOT_NOT_FOUND', {'slot_name': slot_name})
```

### Standard Error Codes
- `SLOT_NOT_FOUND`: Requested slot doesn't exist in any tree level
- `WIDGET_NOT_FOUND`: Widget ID not found in tree
- `INVALID_DEPTH`: Depth parameter out of range
- `TREE_GENERATION_FAILED`: Tree building encountered error

## Performance Requirements

### Tree Generation
- **Backend**: Must complete in <50ms for 5-level hierarchy
- **Frontend**: Must complete in <100ms for tree processing
- **Memory**: Tree size must not exceed 10MB for deepest reasonable hierarchy

### Helper Functions  
- **Simple queries**: <1ms response time
- **Complex queries**: <10ms response time
- **Cache integration**: Must support standard caching patterns

## Backward Compatibility

### Transition Period
- Old inheritance system remains functional during implementation
- Feature flags control which system is used
- API versioning supports both approaches temporarily

### Migration Path
- New tree API available alongside old slot-based API
- Components migrated incrementally  
- Remove old system only after full validation

This specification ensures both implementations behave identically while providing a clear roadmap for consistent, high-performance widget inheritance! 🎯
