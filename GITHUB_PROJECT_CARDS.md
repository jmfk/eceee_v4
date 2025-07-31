# GitHub Project Cards for Layout Template System

This document contains all the GitHub issues/cards for implementing the HTML Template-Based Layout System. Copy each section to create issues in your `eceee_v4` repository at https://github.com/jmfk/eceee_v4.

---

## Phase 1: Backend Foundation

### Issue 1: Enhance BaseLayout class for HTML template support

**Title:** `Phase 1.1: Enhance BaseLayout class for HTML template support`

**Labels:** `enhancement`, `backend`, `layout-system`, `phase-1`

**Body:**
```markdown
## Task Description
Extend the existing `BaseLayout` class to support HTML template loading, parsing, and CSS extraction with data-widget-slot marker detection.

## Acceptance Criteria
- [ ] Create `TemplateBasedLayout` class extending `BaseLayout`
- [ ] Add `template_file` and `css_file` properties
- [ ] Implement `_parse_template()` method to extract HTML, CSS, and slots
- [ ] Add template content loading with Django template system
- [ ] Support automatic slot parsing from `data-widget-slot` attributes
- [ ] Maintain backward compatibility with existing layouts

## Technical Requirements
- Use BeautifulSoup for HTML parsing
- Extract CSS from `<style>` tags separately from HTML
- Parse slot metadata from data attributes (title, description, max-widgets)
- Validate template structure and slot configuration
- Add proper error handling for missing or invalid templates

## Definition of Done
- [ ] `TemplateBasedLayout` class implemented and tested
- [ ] Template parsing extracts HTML, CSS, and slot configurations correctly
- [ ] Existing code-based layouts continue to work unchanged
- [ ] Unit tests cover all parsing scenarios
- [ ] Documentation updated

**Phase:** 1 - Backend Foundation  
**Priority:** High  
**Estimate:** 3-4 days
```

---

### Issue 2: Create template parsing engine

**Title:** `Phase 1.2: Create template parsing engine`

**Labels:** `enhancement`, `backend`, `parsing`, `phase-1`

**Body:**
```markdown
## Task Description
Create a robust template parsing system to automatically extract widget slots from HTML templates using data-widget-slot attributes and generate slot configurations.

## Acceptance Criteria
- [ ] Implement HTML template parser with BeautifulSoup
- [ ] Extract widget slot markers from `data-widget-slot` attributes
- [ ] Parse slot metadata (title, description, max-widgets, css-classes)
- [ ] Generate slot configuration JSON from parsed data
- [ ] Validate slot markers and configurations
- [ ] Handle parsing errors gracefully

## Technical Requirements
- Parse `data-widget-slot` attributes to identify slots
- Extract additional metadata from `data-slot-*` attributes
- Generate CSS selectors for each slot
- Validate slot names are unique within template
- Support optional slot metadata with sensible defaults
- Provide detailed error messages for invalid templates

## Definition of Done
- [ ] Template parser extracts all slot information correctly
- [ ] Slot configurations match expected JSON format
- [ ] Error handling provides meaningful feedback
- [ ] Performance is optimized for large templates
- [ ] Integration tests validate end-to-end parsing

**Phase:** 1 - Backend Foundation  
**Priority:** High  
**Estimate:** 2-3 days
```

---

### Issue 3: Enhance layout API endpoints

**Title:** `Phase 1.3: Enhance layout API endpoints`

**Labels:** `enhancement`, `backend`, `api`, `phase-1`

