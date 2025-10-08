# Page Structure Query Library

A comprehensive library for querying page and widget structure information from the database. This library provides mirrored Python and TypeScript implementations with identical APIs for consistency across backend and frontend.

## Overview

The Page Structure Query Library complements the [Widget Inheritance Tree](./WIDGET_INHERITANCE_TREE_SPEC.md) library by providing tools to query the underlying page and version data structure.

### Key Features

- **Mirrored Implementations**: Python (backend) and TypeScript (frontend) with matching APIs
- **Type-Safe**: Comprehensive type definitions for all data structures
- **Hierarchical Queries**: Navigate page trees, get ancestors, children, breadcrumbs
- **Version Management**: Query version metadata and publishing status
- **Rich Metadata**: Access comprehensive page and version information
- **Search Capabilities**: Filter and search pages by various criteria

## Architecture

### Backend (Python)
- **Types**: `backend/webpages/structure_types.py`
- **Helpers**: `backend/webpages/structure_helpers.py`
- **API Views**: `backend/webpages/api_structure_views.py`

### Frontend (TypeScript)
- **Types**: `frontend/src/types/pageStructure.ts`
- **Helpers**: `frontend/src/utils/pageStructure.ts`
- **React Hooks**: `frontend/src/hooks/usePageStructure.ts`

## Core Type Definitions

### PageMetadata
Basic page information:
```typescript
interface PageMetadata {
    id: number
    title: string
    slug: string
    description: string
    path: string  // Full path from root
    parent_id: number | null
    is_root: boolean
    created_at: string
    updated_at: string
    created_by: string
    last_modified_by: string
}
```

### VersionMetadata
Version information:
```typescript
interface VersionMetadata {
    id: number
    version_number: number
    version_title: string
    meta_title: string
    meta_description: string
    code_layout: string | null
    theme_id: number | null
    theme_name: string | null
    effective_date: string | null
    expiry_date: string | null
    created_at: string
    created_by: string
    status: VersionStatus
}
```

### PageWithVersion
Page with version info:
```typescript
interface PageWithVersion {
    page: PageMetadata
    current_version: VersionMetadata | null
    published_version: VersionMetadata | null
    latest_version: VersionMetadata | null
    version_count: number
    has_draft: boolean
}
```

### ChildPageInfo
Information about child pages:
```typescript
interface ChildPageInfo {
    page: PageMetadata
    current_version: VersionMetadata | null
    child_count: number
    sort_order: number
}
```

### PageTreeNode
Hierarchical tree structure:
```typescript
interface PageTreeNode {
    page: PageMetadata
    current_version: VersionMetadata | null
    children: PageTreeNode[]
    child_count: number
    depth: number
}
```

### PageStructureSummary
Comprehensive structural information:
```typescript
interface PageStructureSummary {
    page: PageMetadata
    current_version: VersionMetadata | null
    ancestor_count: number
    ancestor_ids: number[]
    child_count: number
    descendant_count: number
    widget_summary: WidgetSummary[]
    hostnames: string[]
}
```

## Backend Usage (Python)

### Basic Queries

```python
from webpages.structure_helpers import get_structure_helpers

# Create helper instance
helpers = get_structure_helpers()

# Get page metadata by ID
page = helpers.get_page_by_id(123)
print(f"Page: {page.title} at {page.path}")

# Get page by path
page = helpers.get_page_by_path('/about/team')
print(f"Found page: {page.slug}")

# Get page by path with hostname
page = helpers.get_page_by_path('/products', hostname='example.com')
```

### Hierarchical Queries

```python
# Get active children
children = helpers.get_active_children(page_id=123)
for child in children:
    print(f"Child: {child.page.title} ({child.child_count} sub-pages)")

# Get full page tree (recursive)
tree = helpers.get_children_recursive(
    page_id=123,
    max_depth=3,
    include_unpublished=False
)

def print_tree(node, indent=0):
    print("  " * indent + f"- {node.page.title}")
    for child in node.children:
        print_tree(child, indent + 1)

print_tree(tree)

# Get ancestors
ancestors = helpers.get_ancestors(page_id=123)
print("Hierarchy:", " > ".join(a.title for a in ancestors))

# Get breadcrumbs
breadcrumbs = helpers.get_breadcrumbs(page_id=123)
for crumb in breadcrumbs:
    print(f"{crumb.title} ({crumb.path})")

# Get root page
root = helpers.get_root_page(page_id=123)
print(f"Root: {root.title}")
```

### Version Queries

```python
# Get current published version
version = helpers.get_current_version(page_id=123)
if version:
    print(f"Version {version.version_number}: {version.version_title}")
    print(f"Status: {version.status}")

# Get all versions for a page
versions = helpers.get_versions_for_page(
    page_id=123,
    status=VersionStatus.CURRENT
)

# Get page with version info
page_with_versions = helpers.get_page_with_versions(page_id=123)
print(f"Page has {page_with_versions.version_count} versions")
print(f"Has draft: {page_with_versions.has_draft}")
```

