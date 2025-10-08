# Query Libraries Usage Examples

This document provides practical examples of using the Page Structure Query Library and Widget Inheritance Tree Library together.

## Overview

The eceee_v4 project provides two complementary query libraries:

1. **Page Structure Query Library** - Queries page hierarchy, metadata, and versions
2. **Widget Inheritance Tree Library** - Queries widget data and inheritance

Both libraries have mirrored Python (backend) and TypeScript (frontend) implementations with identical APIs.

## Common Use Cases

### 1. Building a Page Navigation Menu

**Backend (Python):**
```python
from webpages.structure_helpers import get_structure_helpers

def build_navigation_menu(root_page_id):
    """Build a navigation menu structure"""
    helpers = get_structure_helpers()
    
    # Get the page tree (2 levels deep)
    tree = helpers.get_children_recursive(
        page_id=root_page_id,
        max_depth=2,
        include_unpublished=False
    )
    
    def tree_to_menu(node, level=0):
        menu_item = {
            'id': node.page.id,
            'title': node.page.title,
            'path': node.page.path,
            'level': level,
            'children': []
        }
        
        # Add published version info
        if node.current_version:
            menu_item['version'] = node.current_version.version_number
            menu_item['layout'] = node.current_version.code_layout
        
        # Recursively add children
        for child in node.children:
            menu_item['children'].append(tree_to_menu(child, level + 1))
        
        return menu_item
    
    return tree_to_menu(tree)
```

**Frontend (React):**
```typescript
import { usePageTree } from '@/hooks/usePageStructure'

function NavigationMenu({ rootPageId }: { rootPageId: number }) {
    const { data: tree, isLoading } = usePageTree(rootPageId, 2, false)
    
    if (isLoading) return <Spinner />
    
    return <MenuLevel node={tree} level={0} />
}

function MenuLevel({ node, level }: { node: PageTreeNode; level: number }) {
    return (
        <ul className={`menu-level-${level}`}>
            <li>
                <a href={node.page.path}>
                    {node.page.title}
                    {node.current_version && (
                        <span className="version">
                            v{node.current_version.version_number}
                        </span>
                    )}
                </a>
                
                {node.children.length > 0 && (
                    <ul>
                        {node.children.map(child => (
                            <MenuLevel 
                                key={child.page.id} 
                                node={child} 
                                level={level + 1} 
                            />
                        ))}
                    </ul>
                )}
            </li>
        </ul>
    )
}
```

### 2. Displaying Page with Widgets and Metadata

**Backend (Python):**
```python
from webpages.structure_helpers import get_structure_helpers
from webpages.inheritance_tree import InheritanceTreeBuilder
from webpages.inheritance_helpers import InheritanceTreeHelpers

def get_page_display_data(page_id):
    """Get all data needed to display a page"""
    structure_helpers = get_structure_helpers()
    
    # Get page structure info
    summary = structure_helpers.get_page_structure_summary(page_id)
    breadcrumbs = structure_helpers.get_breadcrumbs(page_id)
    children = structure_helpers.get_active_children(page_id)
    
    # Get page for widget tree
    from webpages.models import WebPage
    page = WebPage.objects.get(id=page_id)
    
    # Build widget inheritance tree
    builder = InheritanceTreeBuilder()
    widget_tree = builder.build_tree(page)
    widget_helpers = InheritanceTreeHelpers(widget_tree)
    
    # Get widgets for each slot
    layout = page.get_effective_layout()
    slot_data = {}
    
    for slot_name in layout.get_slot_names():
        widgets = widget_helpers.get_merged_widgets(slot_name)
        slot_data[slot_name] = [
            {
                'id': w.id,
                'type': w.type,
                'config': w.config,
                'is_inherited': w.is_inherited,
                'depth': w.depth
            }
            for w in widgets
        ]
    
    return {
        'page': {
            'id': summary.page.id,
            'title': summary.page.title,
            'path': summary.page.path,
            'description': summary.page.description,
        },
        'version': {
            'number': summary.current_version.version_number,
            'layout': summary.current_version.code_layout,
            'theme': summary.current_version.theme_name,
        } if summary.current_version else None,
        'breadcrumbs': [
            {'title': b.title, 'path': b.path}
            for b in breadcrumbs
        ],
        'children': [
            {
                'id': c.page.id,
                'title': c.page.title,
                'path': c.page.path,
            }
            for c in children
        ],
        'widgets': slot_data,
        'structure': {
            'ancestor_count': summary.ancestor_count,
            'child_count': summary.child_count,
            'descendant_count': summary.descendant_count,
        }
    }
```

