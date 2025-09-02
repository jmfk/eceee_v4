/**
 * BackstopJS onReady script
 * Runs when the page is ready for screenshot capture
 */

module.exports = async (page, scenario, vp) => {
    console.log(`Preparing screenshot for: ${scenario.label} at ${vp.label} viewport`);

    // Wait for any loading indicators to disappear
    try {
        await page.waitForSelector('[data-testid="loading"]', {
            state: 'hidden',
            timeout: 5000
        });
    } catch (e) {
        // Loading indicator might not exist, continue
    }

    // Wait for fonts to load
    await page.evaluate(() => {
        return document.fonts.ready;
    });

    // Wait for images to load
    await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        return Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve; // Continue even if image fails to load
                setTimeout(resolve, 3000); // Timeout after 3 seconds
            });
        }));
    });

    // Scenario-specific preparations
    if (scenario.label.includes('Gallery')) {
        // Wait for gallery images to load
        await page.waitForSelector('.gallery-image', { timeout: 5000 });

        // Wait for any lazy-loaded images
        await page.evaluate(() => {
            return new Promise(resolve => {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            if (img.dataset.src) {
                                img.src = img.dataset.src;
                            }
                        }
                    });
                });

                document.querySelectorAll('img[data-src]').forEach(img => {
                    observer.observe(img);
                });

                setTimeout(resolve, 2000); // Wait for lazy loading
            });
        });
    }

    if (scenario.label.includes('Widget Configuration Form')) {
        // Ensure form is fully rendered
        await page.waitForSelector('[data-testid="widget-config-form"] input', { timeout: 5000 });

        // Focus on first input to show active state consistently
        await page.focus('[data-testid="widget-config-form"] input:first-of-type');
    }

    if (scenario.label.includes('Page Editor')) {
        // Wait for editor to be fully loaded
        await page.waitForSelector('[data-testid="page-editor"]', { timeout: 10000 });

        // Wait for any widget previews to render
        try {
            await page.waitForSelector('[data-testid^="widget-preview-"]', { timeout: 5000 });
        } catch (e) {
            // No widgets present, continue
        }

        // Ensure sidebar is in consistent state
        const sidebar = await page.$('[data-testid="editor-sidebar"]');
        if (sidebar) {
            const isCollapsed = await sidebar.evaluate(el => el.classList.contains('collapsed'));
            if (isCollapsed) {
                await page.click('[data-testid="toggle-sidebar"]');
                await page.waitForTimeout(500); // Wait for animation
            }
        }
    }

    if (scenario.label.includes('Error State')) {
        // Wait for error message to appear
        await page.waitForSelector('.error-message, [data-testid="error-message"]', { timeout: 5000 });
    }

    // Hide elements that might cause inconsistencies
    await page.addStyleTag({
        content: `
      /* Hide elements with dynamic content */
      .timestamp,
      .last-modified,
      [data-testid="current-time"],
      .cursor,
      .blinking-cursor {
        visibility: hidden !important;
      }
      
      /* Ensure consistent scrollbar appearance */
      ::-webkit-scrollbar {
        width: 8px;
      }
      
      ::-webkit-scrollbar-track {
        background: #f1f1f1;
      }
      
      ::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 4px;
      }
      
      /* Hide tooltips that might be showing */
      .tooltip,
      [data-testid="tooltip"] {
        display: none !important;
      }
    `
    });

    // Scroll to top to ensure consistent positioning
    await page.evaluate(() => {
        window.scrollTo(0, 0);
    });

    // Additional delay for complex scenarios
    if (scenario.label.includes('Gallery') || scenario.label.includes('Complex')) {
        await page.waitForTimeout(1000);
    }

    console.log(`Ready for screenshot: ${scenario.label}`);
};
