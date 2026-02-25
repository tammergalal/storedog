import { test, expect } from '@playwright/test'

/**
 * Session Debug Panel tests.
 *
 * The panel starts MINIMIZED — only "Show Session Debug" button is visible.
 * Clicking it expands the full "RUM Activity (N)" panel.
 *
 * Run against original (port 8080) to establish baseline:
 *   BASE_URL=http://localhost:8080 npx playwright test session-debug.spec.ts
 *
 * Run against fork (port 9090):
 *   BASE_URL=http://localhost:9090 npx playwright test session-debug.spec.ts
 */

test.describe('Session Debug Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the site so we can access its localStorage origin
    await page.goto('/')
    // Clear localStorage to simulate a first-time user
    await page.evaluate(() => localStorage.clear())
  })

  // ── Minimized state ────────────────────────────────────────────────────────

  test('"Show Session Debug" button is visible on page load', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Show Session Debug' })).toBeVisible({ timeout: 10_000 })
  })

  test('panel is not expanded by default', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Show Session Debug' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/RUM Activity/)).not.toBeVisible()
  })

  // ── Expanding the panel ────────────────────────────────────────────────────

  test('clicking "Show Session Debug" expands the panel', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Show Session Debug' }).click()
    await expect(page.getByText(/RUM Activity \(\d+\)/)).toBeVisible({ timeout: 10_000 })
  })

  test('panel appears for returning user with LC email', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem(
        'rum_user',
        JSON.stringify({
          id: 'test-user-123',
          name: 'Learning Center User',
          email: 'learning-center-user@example.com',
        })
      )
    })
    await page.reload()
    await page.getByRole('button', { name: 'Show Session Debug' }).click()
    await expect(page.getByText(/RUM Activity \(\d+\)/)).toBeVisible({ timeout: 10_000 })
  })

  // ── RUM events ─────────────────────────────────────────────────────────────

  test('panel shows at least one RUM event after expanding', async ({ page }) => {
    await page.goto('/')
    // Events accumulate in the background even while minimized
    await page.waitForTimeout(2_000)
    await page.getByRole('button', { name: 'Show Session Debug' }).click()
    // Count should be > 0 since RUM fired events while page loaded
    await expect(page.getByText(/RUM Activity \([1-9]\d*\)/)).toBeVisible({ timeout: 10_000 })
  })

  test('view event card appears in the panel after expanding', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2_000)
    await page.getByRole('button', { name: 'Show Session Debug' }).click()
    await expect(page.getByText(/RUM Activity \([1-9]\d*\)/)).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('span').filter({ hasText: /^view/ }).first()).toBeVisible({ timeout: 5_000 })
  })

  // ── Toggle behavior ────────────────────────────────────────────────────────

  test('panel can be closed with the × button', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Show Session Debug' }).click()
    await expect(page.getByText(/RUM Activity/)).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: '×' }).click()

    await expect(page.getByText(/RUM Activity/)).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Show Session Debug' })).toBeVisible()
  })

  test('panel can be reopened after closing', async ({ page }) => {
    await page.goto('/')
    // Open
    await page.getByRole('button', { name: 'Show Session Debug' }).click()
    await expect(page.getByText(/RUM Activity/)).toBeVisible({ timeout: 10_000 })
    // Close
    await page.getByRole('button', { name: '×' }).click()
    await expect(page.getByRole('button', { name: 'Show Session Debug' })).toBeVisible()
    // Reopen
    await page.getByRole('button', { name: 'Show Session Debug' }).click()
    await expect(page.getByText(/RUM Activity/)).toBeVisible({ timeout: 5_000 })
  })

  // ── Persistence ────────────────────────────────────────────────────────────

  test('"Show Session Debug" button persists across client-side navigation', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Show Session Debug' })).toBeVisible({ timeout: 10_000 })

    await page.click('a[href="/products"]').catch(() => page.goto('/products'))
    await page.waitForURL(/products/, { timeout: 8_000 })

    await expect(page.getByRole('button', { name: 'Show Session Debug' })).toBeVisible({ timeout: 10_000 })
  })

  test('panel accumulates events while minimized during SPA navigation', async ({ page }) => {
    await page.goto('/')

    // Navigate while minimized — events accumulate in background
    const productsLink = page.locator('a[href="/products"]').first()
    await productsLink.waitFor({ state: 'visible', timeout: 5_000 })
    await productsLink.click()
    await page.waitForURL(/products/, { timeout: 8_000 })

    // Expand the panel — should show events from both pages
    await page.getByRole('button', { name: 'Show Session Debug' }).click()
    await expect(page.getByText(/RUM Activity \([1-9]\d*\)/)).toBeVisible({ timeout: 10_000 })
  })
})