**Frontend (React):**
```typescript
import { usePageStructure } from '@/hooks/usePageStructure'
import { useInheritanceTree } from '@/hooks/useInheritanceTree'

function PageDisplay({ pageId }: { pageId: number }) {
    // Get page structure
    const {
        page,
        currentVersion,
        children,
        breadcrumbs,
        summary,
        isLoading: structureLoading
    } = usePageStructure(pageId)
    
    // Get widget tree
    const {
        tree,
        helpers: widgetHelpers,
        isLoading: widgetsLoading
    } = useInheritanceTree(pageId)
    
    if (structureLoading || widgetsLoading) {
        return <Spinner />
    }
    
    return (
        <div className="page-display">
            {/* Breadcrumbs */}
            <Breadcrumbs items={breadcrumbs} />
            
            {/* Page Header */}
            <header>
                <h1>{page?.title}</h1>
                <p>{page?.description}</p>
                {currentVersion && (
                    <div className="version-info">
                        Version {currentVersion.version_number}
                        • Layout: {currentVersion.code_layout}
                        • Theme: {currentVersion.theme_name}
                    </div>
                )}
            </header>
            
            {/* Widget Slots */}
            <main>
                {tree && widgetHelpers && (
                    <>
                        <WidgetSlot 
                            slotName="header" 
                            helpers={widgetHelpers} 
                        />
                        <WidgetSlot 
                            slotName="content" 
                            helpers={widgetHelpers} 
                        />
                        <WidgetSlot 
                            slotName="sidebar" 
                            helpers={widgetHelpers} 
                        />
                    </>
                )}
            </main>
            
            {/* Child Pages */}
            {children && children.length > 0 && (
                <nav className="child-pages">
                    <h2>Sub-pages</h2>
                    <ul>
                        {children.map(child => (
                            <li key={child.page.id}>
                                <a href={child.page.path}>
                                    {child.page.title}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}
            
            {/* Structure Info */}
            {summary && (
                <aside className="structure-info">
                    <h3>Page Structure</h3>
                    <ul>
                        <li>Ancestors: {summary.ancestor_count}</li>
                        <li>Children: {summary.child_count}</li>
                        <li>All Descendants: {summary.descendant_count}</li>
                    </ul>
                </aside>
            )}
        </div>
    )
}

function WidgetSlot({ 
    slotName, 
    helpers 
}: { 
    slotName: string
    helpers: InheritanceTreeHelpers 
}) {
    const widgets = helpers.getMergedWidgets(slotName)
    
    return (
        <div className={`slot-${slotName}`}>
            {widgets.map(widget => (
                <div 
                    key={widget.id}
                    className={widget.isInherited ? 'inherited' : 'local'}
                >
                    <Widget 
                        type={widget.type} 
                        config={widget.config}
                        depth={widget.depth}
                    />
                </div>
            ))}
        </div>
    )
}
```

### 3. Page Editor with Live Preview

**Frontend (React):**
```typescript
function PageEditor({ pageId }: { pageId: number }) {
    const [editMode, setEditMode] = useState<'structure' | 'widgets'>('structure')
    
    // Get all page data
    const structure = usePageStructure(pageId)
    const widgets = useInheritanceTree(pageId)
    
    if (structure.isLoading || widgets.isLoading) {
        return <LoadingState />
    }
    
    return (
        <div className="page-editor">
            <EditorHeader 
                page={structure.page}
                version={structure.currentVersion}
            />
            
            <EditorSidebar>
                <button 
                    onClick={() => setEditMode('structure')}
                    className={editMode === 'structure' ? 'active' : ''}
                >
                    Page Structure
                </button>
                <button 
                    onClick={() => setEditMode('widgets')}
                    className={editMode === 'widgets' ? 'active' : ''}
                >
                    Widgets
                </button>
            </EditorSidebar>
            
            <EditorContent>
                {editMode === 'structure' && (
                    <StructureEditor 
                        pageId={pageId}
                        metadata={structure.page}
                        children={structure.children}
                        ancestors={structure.ancestors}
                    />
                )}
                
                {editMode === 'widgets' && widgets.tree && widgets.helpers && (
                    <WidgetEditor 
                        tree={widgets.tree}
                        helpers={widgets.helpers}
                    />
                )}
            </EditorContent>
            
            <PreviewPanel>
                <PageDisplay pageId={pageId} />
            </PreviewPanel>
        </div>
    )
}
```

### 4. Site Map Generator

**Backend (Python):**
```python
def generate_sitemap(root_page_id):
    """Generate a complete sitemap"""
    structure_helpers = get_structure_helpers()
    
    # Get full tree
    tree = structure_helpers.get_children_recursive(
        page_id=root_page_id,
        include_unpublished=False
    )
    
    sitemap_entries = []
    
    def process_node(node):
        if node.current_version:
            entry = {
                'loc': f"https://example.com{node.page.path}",
                'lastmod': node.page.updated_at,
                'changefreq': 'weekly',
                'priority': 1.0 - (node.depth * 0.1)  # Higher priority for top-level
            }
            sitemap_entries.append(entry)
        
        for child in node.children:
            process_node(child)
    
    process_node(tree)
    return sitemap_entries
```