**Body:**
```markdown
## Task Description
Enhance layout API endpoints to include full template data (HTML, CSS, parsed slots) in JSON format while maintaining backward compatibility.

## Acceptance Criteria
- [ ] Update `CodeLayoutViewSet` to include template data
- [ ] Add HTML and CSS fields to API responses
- [ ] Include `template_based` flag in layout responses
- [ ] Maintain backward compatibility with existing API consumers
- [ ] Add template metadata (file path, slot count, etc.)
- [ ] Update API documentation

## Technical Requirements
- Extend layout serialization to include HTML/CSS content
- Add template validation before API response
- Implement caching for parsed template data
- Handle large template content efficiently
- Support both template-based and code-based layouts in unified response
- Version API appropriately if breaking changes needed

## API Response Enhancement
```json
{
  "name": "hero_layout",
  "description": "Hero section with content and sidebar",
  "type": "code",
  "template_based": true,
  "html": "<div class='hero-layout'>...</div>",
  "css": ".hero-layout { display: grid; ... }",
  "slot_configuration": { "slots": [...] },
  "meta": {
    "template_file": "webpages/layouts/hero_layout.html",
    "parsed_slots_count": 4,
    "has_css": true
  }
}
```

## Definition of Done
- [ ] API includes template HTML and CSS content
- [ ] Backward compatibility maintained
- [ ] Template-based flag differentiates layout types
- [ ] Performance acceptable for large templates
- [ ] API documentation updated

**Phase:** 1 - Backend Foundation  
**Priority:** High  
**Estimate:** 2-3 days
```

---

### Issue 4: Create sample HTML layout templates

**Title:** `Phase 1.4: Create sample HTML layout templates`

**Labels:** `enhancement`, `frontend`, `templates`, `phase-1`

**Body:**
```markdown
## Task Description
Create sample HTML layout templates (hero, grid, sidebar, minimal) with CSS and proper slot markers for testing and demonstration purposes.

## Acceptance Criteria
- [ ] Create hero layout template with CSS Grid
- [ ] Create grid dashboard layout template
- [ ] Create sidebar layout template
- [ ] Create minimal layout template
- [ ] Include responsive design patterns
- [ ] Add comprehensive slot markers and metadata

## Templates to Create
1. **Hero Layout** - Full-screen hero section with content area
2. **Grid Dashboard** - Complex grid with header, sidebar, main, metrics, footer
3. **Two-Column Sidebar** - Traditional main content + sidebar layout
4. **Minimal Layout** - Simple header + content for focused presentation
5. **Landing Page** - Marketing-style layout with multiple sections

## Technical Requirements
- Use modern CSS (Grid, Flexbox) for layouts
- Include responsive breakpoints for mobile compatibility
- Add proper `data-widget-slot` attributes with metadata
- Include scoped `<style>` tags with layout-specific CSS
- Follow accessibility best practices
- Use semantic HTML elements

## Definition of Done
- [ ] 5 sample templates created in `backend/templates/webpages/layouts/`
- [ ] Templates include comprehensive CSS styling
- [ ] All slots properly marked with data attributes
- [ ] Templates are responsive and accessible
- [ ] Templates work with existing widget system
- [ ] Documentation includes template usage examples

**Phase:** 1 - Backend Foundation  
**Priority:** Medium  
**Estimate:** 2-3 days
```

---

## Phase 2: Frontend Renderer

### Issue 5: Create LayoutRenderer React component

**Title:** `Phase 2.1: Create LayoutRenderer React component`

**Labels:** `enhancement`, `frontend`, `react`, `phase-2`

**Body:**
```markdown
## Task Description
Create LayoutRenderer React component that safely renders HTML templates using dangerouslySetInnerHTML with proper sanitization.

## Acceptance Criteria
- [ ] Create `LayoutRenderer` component with HTML template rendering
- [ ] Implement HTML sanitization with DOMPurify
- [ ] Support template-based and fallback rendering modes
- [ ] Add proper error boundaries and error handling
- [ ] Implement slot element detection and mapping
- [ ] Support dynamic template switching

## Technical Requirements
- Use DOMPurify for HTML sanitization with whitelist approach
- Implement refs to access rendered DOM elements
- Create slot element mapping for widget portal mounting
- Add loading states and error handling
- Support className prop for styling integration
- Optimize re-rendering performance with React.memo

## Security Considerations
- Whitelist allowed HTML tags and attributes
- Strip dangerous elements (script, iframe, etc.)
- Validate data attributes for slot markers
- Sanitize CSS content if included in HTML
- Prevent XSS attacks through content validation

## Component API
```jsx
<LayoutRenderer 
  layout={layoutData}
  widgets={widgetsBySlot}
  className="custom-layout"
  onError={handleError}
  onSlotMount={handleSlotMount}