### Structure Summary

```python
# Get comprehensive summary
summary = helpers.get_page_structure_summary(page_id=123)

print(f"Page: {summary.page.title}")
print(f"Ancestors: {summary.ancestor_count}")
print(f"Children: {summary.child_count}")
print(f"Descendants: {summary.descendant_count}")

# Widget summary
for widget_info in summary.widget_summary:
    print(f"Slot '{widget_info.slot_name}':")
    print(f"  - {widget_info.widget_count} widgets")
    print(f"  - Types: {', '.join(widget_info.widget_types)}")
    print(f"  - Has local: {widget_info.has_local}")
    print(f"  - Has inherited: {widget_info.has_inherited}")
```

### Searching Pages

```python
from webpages.structure_types import PageSearchOptions

# Search for root pages
pages = helpers.search_pages(PageSearchOptions(
    root_only=True,
    include_unpublished=False
))

# Search for children of a specific page
pages = helpers.search_pages(PageSearchOptions(
    parent_id=123,
    include_unpublished=True
))

# Search by hostname
pages = helpers.search_pages(PageSearchOptions(
    hostname='example.com'
))
```

## Frontend Usage (TypeScript/React)

### Using React Hooks

```typescript
import {
    usePageMetadata,
    usePageChildren,
    usePageStructure,
    useBreadcrumbs,
    usePageTree
} from '@/hooks/usePageStructure'

function PageNavigator({ pageId }: { pageId: number }) {
    // Get page metadata
    const { data: page, isLoading } = usePageMetadata(pageId)
    
    // Get children
    const { data: children } = usePageChildren(pageId)
    
    // Get breadcrumbs
    const { data: breadcrumbs } = useBreadcrumbs(pageId)
    
    if (isLoading) return <div>Loading...</div>
    
    return (
        <div>
            <Breadcrumbs items={breadcrumbs} />
            <h1>{page?.title}</h1>
            <p>{page?.description}</p>
            
            <h2>Sub-pages</h2>
            <ul>
                {children?.map(child => (
                    <li key={child.page.id}>
                        {child.page.title}
                        {child.current_version && (
                            <span> (v{child.current_version.version_number})</span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    )
}
```

### Combined Hook

```typescript
function PageManager({ pageId }: { pageId: number }) {
    // Get all page structure data at once
    const {
        page,
        currentVersion,
        children,
        ancestors,
        breadcrumbs,
        summary,
        isLoading,
        isError,
        error
    } = usePageStructure(pageId)
    
    if (isLoading) return <Spinner />
    if (isError) return <Error message={error?.message} />
    
    return (
        <div>
            <h1>{page?.title}</h1>
            <p>Path: {page?.path}</p>
            
            {currentVersion && (
                <div>
                    Version: {currentVersion.version_number}
                    Status: {currentVersion.status}
                </div>
            )}
            
            {summary && (
                <div>
                    <p>Ancestors: {summary.ancestor_count}</p>
                    <p>Children: {summary.child_count}</p>
                    <p>Descendants: {summary.descendant_count}</p>
                    
                    <h3>Widgets</h3>
                    {summary.widget_summary.map(ws => (
                        <div key={ws.slot_name}>
                            {ws.slot_name}: {ws.widget_count} widgets
                            ({ws.widget_types.join(', ')})
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
```

### Page Tree Component

```typescript
function PageTreeView({ rootPageId }: { rootPageId: number }) {
    const { data: tree, isLoading } = usePageTree(
        rootPageId,
        3, // max depth
        false // exclude unpublished
    )
    
    if (isLoading) return <Spinner />
    
    return <TreeNode node={tree} />
}

function TreeNode({ node }: { node: PageTreeNode }) {
    const [expanded, setExpanded] = useState(true)
    
    return (
        <div>
            <div onClick={() => setExpanded(!expanded)}>
                {node.children.length > 0 && (
                    <span>{expanded ? '▼' : '▶'}</span>
                )}
                {node.page.title}
                {node.current_version && (
                    <span> (v{node.current_version.version_number})</span>
                )}
            </div>
            
            {expanded && node.children.length > 0 && (
                <div style={{ marginLeft: 20 }}>
                    {node.children.map(child => (
                        <TreeNode key={child.page.id} node={child} />
                    ))}
                </div>
            )}
        </div>
    )
}
```

### Using Helpers Directly

```typescript
import { pageStructureHelpers } from '@/utils/pageStructure'

async function loadPageData(pageId: number) {
    try {
        // Get page metadata
        const page = await pageStructureHelpers.getPageById(pageId)
        console.log('Page:', page)
        
        // Get children
        const children = await pageStructureHelpers.getActiveChildren(pageId)
        console.log('Children:', children)
        
        // Get structure summary
        const summary = await pageStructureHelpers.getPageStructureSummary(pageId)
        console.log('Summary:', summary)
        
    } catch (error) {
        console.error('Error loading page data:', error)
    }
}
```