### 5. Analytics Dashboard

**Frontend (React):**
```typescript
function AnalyticsDashboard({ pageId }: { pageId: number }) {
    const { summary, isLoading } = usePageStructureSummary(pageId)
    
    if (isLoading) return <Spinner />
    if (!summary) return <NotFound />
    
    return (
        <div className="analytics-dashboard">
            <h1>Analytics for {summary.page.title}</h1>
            
            <MetricsGrid>
                <MetricCard
                    title="Hierarchy Depth"
                    value={summary.ancestor_count}
                    description="Levels from root"
                />
                
                <MetricCard
                    title="Direct Children"
                    value={summary.child_count}
                    description="Immediate sub-pages"
                />
                
                <MetricCard
                    title="All Descendants"
                    value={summary.descendant_count}
                    description="Total sub-pages (recursive)"
                />
            </MetricsGrid>
            
            <WidgetAnalytics>
                <h2>Widget Distribution</h2>
                {summary.widget_summary.map(ws => (
                    <WidgetSlotCard key={ws.slot_name}>
                        <h3>{ws.slot_name}</h3>
                        <p>{ws.widget_count} widgets</p>
                        <p>Types: {ws.widget_types.join(', ')}</p>
                        <div className="badges">
                            {ws.has_local && <Badge>Local</Badge>}
                            {ws.has_inherited && <Badge>Inherited</Badge>}
                        </div>
                    </WidgetSlotCard>
                ))}
            </WidgetAnalytics>
            
            {summary.hostnames.length > 0 && (
                <section>
                    <h2>Hostnames</h2>
                    <ul>
                        {summary.hostnames.map(hostname => (
                            <li key={hostname}>{hostname}</li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    )
}
```

### 6. Search and Filter Pages

**Frontend (React):**
```typescript
function PageSearchPanel() {
    const [filters, setFilters] = useState<PageSearchOptions>({
        root_only: false,
        include_unpublished: false
    })
    
    const { data: results, isLoading } = usePageSearch(filters)
    
    return (
        <div className="page-search">
            <SearchFilters>
                <label>
                    <input
                        type="checkbox"
                        checked={filters.root_only}
                        onChange={e => setFilters({
                            ...filters,
                            root_only: e.target.checked
                        })}
                    />
                    Root pages only
                </label>
                
                <label>
                    <input
                        type="checkbox"
                        checked={filters.include_unpublished}
                        onChange={e => setFilters({
                            ...filters,
                            include_unpublished: e.target.checked
                        })}
                    />
                    Include unpublished
                </label>
                
                <input
                    type="text"
                    placeholder="Hostname..."
                    onChange={e => setFilters({
                        ...filters,
                        hostname: e.target.value || null
                    })}
                />
            </SearchFilters>
            
            <SearchResults>
                {isLoading ? (
                    <Spinner />
                ) : (
                    <ul>
                        {results?.map(page => (
                            <li key={page.id}>
                                <h3>{page.title}</h3>
                                <p>{page.path}</p>
                                <p>{page.description}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </SearchResults>
        </div>
    )
}
```

## Best Practices

### 1. Combine Queries Efficiently

Use the combined hooks to fetch multiple related data points:

```typescript
// Good: Use combined hook
const { page, currentVersion, children, summary } = usePageStructure(pageId)

// Avoid: Multiple separate hooks when data is related
// const page = usePageMetadata(pageId)
// const version = useCurrentVersion(pageId)
// const children = usePageChildren(pageId)
// const summary = usePageStructureSummary(pageId)
```

### 2. Cache Aggressively

Structure data changes infrequently, so use longer stale times:

```typescript
const { data: tree } = usePageTree(pageId, undefined, false, {
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000  // 30 minutes
})
```

### 3. Handle Loading States

Always handle loading and error states gracefully:

```typescript
const { data, isLoading, isError, error } = usePageStructure(pageId)

if (isLoading) return <Skeleton />
if (isError) return <ErrorBoundary error={error} />
if (!data) return <NotFound />

return <PageContent data={data} />
```

### 4. Use Type Guards

Validate data at runtime when needed:

```typescript
import { isPageMetadata, isPageTreeNode } from '@/types/pageStructure'

function processData(data: unknown) {
    if (isPageMetadata(data)) {
        // TypeScript knows this is PageMetadata
        console.log(data.title)
    }
}
```

## See Also

- [Page Structure Query Library](./PAGE_STRUCTURE_QUERY_LIBRARY.md)
- [Widget Inheritance Tree Specification](./WIDGET_INHERITANCE_TREE_SPEC.md)
- [System Overview](./SYSTEM_OVERVIEW.md)