/>
```

## Definition of Done
- [ ] LayoutRenderer component renders HTML templates safely
- [ ] HTML sanitization prevents security vulnerabilities
- [ ] Component integrates with existing layout system
- [ ] Error handling provides meaningful feedback
- [ ] Performance is optimized for large templates
- [ ] Unit tests cover security and functionality

**Phase:** 2 - Frontend Renderer  
**Priority:** High  
**Estimate:** 3-4 days
```

---

### Issue 6: Implement CSS injection system

**Title:** `Phase 2.2: Implement CSS injection system`

**Labels:** `enhancement`, `frontend`, `css`, `phase-2`

**Body:**
```markdown
## Task Description
Implement dynamic CSS injection system in React with proper scoping and cleanup to handle layout-specific styles.

## Acceptance Criteria
- [ ] Create CSS injection utility for layout styles
- [ ] Implement scoped CSS to prevent style conflicts
- [ ] Add automatic cleanup when layouts change
- [ ] Support CSS validation and sanitization
- [ ] Handle CSS caching and performance optimization
- [ ] Add CSS hot-reloading for development

## Technical Requirements
- Inject CSS into document head with unique identifiers
- Clean up previous CSS when component unmounts
- Validate CSS content for security (no harmful functions)
- Support CSS-in-JS alternative for complex scenarios
- Implement CSS loading states and error handling
- Optimize CSS parsing and injection performance

## Security Considerations
- Sanitize CSS content to prevent injection attacks
- Strip dangerous CSS functions (url(), expression(), etc.)
- Validate CSS properties and values
- Prevent CSS-based attacks (clickjacking, etc.)
- Implement Content Security Policy compliance

## CSS Management Features
- Unique CSS identifiers per layout
- Automatic cleanup on component unmount
- CSS conflict prevention through scoping
- Development hot-reloading support
- Production optimization (minification, caching)

## Definition of Done
- [ ] CSS injection system works reliably
- [ ] No CSS conflicts between different layouts
- [ ] Proper cleanup prevents memory leaks
- [ ] Security validation prevents CSS injection
- [ ] Performance is optimized for production
- [ ] Development experience supports hot-reloading

**Phase:** 2 - Frontend Renderer  
**Priority:** High  
**Estimate:** 2-3 days
```

---

### Issue 7: Create widget portal management system

**Title:** `Phase 2.3: Create widget portal management system`

**Labels:** `enhancement`, `frontend`, `react-portals`, `phase-2`

**Body:**
```markdown
## Task Description
Create React Portal system to mount React widget components into HTML template slots while maintaining virtual DOM for widgets.

## Acceptance Criteria
- [ ] Implement React Portal system for widget mounting
- [ ] Create WidgetWrapper component for portal integration
- [ ] Support dynamic widget mounting and unmounting
- [ ] Maintain React virtual DOM for widget components
- [ ] Handle portal cleanup and memory management
- [ ] Support widget event handling and state management

## Technical Requirements
- Use ReactDOM.createPortal for widget mounting
- Create slot-to-portal mapping system
- Implement widget lifecycle management
- Support dynamic slot content updates
- Handle portal errors and fallbacks
- Optimize portal performance for large widget counts

## Portal System Features
- Automatic portal creation for each slot
- Widget component mounting in correct DOM elements
- Event handling between widgets and layout
- State management preservation for widgets
- Error boundaries for individual widgets
- Performance optimization for portal updates

## Component Integration
```jsx
const WidgetPortalManager = ({ layout, widgets, slotElements }) => {
  return Object.entries(slotElements).map(([slotName, element]) => 
    widgets[slotName]?.map(widget => 
      ReactDOM.createPortal(
        <WidgetWrapper widget={widget} slotName={slotName} />,
        element
      )
    )
  )
}
```

## Definition of Done
- [ ] Widget portals mount correctly in HTML slots
- [ ] React virtual DOM maintained for widgets
- [ ] Portal cleanup prevents memory leaks
- [ ] Widget state and events work as expected
- [ ] Performance acceptable for many widgets
- [ ] Error handling isolates widget failures

**Phase:** 2 - Frontend Renderer  
**Priority:** High  
**Estimate:** 2-3 days
```

