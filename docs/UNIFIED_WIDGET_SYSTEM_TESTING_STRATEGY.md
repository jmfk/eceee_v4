# Unified Widget System Testing Strategy and Migration Plan

## Overview

This document outlines a comprehensive testing strategy and migration plan for the unified widget system in eceee_v4. The strategy ensures zero data loss, maintains performance, and provides a smooth transition from the current system to the unified approach.

## Current Testing Infrastructure

### Backend Testing (Django)
- **Framework**: Django TestCase with comprehensive test suite
- **Coverage**: 30+ test files covering widget system, API endpoints, and data models
- **Key Areas**: Widget registry, API validation, configuration schemas, security
- **Tools**: Django test runner, coverage.py, factory_boy for fixtures

### Frontend Testing (React)
- **Framework**: Vitest + React Testing Library
- **Coverage**: 128/128 tests passing (100% success rate)
- **Key Areas**: Component rendering, API integration, user interactions
- **Tools**: Vitest, jsdom, axios mocking, user-event simulation

## Phase 1: Enhanced Test Infrastructure

### 1.1 Visual Regression Testing Framework

**Implementation**: BackstopJS for visual regression testing

```bash
# Install BackstopJS
npm install --save-dev backstopjs

# Configuration file
cat > backstop.json << 'EOF'
{
  "id": "eceee_v4_widget_system",
  "viewports": [
    {
      "label": "phone",
      "width": 320,
      "height": 480
    },
    {
      "label": "tablet",
      "width": 1024,
      "height": 768
    },
    {
      "label": "desktop",
      "width": 1920,
      "height": 1080
    }
  ],
  "scenarios": [
    {
      "label": "Text Block Widget",
      "url": "http://localhost:3000/test/widgets/text-block",
      "selectors": [".widget-preview"]
    },
    {
      "label": "Image Widget",
      "url": "http://localhost:3000/test/widgets/image",
      "selectors": [".widget-preview"]
    }
  ],
  "paths": {
    "bitmaps_reference": "tests/visual/reference",
    "bitmaps_test": "tests/visual/test",
    "html_report": "tests/visual/report"
  }
}
EOF
```

### 1.2 Widget Test Data Fixtures

**Backend Fixtures** (`backend/fixtures/widget_test_data.json`):

```json
{
  "widget_configurations": {
    "text_block": {
      "valid": {
        "title": "Test Title",
        "content": "<p>Test content</p>",
        "alignment": "left"
      },
      "invalid": {
        "title": "Test Title"
        // Missing required 'content' field
      }
    },
    "image": {
      "valid": {
        "image_url": "https://example.com/image.jpg",
        "alt_text": "Test image",
        "caption": "Test caption"
      },
      "invalid": {
        "image_url": "invalid-url"
        // Missing required 'alt_text'
      }
    }
  }
}
```

**Frontend Test Utilities** (`frontend/src/test/widgetTestUtils.js`):

```javascript
export const createMockWidgetType = (overrides = {}) => ({
  name: "Test Widget",
  slug: "test-widget",
  description: "A test widget for unit testing",
  configurationSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Widget title" },
      content: { type: "string", description: "Widget content" }
    },
    required: ["title"]
  },
  configurationDefaults: {
    title: "Default Title"
  },
  isActive: true,
  ...overrides
});

export const createMockPageWithWidgets = (widgets = []) => ({
  id: 1,
  title: "Test Page",
  slug: "test-page",
  widgets: widgets.map((widget, index) => ({
    id: `widget-${index}`,
    type: widget.type || "Text Block",
    typeSlug: widget.typeSlug || "text-block",
    slot: widget.slot || "main",
    order: index,
    config: widget.config || {}
  }))
});
```

### 1.3 Performance Benchmarking Framework

**Performance Test Suite** (`tests/performance/widget_performance.js`):

