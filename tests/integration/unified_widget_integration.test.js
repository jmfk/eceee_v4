/**
 * Integration Tests for Unified Widget System
 * 
 * These tests verify end-to-end functionality of the unified widget system
 * including page editor, object editor, and API integration.
 * 
 * Uses Playwright for browser automation and real API testing.
 */

import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

// Test data
const TEST_USER = {
    username: 'testuser',
    password: 'testpass123',
    email: 'test@example.com'
};

const SAMPLE_WIDGETS = {
    textBlock: {
        type: 'text-block',
        config: {
            title: 'Integration Test Title',
            content: '<p>This is integration test content</p>',
            alignment: 'left'
        }
    },
    image: {
        type: 'image',
        config: {
            image_url: 'https://via.placeholder.com/400x300',
            alt_text: 'Integration test image',
            caption: 'Test image caption'
        }
    },
    button: {
        type: 'button',
        config: {
            text: 'Test Button',
            url: 'https://example.com',
            style: 'primary'
        }
    }
};

test.describe('Unified Widget System Integration', () => {
    test.beforeEach(async ({ page }) => {
        // Set up authentication
        await page.goto(`${BASE_URL}/login`);
        await page.fill('[data-testid="username"]', TEST_USER.username);
        await page.fill('[data-testid="password"]', TEST_USER.password);
        await page.click('[data-testid="login-button"]');

        // Wait for login to complete
        await page.waitForURL(`${BASE_URL}/dashboard`);
    });

    test.describe('Page Editor Integration', () => {
        test('complete page editing workflow', async ({ page }) => {
            // Navigate to page editor
            await page.goto(`${BASE_URL}/pages/create`);
            await page.waitForSelector('[data-testid="page-editor"]');

            // Create new page
            await page.fill('[data-testid="page-title"]', 'Integration Test Page');
            await page.fill('[data-testid="page-slug"]', 'integration-test-page');

            // Add text block widget
            await page.click('[data-testid="add-widget-button"]');
            await page.waitForSelector('[data-testid="widget-library"]');
            await page.click('[data-testid="widget-text-block"]');

            // Configure text block
            await page.waitForSelector('[data-testid="widget-config-form"]');
            await page.fill('[data-testid="title-input"]', SAMPLE_WIDGETS.textBlock.config.title);
            await page.fill('[data-testid="content-input"]', SAMPLE_WIDGETS.textBlock.config.content);
            await page.selectOption('[data-testid="alignment-select"]', SAMPLE_WIDGETS.textBlock.config.alignment);

            // Save widget configuration
            await page.click('[data-testid="save-widget-config"]');

            // Verify widget appears in editor
            await page.waitForSelector('[data-testid="widget-preview"]');
            await expect(page.locator('[data-testid="widget-preview"]')).toContainText(SAMPLE_WIDGETS.textBlock.config.title);

            // Add image widget
            await page.click('[data-testid="add-widget-button"]');
            await page.click('[data-testid="widget-image"]');

            // Configure image widget
            await page.fill('[data-testid="image-url-input"]', SAMPLE_WIDGETS.image.config.image_url);
            await page.fill('[data-testid="alt-text-input"]', SAMPLE_WIDGETS.image.config.alt_text);
            await page.fill('[data-testid="caption-input"]', SAMPLE_WIDGETS.image.config.caption);
            await page.click('[data-testid="save-widget-config"]');

            // Verify both widgets are present
            const widgets = page.locator('[data-testid^="widget-preview-"]');
            await expect(widgets).toHaveCount(2);

            // Save page
            await page.click('[data-testid="save-page"]');

            // Verify success message
            await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
            await expect(page.locator('[data-testid="success-message"]')).toContainText('Page saved successfully');

            // Verify page was created in database
            const response = await page.request.get(`${API_BASE_URL}/api/v1/webpages/`);
            const pages = await response.json();
            const createdPage = pages.find(p => p.slug === 'integration-test-page');

            expect(createdPage).toBeTruthy();
            expect(createdPage.title).toBe('Integration Test Page');
            expect(createdPage.widgets).toHaveLength(2);
        });

        test('widget reordering functionality', async ({ page }) => {
            // Create page with multiple widgets
            await page.goto(`${BASE_URL}/pages/create`);
            await page.fill('[data-testid="page-title"]', 'Reorder Test Page');
            await page.fill('[data-testid="page-slug"]', 'reorder-test-page');

            // Add three text widgets
            for (let i = 1; i <= 3; i++) {
                await page.click('[data-testid="add-widget-button"]');
                await page.click('[data-testid="widget-text-block"]');
                await page.fill('[data-testid="title-input"]', `Widget ${i}`);
                await page.fill('[data-testid="content-input"]', `Content ${i}`);
                await page.click('[data-testid="save-widget-config"]');
            }

            // Verify initial order
            const initialWidgets = await page.locator('[data-testid^="widget-preview-"]').allTextContents();
            expect(initialWidgets[0]).toContain('Widget 1');
            expect(initialWidgets[1]).toContain('Widget 2');
            expect(initialWidgets[2]).toContain('Widget 3');

            // Drag and drop to reorder (move Widget 3 to first position)
            await page.dragAndDrop(
                '[data-testid="widget-preview-widget-3"]',
                '[data-testid="widget-preview-widget-1"]'
            );

            // Verify new order
            await page.waitForTimeout(1000); // Allow for reordering animation
            const reorderedWidgets = await page.locator('[data-testid^="widget-preview-"]').allTextContents();
            expect(reorderedWidgets[0]).toContain('Widget 3');
            expect(reorderedWidgets[1]).toContain('Widget 1');
            expect(reorderedWidgets[2]).toContain('Widget 2');

            // Save page and verify order persists
            await page.click('[data-testid="save-page"]');
            await page.reload();

            const persistedWidgets = await page.locator('[data-testid^="widget-preview-"]').allTextContents();
            expect(persistedWidgets[0]).toContain('Widget 3');
            expect(persistedWidgets[1]).toContain('Widget 1');
            expect(persistedWidgets[2]).toContain('Widget 2');
        });

        test('widget inheritance from parent pages', async ({ page }) => {
            // Create parent page with widget
            await page.goto(`${BASE_URL}/pages/create`);
            await page.fill('[data-testid="page-title"]', 'Parent Page');
            await page.fill('[data-testid="page-slug"]', 'parent-page');

            // Add inheritable widget
            await page.click('[data-testid="add-widget-button"]');
            await page.click('[data-testid="widget-text-block"]');
            await page.fill('[data-testid="title-input"]', 'Inherited Widget');
            await page.fill('[data-testid="content-input"]', 'This widget will be inherited');
            await page.check('[data-testid="inherit-checkbox"]'); // Mark as inheritable
            await page.click('[data-testid="save-widget-config"]');

            await page.click('[data-testid="save-page"]');
            await page.waitForSelector('[data-testid="success-message"]');

            // Create child page
            await page.goto(`${BASE_URL}/pages/create`);
            await page.fill('[data-testid="page-title"]', 'Child Page');
            await page.fill('[data-testid="page-slug"]', 'child-page');
            await page.selectOption('[data-testid="parent-page-select"]', 'Parent Page');

            // Verify inherited widget appears
            await page.waitForSelector('[data-testid="inherited-widgets"]');
            await expect(page.locator('[data-testid="inherited-widgets"]')).toContainText('Inherited Widget');

            // Override inherited widget
            await page.click('[data-testid="override-inherited-widget"]');
            await page.fill('[data-testid="title-input"]', 'Overridden Widget');
            await page.click('[data-testid="save-widget-config"]');

            // Verify override
            await expect(page.locator('[data-testid="widget-preview"]')).toContainText('Overridden Widget');

            // Save child page
            await page.click('[data-testid="save-page"]');

            // Verify inheritance in database
            const response = await page.request.get(`${API_BASE_URL}/api/v1/webpages/`);
            const pages = await response.json();
            const childPage = pages.find(p => p.slug === 'child-page');

            expect(childPage.widgets[0].inherited_from).toBeTruthy();
            expect(childPage.widgets[0].overridden).toBe(true);
        });

        test('slot management functionality', async ({ page }) => {
            // Create page with two-column layout
            await page.goto(`${BASE_URL}/pages/create`);
            await page.fill('[data-testid="page-title"]', 'Slot Test Page');
            await page.fill('[data-testid="page-slug"]', 'slot-test-page');
            await page.selectOption('[data-testid="layout-select"]', 'two-column');

            // Add widget to main slot
            await page.click('[data-testid="add-widget-main"]');
            await page.click('[data-testid="widget-text-block"]');
            await page.fill('[data-testid="title-input"]', 'Main Content');
            await page.click('[data-testid="save-widget-config"]');

            // Add widget to sidebar slot
            await page.click('[data-testid="add-widget-sidebar"]');
            await page.click('[data-testid="widget-text-block"]');
            await page.fill('[data-testid="title-input"]', 'Sidebar Content');
            await page.click('[data-testid="save-widget-config"]');

            // Verify widgets are in correct slots
            const mainSlot = page.locator('[data-testid="slot-main"]');
            const sidebarSlot = page.locator('[data-testid="slot-sidebar"]');

            await expect(mainSlot).toContainText('Main Content');
            await expect(sidebarSlot).toContainText('Sidebar Content');

            // Move widget between slots
            await page.dragAndDrop(
                '[data-testid="slot-main"] [data-testid^="widget-preview-"]',
                '[data-testid="slot-sidebar"]'
            );

            // Verify widget moved
            await expect(sidebarSlot).toContainText('Main Content');
            await expect(sidebarSlot).toContainText('Sidebar Content');

            // Save and verify persistence
            await page.click('[data-testid="save-page"]');
            await page.reload();

            const reloadedSidebar = page.locator('[data-testid="slot-sidebar"]');
            await expect(reloadedSidebar).toContainText('Main Content');
            await expect(reloadedSidebar).toContainText('Sidebar Content');
        });
    });

    test.describe('Object Editor Integration', () => {
        test('object editor with widget system', async ({ page }) => {
            // Navigate to object editor
            await page.goto(`${BASE_URL}/objects/create`);
            await page.waitForSelector('[data-testid="object-editor"]');

            // Create new object
            await page.fill('[data-testid="object-title"]', 'Test Object');
            await page.selectOption('[data-testid="object-type"]', 'article');

            // Add content widgets to object
            await page.click('[data-testid="add-content-widget"]');
            await page.click('[data-testid="widget-text-block"]');
            await page.fill('[data-testid="title-input"]', 'Object Content Title');
            await page.fill('[data-testid="content-input"]', 'Object content text');
            await page.click('[data-testid="save-widget-config"]');

            // Verify widget in object editor
            await expect(page.locator('[data-testid="object-content-preview"]')).toContainText('Object Content Title');

            // Save object
            await page.click('[data-testid="save-object"]');
            await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

            // Verify object was created with widgets
            const response = await page.request.get(`${API_BASE_URL}/api/v1/objects/`);
            const objects = await response.json();
            const createdObject = objects.find(o => o.title === 'Test Object');

            expect(createdObject).toBeTruthy();
            expect(createdObject.content_widgets).toHaveLength(1);
        });

        test('object widget inheritance and overrides', async ({ page }) => {
            // Create object type with default widgets
            await page.goto(`${BASE_URL}/objects/types/create`);
            await page.fill('[data-testid="type-name"]', 'Product');
            await page.fill('[data-testid="type-slug"]', 'product');

            // Add default widget to object type
            await page.click('[data-testid="add-default-widget"]');
            await page.click('[data-testid="widget-text-block"]');
            await page.fill('[data-testid="title-input"]', 'Product Description');
            await page.fill('[data-testid="content-input"]', 'Default product description');
            await page.check('[data-testid="inherit-checkbox"]');
            await page.click('[data-testid="save-widget-config"]');

            await page.click('[data-testid="save-object-type"]');

            // Create object instance
            await page.goto(`${BASE_URL}/objects/create`);
            await page.selectOption('[data-testid="object-type"]', 'Product');
            await page.fill('[data-testid="object-title"]', 'Specific Product');

            // Verify inherited widget
            await expect(page.locator('[data-testid="inherited-widgets"]')).toContainText('Product Description');

            // Override inherited widget
            await page.click('[data-testid="override-inherited-widget"]');
            await page.fill('[data-testid="content-input"]', 'Specific product description');
            await page.click('[data-testid="save-widget-config"]');

            // Save object
            await page.click('[data-testid="save-object"]');

            // Verify override in preview
            await page.goto(`${BASE_URL}/objects/specific-product/preview`);
            await expect(page.locator('[data-testid="object-preview"]')).toContainText('Specific product description');
        });
    });

    test.describe('Widget Preview System', () => {
        test('real-time widget preview updates', async ({ page }) => {
            await page.goto(`${BASE_URL}/pages/create`);
            await page.fill('[data-testid="page-title"]', 'Preview Test Page');

            // Add widget and configure
            await page.click('[data-testid="add-widget-button"]');
            await page.click('[data-testid="widget-text-block"]');

            // Test real-time preview updates
            await page.fill('[data-testid="title-input"]', 'Initial Title');

            // Wait for preview to update
            await page.waitForSelector('[data-testid="widget-preview"]');
            await expect(page.locator('[data-testid="widget-preview"]')).toContainText('Initial Title');

            // Update title and verify preview updates
            await page.fill('[data-testid="title-input"]', 'Updated Title');
            await page.waitForTimeout(500); // Debounce delay
            await expect(page.locator('[data-testid="widget-preview"]')).toContainText('Updated Title');

            // Update content and verify
            await page.fill('[data-testid="content-input"]', 'Updated content text');
            await page.waitForTimeout(500);
            await expect(page.locator('[data-testid="widget-preview"]')).toContainText('Updated content text');

            // Change alignment and verify visual change
            await page.selectOption('[data-testid="alignment-select"]', 'center');
            await page.waitForTimeout(500);

            // Check that preview has center alignment class
            const previewElement = page.locator('[data-testid="widget-preview"] .widget-content');
            await expect(previewElement).toHaveClass(/text-center/);
        });

        test('preview accuracy compared to published version', async ({ page }) => {
            // Create and save page
            await page.goto(`${BASE_URL}/pages/create`);
            await page.fill('[data-testid="page-title"]', 'Preview Accuracy Test');
            await page.fill('[data-testid="page-slug"]', 'preview-accuracy-test');

            await page.click('[data-testid="add-widget-button"]');
            await page.click('[data-testid="widget-text-block"]');
            await page.fill('[data-testid="title-input"]', 'Accuracy Test Title');
            await page.fill('[data-testid="content-input"]', '<p><strong>Bold text</strong> and <em>italic text</em></p>');
            await page.selectOption('[data-testid="alignment-select"]', 'center');
            await page.click('[data-testid="save-widget-config"]');

            // Capture preview content
            const previewContent = await page.locator('[data-testid="widget-preview"]').innerHTML();

            await page.click('[data-testid="save-page"]');
            await page.click('[data-testid="publish-page"]');

            // View published page
            await page.goto(`${BASE_URL}/pages/preview-accuracy-test`);
            const publishedContent = await page.locator('[data-testid="page-content"] .widget').innerHTML();

            // Compare preview and published content
            expect(previewContent).toContain('Accuracy Test Title');
            expect(publishedContent).toContain('Accuracy Test Title');
            expect(previewContent).toContain('<strong>Bold text</strong>');
            expect(publishedContent).toContain('<strong>Bold text</strong>');
            expect(previewContent).toContain('<em>italic text</em>');
            expect(publishedContent).toContain('<em>italic text</em>');
        });

        test('preview performance with complex widgets', async ({ page }) => {
            await page.goto(`${BASE_URL}/pages/create`);
            await page.fill('[data-testid="page-title"]', 'Performance Test Page');

            // Add gallery widget with many images
            await page.click('[data-testid="add-widget-button"]');
            await page.click('[data-testid="widget-gallery"]');

            // Add multiple images
            const imageUrls = Array.from({ length: 20 }, (_, i) =>
                `https://via.placeholder.com/300x200?text=Image${i + 1}`
            );

            for (const imageUrl of imageUrls) {
                await page.click('[data-testid="add-gallery-image"]');
                await page.fill('[data-testid="image-url-input"]', imageUrl);
                await page.click('[data-testid="add-image-button"]');
            }

            // Measure preview generation time
            const startTime = Date.now();
            await page.click('[data-testid="save-widget-config"]');

            // Wait for preview to load
            await page.waitForSelector('[data-testid="widget-preview"] .gallery-container');
            const endTime = Date.now();

            const previewTime = endTime - startTime;

            // Preview should generate within reasonable time (< 3 seconds)
            expect(previewTime).toBeLessThan(3000);

            // Verify all images are in preview
            const previewImages = await page.locator('[data-testid="widget-preview"] img').count();
            expect(previewImages).toBe(20);
        });
    });

    test.describe('API Integration', () => {
        test('widget CRUD operations via API', async ({ page }) => {
            // Create page first
            const pageResponse = await page.request.post(`${API_BASE_URL}/api/v1/webpages/`, {
                data: {
                    title: 'API Test Page',
                    slug: 'api-test-page',
                    layout: 'single-column'
                }
            });

            const pageData = await pageResponse.json();
            const pageId = pageData.id;

            // CREATE: Add widget via API
            const createResponse = await page.request.post(`${API_BASE_URL}/api/v1/webpages/${pageId}/widgets/`, {
                data: {
                    type: 'text-block',
                    slot: 'main',
                    configuration: {
                        title: 'API Created Widget',
                        content: 'Created via API',
                        alignment: 'left'
                    }
                }
            });

            expect(createResponse.status()).toBe(201);
            const widgetData = await createResponse.json();
            const widgetId = widgetData.id;

            // READ: Get widget via API
            const readResponse = await page.request.get(`${API_BASE_URL}/api/v1/webpages/${pageId}/widgets/${widgetId}/`);
            expect(readResponse.status()).toBe(200);

            const readData = await readResponse.json();
            expect(readData.config.title).toBe('API Created Widget');

            // UPDATE: Modify widget via API
            const updateResponse = await page.request.patch(`${API_BASE_URL}/api/v1/webpages/${pageId}/widgets/${widgetId}/`, {
                data: {
                    configuration: {
                        title: 'API Updated Widget',
                        content: 'Updated via API',
                        alignment: 'center'
                    }
                }
            });

            expect(updateResponse.status()).toBe(200);
            const updateData = await updateResponse.json();
            expect(updateData.config.title).toBe('API Updated Widget');

            // DELETE: Remove widget via API
            const deleteResponse = await page.request.delete(`${API_BASE_URL}/api/v1/webpages/${pageId}/widgets/${widgetId}/`);
            expect(deleteResponse.status()).toBe(204);

            // Verify deletion
            const verifyResponse = await page.request.get(`${API_BASE_URL}/api/v1/webpages/${pageId}/widgets/${widgetId}/`);
            expect(verifyResponse.status()).toBe(404);
        });

        test('widget validation via API', async ({ page }) => {
            // Test valid configuration
            const validResponse = await page.request.post(`${API_BASE_URL}/api/v1/widgets/types/text-block/validate/`, {
                data: {
                    configuration: {
                        title: 'Valid Title',
                        content: 'Valid content',
                        alignment: 'left'
                    }
                }
            });

            expect(validResponse.status()).toBe(200);
            const validData = await validResponse.json();
            expect(validData.is_valid).toBe(true);
            expect(validData.errors).toEqual({});

            // Test invalid configuration
            const invalidResponse = await page.request.post(`${API_BASE_URL}/api/v1/widgets/types/text-block/validate/`, {
                data: {
                    configuration: {
                        title: 'Valid Title',
                        // Missing required 'content' field
                        alignment: 'invalid-alignment'
                    }
                }
            });

            expect(invalidResponse.status()).toBe(200);
            const invalidData = await invalidResponse.json();
            expect(invalidData.is_valid).toBe(false);
            expect(invalidData.errors.content).toBeTruthy();
            expect(invalidData.errors.alignment).toBeTruthy();
        });

        test('widget preview generation via API', async ({ page }) => {
            const previewResponse = await page.request.post(`${API_BASE_URL}/api/v1/widgets/types/text-block/preview/`, {
                data: {
                    configuration: {
                        title: 'Preview Test',
                        content: '<p>Preview content with <strong>HTML</strong></p>',
                        alignment: 'center'
                    }
                }
            });

            expect(previewResponse.status()).toBe(200);
            const previewData = await previewResponse.json();

            expect(previewData.html).toContain('Preview Test');
            expect(previewData.html).toContain('<strong>HTML</strong>');
            expect(previewData.html).toContain('text-center'); // CSS class for center alignment
            expect(previewData.css).toBeTruthy();
            expect(previewData.configuration).toEqual({
                title: 'Preview Test',
                content: '<p>Preview content with <strong>HTML</strong></p>',
                alignment: 'center'
            });
        });

        test('widget reordering via API', async ({ page }) => {
            // Create page with multiple widgets
            const pageResponse = await page.request.post(`${API_BASE_URL}/api/v1/webpages/`, {
                data: {
                    title: 'Reorder API Test',
                    slug: 'reorder-api-test'
                }
            });

            const pageData = await pageResponse.json();
            const pageId = pageData.id;

            // Create three widgets
            const widgets = [];
            for (let i = 1; i <= 3; i++) {
                const widgetResponse = await page.request.post(`${API_BASE_URL}/api/v1/webpages/${pageId}/widgets/`, {
                    data: {
                        type: 'text-block',
                        slot: 'main',
                        configuration: {
                            title: `Widget ${i}`,
                            content: `Content ${i}`,
                            alignment: 'left'
                        }
                    }
                });

                const widgetData = await widgetResponse.json();
                widgets.push(widgetData);
            }

            // Reorder widgets: [1, 2, 3] -> [3, 1, 2]
            const reorderResponse = await page.request.post(`${API_BASE_URL}/api/v1/webpages/${pageId}/widgets/reorder/`, {
                data: {
                    widgets: [widgets[2].id, widgets[0].id, widgets[1].id],
                    slot: 'main'
                }
            });

            expect(reorderResponse.status()).toBe(200);

            // Verify new order
            const pageDetailsResponse = await page.request.get(`${API_BASE_URL}/api/v1/webpages/${pageId}/`);
            const updatedPageData = await pageDetailsResponse.json();

            const mainWidgets = updatedPageData.widgets.filter(w => w.slot === 'main').sort((a, b) => a.order - b.order);
            expect(mainWidgets[0].config.title).toBe('Widget 3');
            expect(mainWidgets[1].config.title).toBe('Widget 1');
            expect(mainWidgets[2].config.title).toBe('Widget 2');
        });
    });

    test.describe('Error Handling and Edge Cases', () => {
        test('handles invalid widget types gracefully', async ({ page }) => {
            await page.goto(`${BASE_URL}/pages/create`);
            await page.fill('[data-testid="page-title"]', 'Error Test Page');

            // Try to add non-existent widget type
            const response = await page.request.post(`${API_BASE_URL}/api/v1/webpages/1/widgets/`, {
                data: {
                    type: 'non-existent-widget',
                    slot: 'main',
                    configuration: {}
                }
            });

            expect(response.status()).toBe(400);
            const errorData = await response.json();
            expect(errorData.error).toContain('Widget type not found');
        });

        test('handles network errors during widget operations', async ({ page }) => {
            await page.goto(`${BASE_URL}/pages/create`);

            // Mock network failure
            await page.route('**/api/v1/widgets/types/text-block/preview/', route => {
                route.abort('failed');
            });

            await page.click('[data-testid="add-widget-button"]');
            await page.click('[data-testid="widget-text-block"]');
            await page.fill('[data-testid="title-input"]', 'Network Error Test');
            await page.fill('[data-testid="content-input"]', 'This should show error');

            // Should show error message instead of preview
            await expect(page.locator('[data-testid="preview-error"]')).toBeVisible();
            await expect(page.locator('[data-testid="preview-error"]')).toContainText('Failed to generate preview');
        });

        test('handles large widget configurations', async ({ page }) => {
            const largeContent = 'A'.repeat(50000); // 50KB of text

            const response = await page.request.post(`${API_BASE_URL}/api/v1/widgets/types/text-block/validate/`, {
                data: {
                    configuration: {
                        title: 'Large Content Test',
                        content: largeContent,
                        alignment: 'left'
                    }
                }
            });

            expect(response.status()).toBe(200);
            const data = await response.json();

            // Should handle large content appropriately
            if (data.is_valid) {
                expect(data.errors).toEqual({});
            } else {
                expect(data.errors.content).toContain('too large');
            }
        });

        test('handles concurrent widget modifications', async ({ page, context }) => {
            // Create two browser contexts to simulate concurrent users
            const page2 = await context.newPage();

            // Both users navigate to same page
            const testUrl = `${BASE_URL}/pages/1/edit`;
            await page.goto(testUrl);
            await page2.goto(testUrl);

            // User 1 adds a widget
            await page.click('[data-testid="add-widget-button"]');
            await page.click('[data-testid="widget-text-block"]');
            await page.fill('[data-testid="title-input"]', 'User 1 Widget');
            await page.click('[data-testid="save-widget-config"]');

            // User 2 tries to add a widget at the same time
            await page2.click('[data-testid="add-widget-button"]');
            await page2.click('[data-testid="widget-text-block"]');
            await page2.fill('[data-testid="title-input"]', 'User 2 Widget');
            await page2.click('[data-testid="save-widget-config"]');

            // Both save the page
            await Promise.all([
                page.click('[data-testid="save-page"]'),
                page2.click('[data-testid="save-page"]')
            ]);

            // Should handle conflicts gracefully
            await expect(page.locator('[data-testid="success-message"], [data-testid="conflict-message"]')).toBeVisible();
            await expect(page2.locator('[data-testid="success-message"], [data-testid="conflict-message"]')).toBeVisible();

            await page2.close();
        });
    });

    test.describe('Performance Tests', () => {
        test('page editor loads quickly with many widgets', async ({ page }) => {
            // Create page with 50 widgets via API for speed
            const pageResponse = await page.request.post(`${API_BASE_URL}/api/v1/webpages/`, {
                data: {
                    title: 'Performance Test Page',
                    slug: 'performance-test-page'
                }
            });

            const pageData = await pageResponse.json();
            const pageId = pageData.id;

            // Add 50 widgets
            const widgetPromises = Array.from({ length: 50 }, (_, i) =>
                page.request.post(`${API_BASE_URL}/api/v1/webpages/${pageId}/widgets/`, {
                    data: {
                        type: 'text-block',
                        slot: 'main',
                        configuration: {
                            title: `Performance Widget ${i + 1}`,
                            content: `Content for widget ${i + 1}`,
                            alignment: 'left'
                        }
                    }
                })
            );

            await Promise.all(widgetPromises);

            // Measure page load time
            const startTime = Date.now();
            await page.goto(`${BASE_URL}/pages/${pageId}/edit`);
            await page.waitForSelector('[data-testid="page-editor"]');
            await page.waitForSelector('[data-testid^="widget-preview-"]:nth-child(50)'); // Wait for last widget
            const endTime = Date.now();

            const loadTime = endTime - startTime;

            // Should load within reasonable time (< 5 seconds)
            expect(loadTime).toBeLessThan(5000);

            // Verify all widgets are loaded
            const widgetCount = await page.locator('[data-testid^="widget-preview-"]').count();
            expect(widgetCount).toBe(50);
        });

        test('widget preview generation is performant', async ({ page }) => {
            await page.goto(`${BASE_URL}/pages/create`);

            await page.click('[data-testid="add-widget-button"]');
            await page.click('[data-testid="widget-text-block"]');

            // Measure preview generation time
            const startTime = Date.now();

            await page.fill('[data-testid="title-input"]', 'Performance Test Title');
            await page.fill('[data-testid="content-input"]', 'Performance test content');

            // Wait for preview to update
            await page.waitForSelector('[data-testid="widget-preview"]');
            await expect(page.locator('[data-testid="widget-preview"]')).toContainText('Performance Test Title');

            const endTime = Date.now();
            const previewTime = endTime - startTime;

            // Preview should generate quickly (< 1 second)
            expect(previewTime).toBeLessThan(1000);
        });
    });
});
