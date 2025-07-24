import { test, expect } from '@playwright/test';

test.describe('Page Management', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to page management
        await page.goto('/page-management');
        await page.waitForLoadState('networkidle');
    });

    test('should display page management interface', async ({ page }) => {
        // Check main page elements are visible
        await expect(page.locator('h1')).toContainText('Page Management');
        await expect(page.getByText('Create New Page')).toBeVisible();
        await expect(page.getByText('Page Tree')).toBeVisible();
    });

    test('should create a new page successfully', async ({ page }) => {
        // Click create new page button
        await page.getByText('Create New Page').click();

        // Fill in page details
        await page.fill('#title', 'E2E Test Page');
        await page.fill('#slug', 'e2e-test-page');
        await page.fill('#description', 'Created by E2E test');

        // Select layout
        await page.selectOption('#layout', 'two_column');

        // Submit form
        await page.getByText('Create Page').click();

        // Wait for success message
        await expect(page.getByText('Page created successfully')).toBeVisible();

        // Verify page appears in list
        await expect(page.getByText('E2E Test Page')).toBeVisible();
    });

    test('should edit existing page', async ({ page }) => {
        // First create a page
        await page.getByText('Create New Page').click();
        await page.fill('#title', 'Edit Test Page');
        await page.fill('#slug', 'edit-test-page');
        await page.getByText('Create Page').click();
        await page.waitForSelector('[data-testid="success-message"]');

        // Find and click edit button
        await page.getByTestId('edit-page-button').first().click();

        // Update page title
        await page.fill('#title', 'Updated Edit Test Page');

        // Save changes
        await page.getByText('Update Page').click();

        // Verify update message
        await expect(page.getByText('Page updated successfully')).toBeVisible();

        // Verify updated title is displayed
        await expect(page.getByText('Updated Edit Test Page')).toBeVisible();
    });

    test('should search pages', async ({ page }) => {
        // Create test pages for searching
        const pages = ['Search Test One', 'Search Test Two', 'Different Page'];

        for (const pageTitle of pages) {
            await page.getByText('Create New Page').click();
            await page.fill('#title', pageTitle);
            await page.fill('#slug', pageTitle.toLowerCase().replace(/\s+/g, '-'));
            await page.getByText('Create Page').click();
            await page.waitForSelector('[data-testid="success-message"]');
        }

        // Perform search
        await page.fill('#search-input', 'Search Test');
        await page.press('#search-input', 'Enter');

        // Verify search results
        await expect(page.getByText('Search Test One')).toBeVisible();
        await expect(page.getByText('Search Test Two')).toBeVisible();
        await expect(page.getByText('Different Page')).not.toBeVisible();
    });

    test('should handle page tree interactions', async ({ page }) => {
        // Click on Page Tree tab
        await page.getByText('Page Tree').click();

        // Wait for tree to load
        await page.waitForSelector('[data-testid="page-tree"]');

        // Check that root pages are visible
        await expect(page.getByTestId('page-tree')).toBeVisible();

        // Look for expandable pages
        const expandablePages = page.locator('[data-testid*="expand-"]');
        const expandableCount = await expandablePages.count();

        if (expandableCount > 0) {
            // Click to expand first expandable page
            await expandablePages.first().click();

            // Wait for children to load
            await page.waitForTimeout(1000);

            // Verify expansion worked (children should be visible)
            const childPages = page.locator('[data-testid*="child-page-"]');
            await expect(childPages.first()).toBeVisible();
        }
    });

    test('should handle widget management', async ({ page }) => {
        // Create a page first
        await page.getByText('Create New Page').click();
        await page.fill('#title', 'Widget Test Page');
        await page.fill('#slug', 'widget-test-page');
        await page.getByText('Create Page').click();
        await page.waitForSelector('[data-testid="success-message"]');

        // Click edit to access widget management
        await page.getByTestId('edit-page-button').first().click();

        // Look for widget management interface
        await expect(page.getByText('Add Widget')).toBeVisible();

        // Try to add a widget
        await page.getByText('Add Widget').click();

        // Select widget type
        await page.getByText('Text Block').click();

        // Configure widget
        await page.fill('#content', 'This is test widget content');

        // Save widget
        await page.getByText('Save Widget').click();

        // Verify widget was added
        await expect(page.getByText('This is test widget content')).toBeVisible();
    });

    test('should validate form inputs', async ({ page }) => {
        // Try to create page without required fields
        await page.getByText('Create New Page').click();

        // Submit empty form
        await page.getByText('Create Page').click();

        // Check for validation errors
        await expect(page.getByText('This field is required')).toBeVisible();

        // Fill title but leave slug empty
        await page.fill('#title', 'Test Page');
        await page.getByText('Create Page').click();

        // Should show slug validation error
        await expect(page.getByText('This field is required')).toBeVisible();
    });

    test('should handle pagination', async ({ page }) => {
        // Create enough pages to trigger pagination (if not already present)
        for (let i = 1; i <= 25; i++) {
            await page.getByText('Create New Page').click();
            await page.fill('#title', `Pagination Test ${i}`);
            await page.fill('#slug', `pagination-test-${i}`);
            await page.getByText('Create Page').click();
            await page.waitForSelector('[data-testid="success-message"]');
        }

        // Check if pagination controls are visible
        const paginationNext = page.getByText('Next');
        if (await paginationNext.isVisible()) {
            // Click next page
            await paginationNext.click();

            // Verify we're on page 2
            await expect(page.getByText('Page 2')).toBeVisible();

            // Go back to page 1
            await page.getByText('Previous').click();
            await expect(page.getByText('Page 1')).toBeVisible();
        }
    });

    test('should take visual regression screenshots', async ({ page }) => {
        // Screenshot of main page management view
        await expect(page).toHaveScreenshot('page-management-main.png');

        // Screenshot of create page form
        await page.getByText('Create New Page').click();
        await expect(page).toHaveScreenshot('page-management-create-form.png');

        // Screenshot of page tree view
        await page.goBack();
        await page.getByText('Page Tree').click();
        await page.waitForSelector('[data-testid="page-tree"]');
        await expect(page).toHaveScreenshot('page-management-tree-view.png');
    });

    test('should be accessible', async ({ page }) => {
        // Check for proper heading hierarchy
        const h1Elements = page.locator('h1');
        await expect(h1Elements).toHaveCount(1);

        // Check for proper form labels
        await page.getByText('Create New Page').click();
        await expect(page.locator('label[for="title"]')).toBeVisible();
        await expect(page.locator('label[for="slug"]')).toBeVisible();

        // Check for proper button roles
        const buttons = page.locator('button');
        const buttonCount = await buttons.count();
        expect(buttonCount).toBeGreaterThan(0);

        // Check keyboard navigation
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');

        // Should focus and activate first interactive element
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
    });
}); 