## API Endpoints

All endpoints require authentication.

### Page Queries

- `GET /api/webpages/pages/{page_id}/metadata/` - Get page metadata
- `GET /api/webpages/pages/by-path/?path=/about&hostname=example.com` - Get page by path
- `GET /api/webpages/pages/{page_id}/children/?include_unpublished=false` - Get children
- `GET /api/webpages/pages/{page_id}/tree/?max_depth=3` - Get page tree
- `GET /api/webpages/pages/{page_id}/ancestors/` - Get ancestors
- `GET /api/webpages/pages/{page_id}/breadcrumbs/` - Get breadcrumbs
- `GET /api/webpages/pages/{page_id}/root/` - Get root page
- `GET /api/webpages/pages/{page_id}/structure-summary/` - Get structure summary
- `GET /api/webpages/pages/search/?parent_id=1&root_only=true` - Search pages

### Version Queries

- `GET /api/webpages/page-versions/{version_id}/metadata/` - Get version metadata
- `GET /api/webpages/pages/{page_id}/versions/?status=current` - Get versions for page
- `GET /api/webpages/pages/{page_id}/current-version/` - Get current version
- `GET /api/webpages/pages/{page_id}/with-versions/` - Get page with version info

## Error Handling

### Backend (Python)

```python
from webpages.structure_types import StructureQueryError, StructureQueryErrorCode

try:
    tree = helpers.get_children_recursive(page_id=999999)
except StructureQueryError as e:
    if e.code == StructureQueryErrorCode.PAGE_NOT_FOUND:
        print("Page not found")
    else:
        print(f"Error: {e.message}")
```

### Frontend (TypeScript)

```typescript
import { StructureQueryError, StructureQueryErrorCode } from '@/types/pageStructure'

try {
    const page = await pageStructureHelpers.getPageById(999999)
} catch (error) {
    if (error instanceof StructureQueryError) {
        if (error.code === StructureQueryErrorCode.PAGE_NOT_FOUND) {
            console.log('Page not found')
        } else {
            console.log(`Error: ${error.message}`)
        }
    }
}
```

## Performance Considerations

### Backend

- Uses Django's `select_related()` and `prefetch_related()` for efficient queries
- Recursive queries are optimized to minimize database hits
- Consider caching for frequently accessed structure data

### Frontend

- React hooks use React Query for automatic caching
- Default stale time: 5 minutes for page data, 2 minutes for versions
- Tree queries cached at each depth level
- Use `enabled` option to prevent unnecessary requests

## Integration with Inheritance Tree

The Page Structure Query Library works seamlessly with the Widget Inheritance Tree:

```python
from webpages.structure_helpers import get_structure_helpers
from webpages.inheritance_helpers import InheritanceTreeHelpers
from webpages.inheritance_tree import InheritanceTreeBuilder

# Get page structure
structure_helpers = get_structure_helpers()
page = structure_helpers.get_page_by_id(123)

# Build inheritance tree for widgets
builder = InheritanceTreeBuilder()
tree = builder.build_tree(page)
inheritance_helpers = InheritanceTreeHelpers(tree)

# Query both systems
children = structure_helpers.get_active_children(123)
widgets = inheritance_helpers.get_all_widgets('header')

print(f"Page has {len(children)} children and {len(widgets)} widgets in header")
```

## Testing

### Backend Tests

```python
from django.test import TestCase
from webpages.structure_helpers import get_structure_helpers

class PageStructureTests(TestCase):
    def test_get_page_by_id(self):
        helpers = get_structure_helpers()
        page = helpers.get_page_by_id(1)
        self.assertIsNotNone(page)
        self.assertEqual(page.id, 1)
    
    def test_get_children(self):
        helpers = get_structure_helpers()
        children = helpers.get_active_children(1)
        self.assertIsInstance(children, list)
```

### Frontend Tests

```typescript
import { describe, it, expect } from 'vitest'
import { PageStructureHelpers } from '@/utils/pageStructure'

describe('PageStructureHelpers', () => {
    it('should fetch page by id', async () => {
        const helpers = new PageStructureHelpers()
        const page = await helpers.getPageById(1)
        expect(page).toBeDefined()
        expect(page?.id).toBe(1)
    })
})
```

## See Also

- [Widget Inheritance Tree Specification](./WIDGET_INHERITANCE_TREE_SPEC.md)
- [Widget Inheritance Tree Implementation](./WIDGET_INHERITANCE_TREE_IMPLEMENTATION.md)
- [System Overview](./SYSTEM_OVERVIEW.md)

