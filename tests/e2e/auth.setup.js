import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
    // Navigate to login page
    await page.goto('/admin/login/');

    // Create a test user if needed via API
    const response = await page.request.post('/api/auth/register/', {
        data: {
            username: 'e2e-test-user',
            email: 'e2e@test.com',
            password: 'testpass123',
            first_name: 'E2E',
            last_name: 'Test'
        }
    });

    // Login might fail if user exists, that's ok
    if (response.status() === 400) {
        console.log('Test user already exists, proceeding with login');
    }

    // Fill in login form
    await page.fill('#id_username', 'e2e-test-user');
    await page.fill('#id_password', 'testpass123');
    await page.click('input[type="submit"]');

    // Wait for successful login - look for admin dashboard or redirect
    await page.waitForURL('**/admin/**');

    // Verify we're logged in by checking for admin interface
    await expect(page.locator('#user-tools')).toBeVisible();

    // Save authentication state
    await page.context().storageState({ path: authFile });
}); 