```javascript
import { performance } from 'perf_hooks';

class WidgetPerformanceTester {
  constructor() {
    this.benchmarks = new Map();
  }

  async measureWidgetRendering(widgetType, config, iterations = 100) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.renderWidget(widgetType, config);
      const end = performance.now();
      times.push(end - start);
    }
    
    return {
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      p95: this.percentile(times, 0.95)
    };
  }

  percentile(arr, p) {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
}
```

## Phase 2: Comprehensive Unit Tests

### 2.1 Backend Unit Tests

**Enhanced Widget Registry Tests** (`backend/webpages/tests/test_unified_widget_registry.py`):

```python
class UnifiedWidgetRegistryTest(TestCase):
    """Test unified widget registry functionality."""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', 
            password='testpass123'
        )
        self.page = WebPage.objects.create(
            title='Test Page',
            slug='test-page',
            created_by=self.user,
            last_modified_by=self.user
        )
    
    def test_widget_type_discovery(self):
        """Test that all widget types are properly discovered."""
        registry = widget_type_registry
        widget_types = registry.get_all_widgets()
        
        # Ensure core widgets are registered
        core_widgets = ['text-block', 'image', 'button', 'gallery']
        for widget_slug in core_widgets:
            self.assertIn(widget_slug, [w.slug for w in widget_types])
    
    def test_slot_configuration_validation(self):
        """Test unified slot configuration system."""
        config = {
            'slots': {
                'main': {'widgets': []},
                'sidebar': {'widgets': []}
            }
        }
        
        # Test configuration validation
        validator = SlotConfigurationValidator()
        is_valid, errors = validator.validate(config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, {})
    
    def test_widget_inheritance(self):
        """Test widget inheritance from parent pages."""
        parent = WebPage.objects.create(
            title='Parent Page',
            slug='parent',
            created_by=self.user,
            last_modified_by=self.user
        )
        
        child = WebPage.objects.create(
            title='Child Page',
            slug='child',
            parent=parent,
            created_by=self.user,
            last_modified_by=self.user
        )
        
        # Add widget to parent
        parent_version = parent.get_current_version()
        parent_version.widgets = [{
            'id': 'inherited-widget',
            'type': 'Text Block',
            'slot': 'header',
            'config': {'content': 'Inherited content'}
        }]
        parent_version.save()
        
        # Test inheritance
        inherited_widgets = child.get_inherited_widgets()
        self.assertEqual(len(inherited_widgets), 1)
        self.assertEqual(inherited_widgets[0]['config']['content'], 'Inherited content')
```

**API Standardization Tests** (`backend/webpages/tests/test_unified_widget_api.py`):

```python
class UnifiedWidgetAPITest(TestCase):
    """Test standardized widget API endpoints."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        self.page = WebPage.objects.create(
            title='Test Page',
            slug='test-page',
            created_by=self.user,
            last_modified_by=self.user
        )
    
    def test_unified_widget_crud(self):
        """Test unified CRUD operations for widgets."""
        # Create widget
        widget_data = {
            'type': 'text-block',
            'slot': 'main',
            'configuration': {
                'title': 'Test Widget',
                'content': 'Test content'
            }
        }
        
        response = self.client.post(
            f'/api/v1/webpages/{self.page.id}/widgets/',
            widget_data,
            format='json'
        )
        
        self.assertEqual(response.status_code, 201)
        widget_id = response.data['id']
        
        # Read widget
        response = self.client.get(
            f'/api/v1/webpages/{self.page.id}/widgets/{widget_id}/'
        )
        self.assertEqual(response.status_code, 200)
        
        # Update widget
        update_data = {
            'configuration': {
                'title': 'Updated Title',
                'content': 'Updated content'
            }
        }
        
        response = self.client.patch(
            f'/api/v1/webpages/{self.page.id}/widgets/{widget_id}/',
            update_data,
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        
        # Delete widget
        response = self.client.delete(
            f'/api/v1/webpages/{self.page.id}/widgets/{widget_id}/'
        )
        self.assertEqual(response.status_code, 204)
    
    def test_preview_generation_api(self):
        """Test widget preview generation API."""
        config = {
            'title': 'Preview Title',
            'content': '<p>Preview content</p>'
        }
        
        response = self.client.post(
            '/api/v1/widgets/text-block/preview/',
            {'configuration': config},
            format='json'
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('html', response.data)
        self.assertIn('css', response.data)
        self.assertIn('Preview Title', response.data['html'])
```

