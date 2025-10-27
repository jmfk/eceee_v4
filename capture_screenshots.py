#!/usr/bin/env python3
"""
Screenshot capture script for eceee_v4 user manual.
Automatically navigates the frontend and captures screenshots.
"""

import os
import time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("ERROR: Playwright not installed!")
    print("Install with: pip install playwright")
    print("Then run: playwright install chromium")
    exit(1)


# Configuration
BASE_URL = "http://localhost:3000"
SCREENSHOTS_DIR = Path(__file__).parent / "manuals" / "rev1" / "images"
VIEWPORT_SIZE = {"width": 1920, "height": 1080}

# Login credentials (adjust these!)
USERNAME = "admin"  # Change to your actual username
PASSWORD = "admin"  # Change to your actual password


def wait_for_page_load(page, timeout=5000):
    """Wait for page to finish loading"""
    try:
        page.wait_for_load_state("networkidle", timeout=timeout)
    except:
        time.sleep(2)  # Fallback wait


def take_screenshot(page, filename, description):
    """Capture a screenshot and save it"""
    filepath = SCREENSHOTS_DIR / filename
    print(f"📸 Capturing: {description}")
    print(f"   → {filename}")

    try:
        page.screenshot(path=str(filepath), full_page=False)
        print(f"   ✅ Saved\n")
        return True
    except Exception as e:
        print(f"   ❌ Error: {e}\n")
        return False


