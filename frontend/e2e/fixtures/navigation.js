import { expect } from '@playwright/test'

export async function openCmsPage(page, path) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  // The editor bootstrap is a dynamic import. DOMContentLoaded can fire before
  // Vite has delivered it, especially with several isolated contexts in Docker.
  // Budget startup separately; keep the normal assertion timeout for behavior.
  await expect(page.locator('#root')).not.toBeEmpty({ timeout: 30_000 })
}

export async function reloadCmsPage(page) {
  await page.reload({ waitUntil: 'domcontentloaded' })
  // Reload starts the same dynamic bootstrap as initial navigation. Wait for
  // that startup before spending the normal timeout on content assertions.
  await expect(page.locator('#root')).not.toBeEmpty({ timeout: 30_000 })
}