### 2.2 Frontend Unit Tests

**Unified Content Editor Tests** (`frontend/src/components/__tests__/UnifiedContentEditor.test.jsx`):

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import UnifiedContentEditor from '../UnifiedContentEditor';
import { createMockPageWithWidgets } from '../../test/widgetTestUtils';

describe('UnifiedContentEditor', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
  });

  it('renders page with widgets correctly', async () => {
    const mockPage = createMockPageWithWidgets([
      { type: 'Text Block', config: { title: 'Test Title' } },
      { type: 'Image', config: { alt_text: 'Test Image' } }
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedContentEditor page={mockPage} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });
  });

  it('handles widget operations correctly', async () => {
    const mockOnSave = vi.fn();
    const mockPage = createMockPageWithWidgets([]);

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedContentEditor 
          page={mockPage} 
          onSave={mockOnSave}
        />
      </QueryClientProvider>
    );

    // Test adding widget
    const addButton = screen.getByRole('button', { name: /add widget/i });
    fireEvent.click(addButton);

    // Should open widget library
    await waitFor(() => {
      expect(screen.getByText('Widget Library')).toBeInTheDocument();
    });
  });

  it('validates widget configurations', async () => {
    const invalidWidget = {
      type: 'Text Block',
      config: { title: 'Test' } // Missing required content
    };

    const mockPage = createMockPageWithWidgets([invalidWidget]);

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedContentEditor page={mockPage} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/content is required/i)).toBeInTheDocument();
    });
  });
});
```

## Phase 3: Integration Tests

### 3.1 End-to-End Page Editor Tests

**Page Editor Integration Test** (`tests/integration/page_editor_integration.test.js`):

```javascript
import { test, expect } from '@playwright/test';