---

## Phase 3: Integration

### Issue 8: Update SlotManager for template-based layouts

**Title:** `Phase 3.1: Update SlotManager for template-based layouts`

**Labels:** `enhancement`, `frontend`, `integration`, `phase-3`

**Body:**
```markdown
## Task Description
Update SlotManager component to work with new HTML-based layout rendering system and portal-based widget mounting.

## Acceptance Criteria
- [ ] Integrate LayoutRenderer with existing SlotManager
- [ ] Support both template-based and traditional slot rendering
- [ ] Update widget management UI for template layouts
- [ ] Maintain existing drag-and-drop functionality
- [ ] Add widget management overlay for template layouts
- [ ] Preserve all existing SlotManager functionality

## Technical Requirements
- Detect template-based vs traditional layouts
- Render LayoutRenderer when template data available
- Create widget management overlay for template layouts
- Maintain drag-and-drop widget reordering
- Support widget add/edit/delete operations
- Integrate with existing widget library and configurator

## SlotManager Enhancement
```jsx
const SlotManager = ({ pageId, layout, onWidgetChange }) => {
  if (layout?.template_based) {
    return (
      <div className="slot-manager-container">
        <LayoutRenderer layout={layout} widgets={widgetsBySlot} />
        <WidgetManagementOverlay
          layout={layout}
          widgets={widgetsBySlot}
          onAddWidget={handleAddWidget}
          onEditWidget={handleEditWidget}
          onDeleteWidget={handleDeleteWidget}
        />
      </div>
    )
  }
  
  // Fallback to existing slot-based rendering
  return <TraditionalSlotManager {...props} />
}
```

## Widget Management Features
- Visual overlay for widget management in templates
- Drag-and-drop support within template slots
- Widget add/edit/delete operations
- Slot capacity validation and feedback
- Widget reordering within slots
- Real-time preview of changes

## Definition of Done
- [ ] SlotManager supports both layout types seamlessly
- [ ] All existing functionality preserved
- [ ] Template-based layouts have full widget management
- [ ] UI/UX is intuitive for template layouts
- [ ] Performance maintained with new rendering system
- [ ] Comprehensive testing covers both modes

**Phase:** 3 - Integration  
**Priority:** High  
**Estimate:** 3-4 days
```

---

### Issue 9: Enhance LayoutSelector for template preview

**Title:** `Phase 3.2: Enhance LayoutSelector for template preview`

**Labels:** `enhancement`, `frontend`, `ui-ux`, `phase-3`

**Body:**
```markdown
## Task Description
Enhance LayoutSelector component to support template preview with live HTML/CSS rendering and slot visualization.

## Acceptance Criteria
- [ ] Add template preview functionality to LayoutSelector
- [ ] Show live HTML/CSS rendering of template layouts
- [ ] Display slot information and layout structure
- [ ] Support template vs code layout differentiation
- [ ] Add template metadata display (slot count, responsive, etc.)
- [ ] Improve layout selection UX with previews

## Technical Requirements
- Integrate LayoutRenderer for preview rendering
- Create compact preview mode for layout selector
- Show slot structure and metadata
- Support template thumbnails or miniature previews
- Add template-specific information display
- Maintain performance for multiple layout previews

## Preview Features
- Miniature template rendering with placeholder content
- Slot visualization with labels and descriptions
- Template metadata display (responsive, slot count)
- Template vs code layout visual differentiation
- Hover effects and detailed preview on selection
- Template validation status indicators

## LayoutSelector Enhancement
```jsx
const LayoutSelector = ({ value, onChange, showPreview = true }) => {
  const renderLayoutOption = (layout) => (
    <div className="layout-option">
      <div className="layout-info">
        <span className="layout-name">{layout.name}</span>
        <span className="layout-type">{layout.template_based ? 'Template' : 'Code'}</span>
      </div>
      {showPreview && layout.template_based && (
        <div className="layout-preview">
          <LayoutRenderer 
            layout={layout} 
            widgets={{}} 
            className="preview-mode"
          />
        </div>
      )}
      <div className="layout-metadata">
        {layout.slot_configuration?.slots?.length} slots
        {layout.meta?.responsive && <span className="responsive-badge">Responsive</span>}
      </div>
    </div>
  )
}
```

## Definition of Done
- [ ] LayoutSelector shows template previews
- [ ] Preview rendering is performant
- [ ] Template metadata clearly displayed
- [ ] Layout selection UX is improved
- [ ] Both template and code layouts supported
- [ ] Preview accuracy matches actual rendering

**Phase:** 3 - Integration  
**Priority:** Medium  
**Estimate:** 2-3 days
```