def capture_all_screenshots():
    """Main function to capture all screenshots"""

    # Ensure screenshots directory exists
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("eceee_v4 Screenshot Capture Script")
    print("=" * 60)
    print(f"Screenshots will be saved to: {SCREENSHOTS_DIR}")
    print(f"Frontend URL: {BASE_URL}\n")

    with sync_playwright() as p:
        # Launch browser
        print("🚀 Launching browser...")
        browser = p.chromium.launch(headless=False)  # Set to True for headless
        context = browser.new_context(viewport=VIEWPORT_SIZE)
        page = context.new_page()

        screenshot_count = 0

        try:
            # Navigate to frontend
            print(f"🌐 Navigating to {BASE_URL}...")
            page.goto(BASE_URL)
            wait_for_page_load(page)

            # ============================================================
            # LOGIN (adjust selectors based on your actual login page)
            # ============================================================
            print("\n🔐 Attempting to login...")
            print("NOTE: If login fails, you may need to adjust selectors\n")

            try:
                # Wait for login form (adjust selector as needed)
                page.wait_for_selector(
                    "input[type='text'], input[type='email'], input#username",
                    timeout=5000,
                )

                # Fill in credentials (adjust selectors to match your login form)
                page.fill(
                    "input[type='text'], input[type='email'], input#username", USERNAME
                )
                page.fill("input[type='password'], input#password", PASSWORD)

                # Click login button (adjust selector as needed)
                page.click(
                    "button[type='submit'], button:has-text('Login'), button:has-text('Sign in')"
                )

                wait_for_page_load(page)
                print("✅ Login successful\n")
                time.sleep(2)
            except Exception as e:
                print(f"⚠️  Login may have failed or not needed: {e}")
                print("Continuing anyway...\n")

            # ============================================================
            # SCREENSHOT CAPTURE SEQUENCE
            # ============================================================

            print("\n" + "=" * 60)
            print("Starting Screenshot Capture")
            print("=" * 60 + "\n")

            # ---------------------------------------------------------
            # 1. Page Tree View
            # ---------------------------------------------------------
            try:
                print("📂 Section: Page Management\n")
                page.goto(f"{BASE_URL}/pages")
                wait_for_page_load(page)
                time.sleep(1)

                if take_screenshot(page, "page-tree-view.png", "Page tree view"):
                    screenshot_count += 1
            except Exception as e:
                print(f"❌ Error navigating to pages: {e}\n")

            # ---------------------------------------------------------
            # 2. Create New Page Dialog
            # ---------------------------------------------------------
            try:
                # Click new page button (adjust selector as needed)
                page.click(
                    "button:has-text('New Page'), button:has-text('Create Page'), [data-action='new-page']"
                )
                time.sleep(1)

                if take_screenshot(
                    page, "create-new-page.png", "Create new page dialog"
                ):
                    screenshot_count += 1

                # Close dialog
                page.keyboard.press("Escape")
                time.sleep(0.5)
            except Exception as e:
                print(f"⚠️  Could not capture create page dialog: {e}\n")

            # ---------------------------------------------------------
            # 3. Page Editor Interface
            # ---------------------------------------------------------
            try:
                # Navigate to first page for editing (adjust URL pattern as needed)
                page.goto(f"{BASE_URL}/pages/1/edit")
                wait_for_page_load(page)
                time.sleep(2)

                if take_screenshot(
                    page, "page-editor-interface.png", "Page editor interface"
                ):
                    screenshot_count += 1
            except Exception as e:
                print(f"⚠️  Could not capture page editor: {e}\n")

            # ---------------------------------------------------------
            # 4. Widget Library Panel
            # ---------------------------------------------------------
            try:
                # Ensure widget library is visible (adjust selector as needed)
                try:
                    page.click(".toggle-widget-library, button:has-text('Widgets')")
                    time.sleep(1)
                except:
                    pass  # May already be open

                if take_screenshot(
                    page, "widget-library-panel.png", "Widget library panel"
                ):
                    screenshot_count += 1
            except Exception as e:
                print(f"⚠️  Could not capture widget library: {e}\n")

            # ---------------------------------------------------------
            # 5. Widget Configuration Panel
            # ---------------------------------------------------------
            try:
                # Click on a widget (adjust selector to match your widgets)
                page.click(".widget:first-of-type, [data-widget-type]")
                time.sleep(1)

                if take_screenshot(
                    page, "widget-configuration-panel.png", "Widget configuration panel"
                ):
                    screenshot_count += 1
            except Exception as e:
                print(f"⚠️  Could not capture widget config: {e}\n")

            # ---------------------------------------------------------
            # 6. Text Block Widget
            # ---------------------------------------------------------
            try:
                print("\n🧩 Section: Widgets\n")

                # Try to find text block widget
                if take_screenshot(page, "widget-text-block.png", "Text block widget"):
                    screenshot_count += 1
            except Exception as e:
                print(f"⚠️  Could not capture text widget: {e}\n")

            # ---------------------------------------------------------
            # 7. Publish Page Dialog
            # ---------------------------------------------------------
            try:
                print("\n📢 Section: Publishing\n")

                # Click publish button
                page.click("button:has-text('Publish'), [data-action='publish']")
                time.sleep(1)

                if take_screenshot(
                    page, "publish-page-dialog.png", "Publish page dialog"
                ):
                    screenshot_count += 1

                # Close dialog
                page.keyboard.press("Escape")
                time.sleep(0.5)
            except Exception as e:
                print(f"⚠️  Could not capture publish dialog: {e}\n")

            # ---------------------------------------------------------
            # 8. Publication Status Dashboard
            # ---------------------------------------------------------
            try:
                page.goto(f"{BASE_URL}/publication/dashboard")
                wait_for_page_load(page)
                time.sleep(2)

                if take_screenshot(
                    page,
                    "publication-status-dashboard.png",
                    "Publication status dashboard",
                ):
                    screenshot_count += 1
            except Exception as e:
                print(f"⚠️  Could not capture publication dashboard: {e}\n")

            # ---------------------------------------------------------
            # 9. Page Version History
            # ---------------------------------------------------------
            try:
                print("\n📜 Section: Version Control\n")

                # Go back to page editor
                page.goto(f"{BASE_URL}/pages/1/edit")
                wait_for_page_load(page)
                time.sleep(1)

                # Click history button
                page.click(
                    "button:has-text('History'), button:has-text('Versions'), [data-action='history']"
                )
                time.sleep(1)

                if take_screenshot(
                    page, "page-version-history.png", "Page version history"
                ):
                    screenshot_count += 1
            except Exception as e:
                print(f"⚠️  Could not capture version history: {e}\n")

            # ---------------------------------------------------------
            # 10. Page Data Fields
            # ---------------------------------------------------------
            try:
                print("\n✏️  Section: Content Editing\n")

                # Navigate to page settings
                try:
                    page.click("button:has-text('Settings'), [data-action='settings']")
                    time.sleep(1)
                except:
                    pass

                if take_screenshot(page, "page-data-fields.png", "Page data fields"):
                    screenshot_count += 1
            except Exception as e:
                print(f"⚠️  Could not capture page data fields: {e}\n")

            # Add more screenshot captures here following the same pattern...
            # You can expand this script to capture all 51 screenshots

            print("\n" + "=" * 60)
            print(f"✅ Capture Complete! {screenshot_count} screenshots saved.")
            print("=" * 60)
            print(f"\nScreenshots saved to: {SCREENSHOTS_DIR}")
            print("\nTo view the manual with screenshots:")
            print(f"  open {SCREENSHOTS_DIR.parent / 'README.md'}")

        except Exception as e:
            print(f"\n❌ Fatal error: {e}")
            import traceback

            traceback.print_exc()

        finally:
            # Keep browser open for a moment so you can see what happened
            print("\n⏳ Keeping browser open for 3 seconds...")
            time.sleep(3)
            browser.close()
            print("🏁 Done!")


if __name__ == "__main__":
    print("\n⚠️  BEFORE RUNNING:")
    print("1. Make sure frontend is running: docker-compose up frontend")
    print("2. Update USERNAME and PASSWORD in this script")
    print("3. Press Enter to continue or Ctrl+C to cancel\n")

    try:
        input()
    except KeyboardInterrupt:
        print("\n❌ Cancelled")
        exit(0)

    capture_all_screenshots()