test.describe('Unified Widget System Integration', () => {
  test('complete page editing workflow', async ({ page }) => {
    // Navigate to page editor
    await page.goto('http://localhost:3000/pages/1/edit');
    
    // Wait for editor to load
    await page.waitForSelector('[data-testid="page-editor"]');
    
    // Add a text block widget
    await page.click('[data-testid="add-widget-button"]');
    await page.click('[data-testid="widget-text-block"]');
    
    // Configure the widget
    await page.fill('[data-testid="widget-title"]', 'Integration Test Title');
    await page.fill('[data-testid="widget-content"]', 'Integration test content');
    
    // Save widget
    await page.click('[data-testid="save-widget"]');
    
    // Verify widget appears in editor
    await expect(page.locator('[data-testid="widget-preview"]')).toContainText('Integration Test Title');
    
    // Save page
    await page.click('[data-testid="save-page"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('widget inheritance from parent pages', async ({ page }) => {
    // Create parent page with widget
    await page.goto('http://localhost:3000/pages/create');
    await page.fill('[data-testid="page-title"]', 'Parent Page');
    await page.fill('[data-testid="page-slug"]', 'parent-page');
    
    // Add widget to parent
    await page.click('[data-testid="add-widget-button"]');
    await page.click('[data-testid="widget-text-block"]');
    await page.fill('[data-testid="widget-title"]', 'Inherited Widget');
    await page.click('[data-testid="save-widget"]');
    await page.click('[data-testid="save-page"]');
    
    // Create child page
    await page.goto('http://localhost:3000/pages/create');
    await page.fill('[data-testid="page-title"]', 'Child Page');
    await page.fill('[data-testid="page-slug"]', 'child-page');
    await page.selectOption('[data-testid="parent-page-select"]', 'Parent Page');
    
    // Verify inherited widget appears
    await expect(page.locator('[data-testid="inherited-widgets"]')).toContainText('Inherited Widget');
  });
});
```

### 3.2 API Compatibility Layer Tests

**Backward Compatibility Tests** (`backend/webpages/tests/test_api_compatibility.py`):

```python
class APICompatibilityTest(TestCase):
    """Test backward compatibility with existing API clients."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_legacy_widget_api_still_works(self):
        """Test that legacy API endpoints still function."""
        # Test legacy widget creation endpoint
        response = self.client.post('/api/webpages/widgets/', {
            'widget_type': 'text_block',  # Old format
            'configuration': {'content': 'Test'}
        })
        
        # Should still work with compatibility layer
        self.assertEqual(response.status_code, 201)
    
    def test_new_unified_api_works(self):
        """Test that new unified API works correctly."""
        response = self.client.post('/api/v1/widgets/', {
            'type': 'text-block',  # New format
            'configuration': {'content': 'Test'}
        })
        
        self.assertEqual(response.status_code, 201)
```

## Phase 4: Visual Regression Tests

### 4.1 BackstopJS Configuration

**Visual Test Scenarios** (`tests/visual/scenarios.js`):

```javascript
const scenarios = [
  {
    label: 'Text Block Widget - Default',
    url: 'http://localhost:3000/test/widgets/text-block?config=default',
    selectors: ['.widget-container'],
    delay: 1000
  },
  {
    label: 'Text Block Widget - Center Aligned',
    url: 'http://localhost:3000/test/widgets/text-block?config=center',
    selectors: ['.widget-container']
  },
  {
    label: 'Image Widget - With Caption',
    url: 'http://localhost:3000/test/widgets/image?config=with-caption',
    selectors: ['.widget-container']
  },
  {
    label: 'Gallery Widget - Grid Layout',
    url: 'http://localhost:3000/test/widgets/gallery?config=grid',
    selectors: ['.widget-container']
  },
  {
    label: 'Page Editor - Empty State',
    url: 'http://localhost:3000/pages/new',
    selectors: ['[data-testid="page-editor"]']
  },
  {
    label: 'Page Editor - With Widgets',
    url: 'http://localhost:3000/pages/1/edit',
    selectors: ['[data-testid="page-editor"]']
  }
];

module.exports = { scenarios };
```

### 4.2 Visual Test Runner

**Test Runner Script** (`scripts/run-visual-tests.js`):

```javascript
const backstop = require('backstopjs');
const { scenarios } = require('../tests/visual/scenarios');

async function runVisualTests() {
  const config = {
    id: 'eceee_v4_unified_widgets',
    viewports: [
      { label: 'phone', width: 320, height: 568 },
      { label: 'tablet', width: 1024, height: 768 },
      { label: 'desktop', width: 1920, height: 1080 }
    ],
    scenarios,
    paths: {
      bitmaps_reference: 'tests/visual/reference',
      bitmaps_test: 'tests/visual/test',
      html_report: 'tests/visual/report'
    },
    engine: 'puppeteer',
    engineOptions: {
      args: ['--no-sandbox']
    }
  };

  try {
    await backstop('test', { config });
    console.log('✅ All visual tests passed!');
  } catch (error) {
    console.error('❌ Visual regression detected:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runVisualTests();
}
```

## Phase 5: Performance Tests

### 5.1 Widget Performance Benchmarks

**Performance Test Suite** (`tests/performance/widget_benchmarks.js`):

```javascript
import { performance } from 'perf_hooks';
import puppeteer from 'puppeteer';

class WidgetPerformanceBenchmarks {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async setup() {
    this.browser = await puppeteer.launch();
    this.page = await this.browser.newPage();
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async measureEditorLoadTime() {
    const start = performance.now();
    
    await this.page.goto('http://localhost:3000/pages/1/edit');
    await this.page.waitForSelector('[data-testid="page-editor"]');
    
    const end = performance.now();
    return end - start;
  }

  async measureWidgetOperationPerformance() {
    await this.page.goto('http://localhost:3000/pages/1/edit');
    
    const metrics = {};
    
    // Measure widget addition
    const addStart = performance.now();
    await this.page.click('[data-testid="add-widget-button"]');
    await this.page.waitForSelector('[data-testid="widget-library"]');
    metrics.widgetLibraryLoad = performance.now() - addStart;
    
    // Measure widget selection
    const selectStart = performance.now();
    await this.page.click('[data-testid="widget-text-block"]');
    await this.page.waitForSelector('[data-testid="widget-config-form"]');
    metrics.widgetConfigLoad = performance.now() - selectStart;
    
    return metrics;
  }

  async measurePreviewGeneration() {
    const config = {
      title: 'Performance Test',
      content: 'Test content for performance measurement'
    };
    
    const start = performance.now();
    
    const response = await fetch('http://localhost:8000/api/v1/widgets/text-block/preview/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configuration: config })
    });
    
    await response.json();
    
    return performance.now() - start;
  }
}

// Run benchmarks
async function runBenchmarks() {
  const benchmarks = new WidgetPerformanceBenchmarks();
  
  try {
    await benchmarks.setup();
    
    const results = {
      editorLoadTime: await benchmarks.measureEditorLoadTime(),
      widgetOperations: await benchmarks.measureWidgetOperationPerformance(),
      previewGeneration: await benchmarks.measurePreviewGeneration()
    };
    
    console.log('Performance Benchmark Results:', results);
    
    // Assert performance requirements
    if (results.editorLoadTime > 3000) {
      throw new Error(`Editor load time too slow: ${results.editorLoadTime}ms`);
    }
    
    if (results.previewGeneration > 1000) {
      throw new Error(`Preview generation too slow: ${results.previewGeneration}ms`);
    }
    
    console.log('✅ All performance benchmarks passed!');
    
  } finally {
    await benchmarks.teardown();
  }
}
```

## Phase 6: Migration Plan

### 6.1 Data Migration Scripts

**Widget Configuration Migration** (`backend/webpages/management/commands/migrate_widget_configs.py`):

```python
from django.core.management.base import BaseCommand
from django.db import transaction
from webpages.models import WebPage, PageVersion
from webpages.widget_registry import widget_type_registry
import json
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Migrate existing widget configurations to unified system'
    
    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', 
                          help='Show what would be migrated without making changes')
        parser.add_argument('--batch-size', type=int, default=100,
                          help='Number of pages to process in each batch')
    
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        batch_size = options['batch_size']
        
        if dry_run:
            self.stdout.write('🔍 DRY RUN MODE - No changes will be made')
        
        # Get all pages with widgets
        pages_with_widgets = WebPage.objects.filter(
            versions__widgets__isnull=False
        ).distinct()
        
        total_pages = pages_with_widgets.count()
        self.stdout.write(f'Found {total_pages} pages with widgets to migrate')
        
        migrated_count = 0
        error_count = 0
        
        for i in range(0, total_pages, batch_size):
            batch = pages_with_widgets[i:i + batch_size]
            
            with transaction.atomic():
                for page in batch:
                    try:
                        if self.migrate_page_widgets(page, dry_run):
                            migrated_count += 1
                    except Exception as e:
                        error_count += 1
                        logger.error(f'Failed to migrate page {page.id}: {e}')
                        if not dry_run:
                            # Rollback this page only
                            transaction.set_rollback(True)
                            continue
            
            self.stdout.write(f'Processed batch {i//batch_size + 1}')
        
        self.stdout.write(
            f'Migration complete: {migrated_count} pages migrated, '
            f'{error_count} errors'
        )
    
    def migrate_page_widgets(self, page, dry_run=False):
        """Migrate widgets for a single page."""
        current_version = page.get_current_version()
        
        if not current_version or not current_version.widgets:
            return False
        
        migrated_widgets = []
        migration_needed = False
        
        for widget_data in current_version.widgets:
            # Check if widget needs migration
            if self.needs_migration(widget_data):
                migrated_widget = self.migrate_widget_data(widget_data)
                migrated_widgets.append(migrated_widget)
                migration_needed = True
            else:
                migrated_widgets.append(widget_data)
        
        if migration_needed and not dry_run:
            current_version.widgets = migrated_widgets
            current_version.save()
            
            self.stdout.write(f'✅ Migrated page: {page.title} (ID: {page.id})')
        elif migration_needed:
            self.stdout.write(f'🔄 Would migrate page: {page.title} (ID: {page.id})')
        
        return migration_needed
    
    def needs_migration(self, widget_data):
        """Check if widget data needs migration."""
        # Check for old format indicators
        old_format_keys = ['widget_type_id', 'json_config', 'legacy_config']
        return any(key in widget_data for key in old_format_keys)
    
    def migrate_widget_data(self, widget_data):
        """Migrate individual widget data to new format."""
        migrated = widget_data.copy()
        
        # Migrate widget type reference
        if 'widget_type_id' in widget_data:
            # Convert old DB ID to new slug-based reference
            widget_type = self.get_widget_type_by_id(widget_data['widget_type_id'])
            if widget_type:
                migrated['type'] = widget_type.name
                migrated['type_slug'] = widget_type.slug
                del migrated['widget_type_id']
        
        # Migrate configuration format
        if 'json_config' in widget_data:
            migrated['config'] = json.loads(widget_data['json_config'])
            del migrated['json_config']
        
        # Ensure required fields exist
        if 'id' not in migrated:
            migrated['id'] = f"widget-{hash(str(widget_data))}"
        
        if 'slot' not in migrated:
            migrated['slot'] = 'main'  # Default slot
        
        if 'order' not in migrated:
            migrated['order'] = 0
        
        return migrated
    
    def get_widget_type_by_id(self, widget_type_id):
        """Get widget type by old database ID."""
        # This would map old IDs to new widget types
        # Implementation depends on your specific migration needs
        id_to_slug_map = {
            1: 'text-block',
            2: 'image',
            3: 'button',
            # ... add other mappings
        }
        
        slug = id_to_slug_map.get(widget_type_id)
        if slug:
            return widget_type_registry.get_widget(slug)
        
        return None
```

### 6.2 Rollback Mechanism

**Rollback Command** (`backend/webpages/management/commands/rollback_widget_migration.py`):

```python
from django.core.management.base import BaseCommand
from django.db import transaction
from webpages.models import WebPage, PageVersion
import json

class Command(BaseCommand):
    help = 'Rollback widget migration to previous format'
    
    def add_arguments(self, parser):
        parser.add_argument('--backup-file', required=True,
                          help='Path to backup file created before migration')
        parser.add_argument('--confirm', action='store_true',
                          help='Confirm rollback operation')
    
    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(
                '⚠️  This will rollback all widget migrations. '
                'Use --confirm to proceed.'
            )
            return
        
        backup_file = options['backup_file']
        
        try:
            with open(backup_file, 'r') as f:
                backup_data = json.load(f)
        except FileNotFoundError:
            self.stdout.write(f'❌ Backup file not found: {backup_file}')
            return
        
        self.stdout.write(f'🔄 Rolling back from backup: {backup_file}')
        
        with transaction.atomic():
            rollback_count = 0
            
            for page_data in backup_data['pages']:
                try:
                    page = WebPage.objects.get(id=page_data['id'])
                    current_version = page.get_current_version()
                    
                    if current_version:
                        current_version.widgets = page_data['widgets']
                        current_version.save()
                        rollback_count += 1
                        
                except WebPage.DoesNotExist:
                    self.stdout.write(f'⚠️  Page {page_data["id"]} not found')
                    continue
                except Exception as e:
                    self.stdout.write(f'❌ Error rolling back page {page_data["id"]}: {e}')
                    continue
            
            self.stdout.write(f'✅ Rollback complete: {rollback_count} pages restored')
```

### 6.3 Data Validation Scripts

**Migration Validation** (`backend/webpages/management/commands/validate_widget_migration.py`):

```python
from django.core.management.base import BaseCommand
from webpages.models import WebPage, PageVersion
from webpages.widget_registry import widget_type_registry

class Command(BaseCommand):
    help = 'Validate widget migration results'
    
    def handle(self, *args, **options):
        self.stdout.write('🔍 Validating widget migration...')
        
        validation_results = {
            'total_pages': 0,
            'pages_with_widgets': 0,
            'valid_widgets': 0,
            'invalid_widgets': 0,
            'missing_types': set(),
            'configuration_errors': []
        }
        
        for page in WebPage.objects.all():
            validation_results['total_pages'] += 1
            current_version = page.get_current_version()
            
            if not current_version or not current_version.widgets:
                continue
                
            validation_results['pages_with_widgets'] += 1
            
            for widget_data in current_version.widgets:
                if self.validate_widget(widget_data, validation_results):
                    validation_results['valid_widgets'] += 1
                else:
                    validation_results['invalid_widgets'] += 1
        
        self.print_validation_report(validation_results)
    
    def validate_widget(self, widget_data, results):
        """Validate a single widget."""
        # Check required fields
        required_fields = ['id', 'type', 'slot', 'config']
        for field in required_fields:
            if field not in widget_data:
                results['configuration_errors'].append(
                    f'Missing required field: {field}'
                )
                return False
        
        # Check widget type exists
        widget_type = widget_type_registry.get_widget(widget_data.get('type_slug'))
        if not widget_type:
            results['missing_types'].add(widget_data.get('type', 'Unknown'))
            return False
        
        # Validate configuration
        try:
            widget_type.validate_configuration(widget_data['config'])
        except Exception as e:
            results['configuration_errors'].append(
                f'Configuration error for {widget_data["type"]}: {e}'
            )
            return False
        
        return True
    
    def print_validation_report(self, results):
        """Print validation report."""
        self.stdout.write('\n📊 Migration Validation Report')
        self.stdout.write('=' * 40)
        self.stdout.write(f'Total pages: {results["total_pages"]}')
        self.stdout.write(f'Pages with widgets: {results["pages_with_widgets"]}')
        self.stdout.write(f'Valid widgets: {results["valid_widgets"]}')
        self.stdout.write(f'Invalid widgets: {results["invalid_widgets"]}')
        
        if results['missing_types']:
            self.stdout.write(f'\n❌ Missing widget types:')
            for widget_type in results['missing_types']:
                self.stdout.write(f'  - {widget_type}')
        
        if results['configuration_errors']:
            self.stdout.write(f'\n❌ Configuration errors:')
            for error in results['configuration_errors'][:10]:  # Show first 10
                self.stdout.write(f'  - {error}')
            
            if len(results['configuration_errors']) > 10:
                remaining = len(results['configuration_errors']) - 10
                self.stdout.write(f'  ... and {remaining} more errors')
        
        if results['invalid_widgets'] == 0:
            self.stdout.write('\n✅ All widgets are valid!')
        else:
            self.stdout.write(f'\n⚠️  {results["invalid_widgets"]} widgets need attention')
```

## Phase 7: Deployment Strategy

### 7.1 Phased Deployment Plan

**Phase 1: Backend Changes with Compatibility Layer**
1. Deploy unified widget registry
2. Deploy new API endpoints alongside old ones
3. Maintain backward compatibility
4. Monitor API usage patterns

**Phase 2: Frontend Components Deployment**
1. Deploy React components alongside existing UI
2. Use feature flags to control access
3. A/B test with selected users
4. Monitor performance metrics

**Phase 3: Gradual Migration**
1. Enable unified editor for new pages
2. Migrate existing pages in batches
3. Monitor error rates and performance
4. Collect user feedback

**Phase 4: Full Rollout**
1. Switch all users to unified system
2. Deprecate old API endpoints
3. Remove compatibility layer after validation period

### 7.2 Feature Flags Configuration

**Feature Flags** (`backend/config/feature_flags.py`):

```python
from django.conf import settings

class FeatureFlags:
    @classmethod
    def is_unified_widgets_enabled(cls, user=None):
        """Check if unified widget system is enabled."""
        if settings.DEBUG:
            return True  # Always enabled in development
        
        # Check user-specific flags
        if user and hasattr(user, 'feature_flags'):
            return user.feature_flags.get('unified_widgets', False)
        
        # Check global rollout percentage
        rollout_percentage = getattr(settings, 'UNIFIED_WIDGETS_ROLLOUT', 0)
        if rollout_percentage >= 100:
            return True
        
        # Use user ID for consistent experience
        if user:
            user_hash = hash(str(user.id)) % 100
            return user_hash < rollout_percentage
        
        return False
    
    @classmethod
    def is_legacy_api_enabled(cls):
        """Check if legacy API should still be available."""
        return getattr(settings, 'ENABLE_LEGACY_WIDGET_API', True)
```

## Phase 8: Success Metrics and Monitoring

### 8.1 Success Criteria

**Technical Metrics:**
- Zero data loss during migration
- No increase in error rates (< 0.1%)
- Performance maintained or improved (< 10% regression)
- Test coverage maintained (≥ 80% frontend, ≥ 85% backend)

**User Experience Metrics:**
- Page load time ≤ 3 seconds
- Widget operation response time ≤ 1 second
- User satisfaction score ≥ 4.0/5.0
- Support ticket reduction by 20%

### 8.2 Monitoring and Alerting

**Performance Monitoring** (`monitoring/widget_performance.py`):

```python
import time
import logging
from functools import wraps
from django.core.cache import cache

logger = logging.getLogger('widget_performance')

def monitor_widget_operation(operation_name):
    """Decorator to monitor widget operation performance."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                
                # Record success
                duration = time.time() - start_time
                cache.set(f'widget_perf_{operation_name}_last', duration, 300)
                
                # Log slow operations
                if duration > 2.0:
                    logger.warning(f'Slow {operation_name}: {duration:.2f}s')
                
                return result
                
            except Exception as e:
                # Record error
                cache.incr(f'widget_errors_{operation_name}', delta=1)
                logger.error(f'Error in {operation_name}: {e}')
                raise
                
        return wrapper
    return decorator

# Usage in views
@monitor_widget_operation('widget_preview')
def generate_widget_preview(request, widget_type_slug):
    # Implementation here
    pass
```

## Timeline

**Week 1: Test Infrastructure Setup**
- Set up visual regression testing
- Create test fixtures and utilities
- Implement performance benchmarking

**Week 2: Comprehensive Test Suite**
- Backend unit tests
- Frontend component tests
- Integration tests

**Week 3: Migration Scripts and Validation**
- Data migration utilities
- Rollback mechanisms
- Validation scripts

**Week 4: Deployment and Monitoring**
- Feature flags implementation
- Monitoring setup
- Documentation completion

## Risk Mitigation

**High Risk Areas:**
1. **Data Migration Corruption**
   - Mitigation: Extensive testing on production data copies, atomic transactions, rollback capability

2. **Performance Degradation**
   - Mitigation: Performance benchmarking, gradual rollout, monitoring

3. **API Breaking Changes**
   - Mitigation: Compatibility layer, versioned APIs, feature flags

4. **User Experience Disruption**
   - Mitigation: A/B testing, user feedback collection, training materials

## Conclusion

This comprehensive testing strategy and migration plan ensures a smooth transition to the unified widget system while maintaining data integrity, performance, and user experience. The phased approach allows for careful validation at each step and provides multiple rollback options if issues arise.