---

### Issue 10: Create layout editing and validation tools

**Title:** `Phase 3.3: Create layout editing and validation tools`

**Labels:** `enhancement`, `tools`, `validation`, `phase-3`

**Body:**
```markdown
## Task Description
Create layout editing tools and template validation system to ensure proper HTML structure, security compliance, and slot configuration.

## Acceptance Criteria
- [ ] Create template validation system for HTML/CSS
- [ ] Add template editing interface for developers
- [ ] Implement real-time validation feedback
- [ ] Create template testing and preview tools
- [ ] Add template migration utilities
- [ ] Support template versioning and backup

## Validation Features
- HTML structure validation (semantic elements, accessibility)
- CSS validation and security checking
- Slot marker validation (unique names, proper attributes)
- Template syntax validation (BeautifulSoup parsing)
- Security validation (XSS prevention, content safety)
- Performance validation (template size, complexity)

## Template Editing Tools
- Live template editor with syntax highlighting
- Real-time preview with sample widgets
- Validation feedback and error reporting
- Template testing with different widget configurations
- Template export/import functionality
- Version comparison and rollback

## Validation Rules
```javascript
const templateValidation = {
  html: {
    requiredElements: ['div', 'section', 'main', 'aside'],
    forbiddenElements: ['script', 'iframe', 'object'],
    requiredAttributes: ['data-widget-slot'],
    maxDepth: 10,
    maxSize: '100KB'
  },
  css: {
    forbiddenFunctions: ['url()', 'expression()', '@import'],
    maxRules: 500,
    maxSize: '50KB'
  },
  slots: {
    uniqueNames: true,
    requiredAttributes: ['data-widget-slot'],
    maxSlots: 20
  }
}
```

## Definition of Done
- [ ] Template validation prevents security vulnerabilities
- [ ] Validation provides helpful error messages
- [ ] Template editing tools support development workflow
- [ ] Real-time feedback improves developer experience
- [ ] Template migration tools ease adoption
- [ ] Performance validation prevents issues

**Phase:** 3 - Integration  
**Priority:** Medium  
**Estimate:** 3-4 days
```

---

## Phase 4: Testing & Polish

### Issue 11: Create comprehensive testing framework

**Title:** `Phase 4.1: Create comprehensive testing framework`

**Labels:** `testing`, `quality-assurance`, `security`, `phase-4`

