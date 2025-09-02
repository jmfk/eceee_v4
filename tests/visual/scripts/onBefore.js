/**
 * BackstopJS onBefore script
 * Runs before each visual regression test scenario
 */

module.exports = async (page, scenario, vp) => {
    console.log(`Setting up scenario: ${scenario.label} at ${vp.label} viewport`);

    // Set up authentication if needed
    if (scenario.requireAuth !== false) {
        await page.setCookie({
            name: 'sessionid',
            value: 'test-session-id',
            domain: 'localhost',
            path: '/'
        });
    }

    // Set viewport-specific configurations
    if (vp.label === 'phone') {
        await page.emulate({
            viewport: {
                width: vp.width,
                height: vp.height,
                deviceScaleFactor: 2,
                isMobile: true,
                hasTouch: true
            },
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
        });
    } else if (vp.label === 'tablet') {
        await page.emulate({
            viewport: {
                width: vp.width,
                height: vp.height,
                deviceScaleFactor: 2,
                isMobile: false,
                hasTouch: true
            },
            userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
        });
    }

    // Disable animations to ensure consistent screenshots
    await page.addStyleTag({
        content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `
    });

    // Mock external resources for consistent testing
    await page.route('https://fonts.googleapis.com/**', route => {
        route.fulfill({ status: 200, body: '' });
    });

    await page.route('https://via.placeholder.com/**', route => {
        // Use a consistent placeholder image
        route.fulfill({
            status: 200,
            contentType: 'image/svg+xml',
            body: `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="#cccccc"/>
        <text x="200" y="150" text-anchor="middle" fill="#666666" font-family="Arial" font-size="16">
          Test Image
        </text>
      </svg>`
        });
    });

    // Set consistent timezone
    await page.emulateTimezone('America/New_York');

    console.log(`Setup complete for scenario: ${scenario.label}`);
};