**Body:**
```markdown
## Task Description
Create comprehensive testing framework for layout templates including unit tests, integration tests, and visual regression tests.

## Acceptance Criteria
- [ ] Create unit tests for template parsing system
- [ ] Add integration tests for layout API endpoints
- [ ] Implement React component tests for LayoutRenderer
- [ ] Create visual regression tests for template rendering
- [ ] Add security testing for HTML/CSS sanitization
- [ ] Implement performance testing for large templates

## Testing Categories

### Unit Tests
- Template parsing logic (HTML, CSS, slot extraction)
- Validation functions (security, structure, performance)
- API serialization and response formatting
- Component state management and props handling

### Integration Tests
- End-to-end template loading and rendering
- Widget portal mounting and interaction
- API endpoint functionality with real templates
- Database integration with template-based layouts

### Security Tests
- HTML sanitization effectiveness
- CSS injection prevention
- XSS attack prevention
- Content validation security

### Performance Tests
- Template parsing performance benchmarks
- Rendering performance with large templates
- Memory usage and cleanup verification
- Portal creation and destruction performance

## Testing Tools and Setup
- Jest for unit testing
- React Testing Library for component tests
- Cypress for integration tests
- Percy or similar for visual regression
- Custom security testing utilities
- Performance profiling tools

## Test Coverage Goals
- 90%+ code coverage for template parsing
- 85%+ coverage for React components
- 100% coverage for security validation
- All API endpoints tested with template data
- All sample templates tested for rendering

## Definition of Done
- [ ] Test coverage meets minimum requirements
- [ ] All security scenarios tested and passing
- [ ] Performance benchmarks established
- [ ] Visual regression tests prevent UI breaks
- [ ] CI/CD pipeline includes all test types
- [ ] Test documentation guides future development

**Phase:** 4 - Testing & Polish  
**Priority:** High  
**Estimate:** 4-5 days
```

---

### Issue 12: Performance optimization and documentation

**Title:** `Phase 4.2: Performance optimization and documentation`

**Labels:** `performance`, `documentation`, `deployment`, `phase-4`

**Body:**
```markdown
## Task Description
Implement performance monitoring, optimization, and create comprehensive documentation for the layout template system.

## Acceptance Criteria
- [ ] Implement performance monitoring and profiling
- [ ] Optimize template parsing and rendering performance
- [ ] Create comprehensive developer documentation
- [ ] Add user guides and examples
- [ ] Implement caching strategies for production
- [ ] Create migration guides from existing layouts

## Performance Optimization
- Template parsing caching (Redis/memory cache)
- Component memoization and optimization
- Portal creation/destruction optimization
- CSS injection performance improvements
- Bundle size optimization for production
- Lazy loading of large templates

## Documentation Requirements

### Developer Documentation
- Template creation guide with examples
- API reference for template-based layouts
- Component integration documentation
- Security best practices guide
- Performance optimization guide
- Troubleshooting and debugging guide

### User Documentation
- Layout selection and management guide
- Widget placement in template layouts
- Template preview and editing workflow
- Migration from code-based layouts
- Best practices for content creators

### Technical Documentation
- Architecture overview and design decisions
- Template parsing algorithm documentation
- Security implementation details
- Performance benchmarks and optimization
- Testing strategy and coverage reports

## Migration and Adoption
- Create migration utilities for existing layouts
- Provide transition period support for both systems
- Document migration strategies and timelines
- Create training materials for team adoption
- Establish template governance and review process

## Performance Targets
- Template parsing: < 100ms for complex templates
- First render: < 200ms for template-based layouts
- Memory usage: < 10MB additional for template system
- Bundle size: < 50KB additional JavaScript
- Cache hit rate: > 90% for template data

## Definition of Done
- [ ] Performance targets met in production environment
- [ ] Complete documentation published and accessible
- [ ] Migration tools tested with existing layouts
- [ ] User training materials created and delivered
- [ ] Production monitoring and alerting configured
- [ ] System ready for full production deployment

**Phase:** 4 - Testing & Polish  
**Priority:** Medium  
**Estimate:** 3-4 days
```

---

## Quick Creation Guide

### Using GitHub CLI (if available):
```bash
# Create all issues at once (run from repository root)
gh issue create --title "Phase 1.1: Enhance BaseLayout class for HTML template support" --body-file phase1-1.md --label "enhancement,backend,layout-system,phase-1"
gh issue create --title "Phase 1.2: Create template parsing engine" --body-file phase1-2.md --label "enhancement,backend,parsing,phase-1"
# ... continue for all 12 issues
```

### Using GitHub Web Interface:
1. Go to https://github.com/jmfk/eceee_v4/issues
2. Click "New issue"
3. Copy the title and body from each section above
4. Add the specified labels
5. Assign to yourself
6. Create the issue
7. The issue will automatically appear in your project board at https://github.com/users/jmfk/projects/3

### Project Board Organization:
- **Backlog**: All new issues start here
- **Todo**: Ready to start (Phase 1 items first)
- **In Progress**: Currently working on
- **Review**: Completed and awaiting review
- **Done**: Completed and merged

## Implementation Order:
1. **Phase 1** (Backend Foundation): Issues 1-4
2. **Phase 2** (Frontend Renderer): Issues 5-7
3. **Phase 3** (Integration): Issues 8-10
4. **Phase 4** (Testing & Polish): Issues 11-12

Each phase should be completed before starting the next to ensure proper dependencies are met.

---

## Frontend Bug Reports

### Bug 1: Unsafe parseInt usage without error handling

**Title:** `Bug: Unsafe parseInt usage without error handling`

**Labels:** `bug`, `frontend`, `medium-priority`

**Body:**
```markdown
## Description
Multiple components use `parseInt()` without proper error handling, which can lead to NaN values and unexpected behavior.

## Affected Files
- `frontend/src/components/StatusBar.jsx:133` - `parseInt(e.target.value)` for version selection
- `frontend/src/components/LayoutRenderer.js:4990` - `parseInt(e.target.value)` for version selection  
- `frontend/src/components/widget-editors/EventsEditor.jsx:262` - `parseInt(e.target.value)` for capacity field

## Impact
- UI components may break with invalid numeric inputs
- Version selection could fail silently
- Form validation bypassed

## Recommended Fix
Wrap parseInt calls in validation:
```javascript
const parsed = parseInt(value, 10);
if (isNaN(parsed)) {
    // Handle error case
    return;
}
```

## Priority
Medium - Can cause UI malfunctions
```

---

### Bug 2: Missing key props in React list renders

**Title:** `Bug: Missing key props in React list renders causing performance issues`

**Labels:** `bug`, `frontend`, `performance`, `medium-priority`

**Body:**
```markdown
## Description
Multiple components render lists without proper key props, which can cause React rendering performance issues and state management bugs.

## Affected Files
- `frontend/src/components/slot-manager/HtmlSlotCard.jsx:103,118,130` - Missing keys in error/warning/widget lists
- `frontend/src/components/ThemeEditor.jsx:117,131,150,388,450,755,855` - Missing keys in theme-related lists
- `frontend/src/components/NotificationManager.jsx:34` - Missing keys in error list
- Multiple other components affected

## Impact
- Degraded React rendering performance
- Potential state management bugs when lists change
- Console warnings in development

## Recommended Fix
Add unique key props to all mapped elements:
```javascript
{items.map((item, index) => (
    <Component key={item.id || index} {...props} />
))}
```

## Priority
Medium - Performance and reliability issue
```

---

### Bug 3: Potential memory leaks from untracked event listeners

**Title:** `Bug: Potential memory leaks from untracked event listeners`

**Labels:** `bug`, `frontend`, `memory-leak`, `high-priority`

**Body:**
```markdown
## Description
Several components add event listeners to global objects (document, window) without properly removing them in cleanup functions, potentially causing memory leaks.

## Affected Files
- `frontend/src/components/LayoutRenderer.js` - Multiple addEventListener calls not properly tracked for cleanup
- `frontend/src/utils/cssInjectionManager.js:38` - window beforeunload listener  
- `frontend/src/components/ContentEditor.jsx` - Complex event listener management

## Critical Areas
1. **LayoutRenderer.js**: Lines 724,731,774,776,855,857,1055,1056,1059,1179,1207,1366,1440,1450,2127,2128,2131,2138,2155,4022,4989
2. **Modal.jsx**: Lines 19,20 - Global keydown listeners

## Impact
- Memory leaks in long-running sessions
- Potential performance degradation
- Event handler conflicts

## Recommended Fix
1. Audit all global event listeners
2. Ensure proper cleanup in useEffect return functions
3. Use WeakMap or Set to track listeners for cleanup

## Priority
High - Memory leaks affect application stability
```

---

### Bug 4: Missing null/undefined checks in StatusBar component

**Title:** `Bug: Missing null/undefined checks in StatusBar component`

**Labels:** `bug`, `frontend`, `medium-priority`

**Body:**
```markdown
## Description
The StatusBar component assumes certain properties exist on objects without null checks, which can cause runtime errors.

## Affected Code
`frontend/src/components/StatusBar.jsx:59`

## Issue
- Assumes `timestamp` property exists and has `toLocaleTimeString()` method
- If timestamp is not a Date object or is null/undefined, this will throw an error

## Impact
- Runtime errors when notifications have invalid timestamp data
- UI crashes in status bar

## Recommended Fix
```javascript
{notifications[currentNotificationIndex]?.timestamp?.toLocaleTimeString?.() || 'Unknown time'}
```

## Priority
Medium - Can cause UI crashes
```

---

### Bug 5: ContentEditor pageData undefined warning indicates race condition

**Title:** `Bug: ContentEditor pageData undefined warning indicates potential race condition`

**Labels:** `bug`, `frontend`, `race-condition`, `medium-priority`

**Body:**
```markdown
## Description
The ContentEditor component shows a warning about pageData being undefined, indicating a potential race condition in component initialization.

## Affected Code
`frontend/src/components/ContentEditor.jsx:32-34`

## Issue
- Component can render before pageData is available
- No loading state or error boundary handling for this case

## Impact
- Component may render incorrectly or crash
- Poor user experience with broken initial states

## Recommended Fix
```javascript
if (pageData === undefined) {
    return <LoadingSpinner />;
}
```

## Priority
Medium - Affects component reliability
```

---

### Bug 6: LayoutRenderer complexity indicates architectural issues

**Title:** `Bug: LayoutRenderer complexity indicates potential architectural issues`

**Labels:** `bug`, `frontend`, `technical-debt`, `refactor`, `high-priority`

**Body:**
```markdown
## Description
The LayoutRenderer.js file shows signs of excessive complexity with multiple console.error/warn statements indicating error-prone code.

## Evidence of Issues
- **File size**: 5,238 lines in a single JavaScript class
- **Error handling**: 30+ console.error/warn statements throughout the file
- **Complex state management**: Multiple Maps, event listeners, caching systems

## Architectural Concerns
- Single Responsibility Principle violation
- Too many concerns mixed in one class
- Difficult to test and maintain

## Recommended Solution
Refactor into smaller, focused modules:
- WidgetManager, SlotManager, UIManager, VersionManager, CacheManager

## Priority
High - Architectural debt affecting maintainability
```

---

### Bug 7: Modal component lacks error handling for callback functions

**Title:** `Bug: Modal component lacks error handling for callback functions`

**Labels:** `bug`, `frontend`, `low-priority`

**Body:**
```markdown
## Description
The Modal component calls `onClose` function without verifying it's actually a function.

## Affected Code
`frontend/src/components/Modal.jsx:16,57,73`

## Impact
- Runtime errors if onClose is undefined/null

## Recommended Fix
```javascript
const handleClose = () => {
    if (typeof onClose === 'function') {
        onClose();
    }
};
```

## Priority
Low - Easy to avoid but should be defensive
```

---

### Bug 8: TreePageManager useEffect hooks may cause infinite loops

**Title:** `Bug: TreePageManager useEffect hooks may cause infinite loops`

**Labels:** `bug`, `frontend`, `performance`, `medium-priority`

**Body:**
```markdown
## Description
The TreePageManager component has multiple useEffect hooks with complex dependencies that could potentially cause infinite re-renders.

## Affected Areas
`frontend/src/components/TreePageManager.jsx` - Lines 168-191

## Potential Issues
- Complex dependency arrays with unstable dependencies
- State updates in effects triggering cascading re-renders

## Impact
- Performance degradation from unnecessary re-renders
- Potential infinite loops crashing the browser

## Recommended Investigation
1. Add console.log statements to track effect executions
2. Use React DevTools Profiler to identify excessive re-renders
3. Review all dependency arrays for stability

## Priority
Medium - Could cause performance issues
``` 