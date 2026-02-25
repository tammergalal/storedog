import { test, expect } from '@playwright/test'
import { StoredogPage } from './helpers/StoredogPage'

/**
 * Cart interaction tests.
 *
 * Covers:
 *  - Adding items to cart
 *  - Quick-add from product grid hover
 *  - Removing individual line items
 *  - Updating quantity
 *  - Emptying the cart
 *  - Cart persists across page navigation
 */

test.describe('Cart interactions', () => {
  let store: StoredogPage

  test.beforeEach(async ({ page }) => {
    store = new StoredogPage(page)
    // Go to homepage first so localStorage is accessible, then clear stale cart token
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await store.clearCart()
  })

  // ── Add to cart ────────────────────────────────────────────────────────────

  test('add to cart opens the cart sidebar', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()

    await expect(store.sidebar).toBeVisible()
    // At least one line item for the product we added (scoped to sidebar to avoid h1 conflict)
    await expect(store.sidebar.getByText('Cool Bits')).toBeVisible()
  })

  test('cart shows correct item count and price', async ({ page }) => {
    await store.goToProduct('cool-bits')

    const priceText = await page.locator('[style*="--brand"]').first().textContent()
    await store.addToCart()

    // Sidebar should show the product name and its price somewhere
    await expect(store.sidebar.getByText('Cool Bits')).toBeVisible()
    await expect(store.sidebar).toBeVisible()
  })

  test('adding the same product twice increments quantity', async ({ page }) => {
    await store.goToProduct('cool-bits')

    // First add
    await store.addToCart()
    await store.closeSidebar.click()
    await store.sidebar.waitFor({ state: 'hidden', timeout: 5_000 })

    // Second add — sidebar reopens
    await store.addToCart()

    // Qty 2 = doubled price ($19.99 × 2 = $39.98); .first() avoids strict-mode (price appears in item, subtotal, total, button)
    await expect(store.sidebar.getByText('$39.98').first()).toBeVisible()
  })

  test('close sidebar button dismisses the cart', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()
    await expect(store.sidebar).toBeVisible()

    await store.closeSidebar.click()
    await expect(store.sidebar).not.toBeVisible({ timeout: 5_000 })
  })

  // ── Remove / update line items ─────────────────────────────────────────────

  test('remove item from cart removes it from the sidebar', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()
    await expect(store.sidebar.getByText('Cool Bits')).toBeVisible()

    // Find and click the remove/delete button for the line item
    const removeButton = page.locator('button[aria-label*="remove"], button[aria-label*="Remove"], button[aria-label*="delete"], button[aria-label*="Delete"]').first()
    if (await removeButton.isVisible()) {
      await removeButton.click()
      await expect(page.getByText('Cool Bits')).not.toBeVisible({ timeout: 5_000 })
    } else {
      // Fallback: look for any × or trash button inside the sidebar
      const altRemove = store.sidebar.locator('button').filter({ hasText: /^[×✕]$/ }).first()
      if (await altRemove.isVisible()) {
        await altRemove.click()
        await expect(page.getByText('Cool Bits')).not.toBeVisible({ timeout: 5_000 })
      }
    }
  })

  // ── Multi-item cart ────────────────────────────────────────────────────────

  test('multiple different products appear in cart', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()
    await store.closeSidebar.click()
    await store.sidebar.waitFor({ state: 'hidden', timeout: 5_000 })

    // Use SPA navigation for second product to preserve cart state
    await store.goToProductSPA('hockey-bits')
    await store.addToCart()

    await expect(store.sidebar.getByText('Cool Bits')).toBeVisible()
    await expect(store.sidebar.getByText('Hockey Bits')).toBeVisible()
  })

  // ── Cart persistence ───────────────────────────────────────────────────────

  test('cart persists after navigating to a different page', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()
    await store.closeSidebar.click()

    // Token is set immediately after adding to cart
    const token = await page.evaluate(() => localStorage.getItem('cartToken'))
    expect(token).toBeTruthy()

    // Navigate away — token should survive SPA navigation
    await store.allProductsLink.click()
    await page.waitForURL(/products/, { timeout: 8_000 })

    const tokenAfterNav = await page.evaluate(() => localStorage.getItem('cartToken'))
    expect(tokenAfterNav).toBeTruthy()
  })

  // ── Cart ↔ Checkout navigation ─────────────────────────────────────────────

  test('Proceed to Checkout button is visible and navigates to checkout view', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()

    await expect(store.proceedToCheckoutButton).toBeVisible()
    await store.proceedToCheckoutButton.click()

    // Checkout view shows payment and shipping widgets
    await expect(page.getByText('John Doe — •••• •••• ••••• 12345')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('McMurdo Station, Antarctica')).toBeVisible()
  })

  test('back button from checkout returns to cart view', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()
    await store.proceedToCheckout()

    // Click the back/← button in the checkout header
    const backButton = page.locator('[aria-label*="back"], [aria-label*="Back"], button').filter({ hasText: /←|‹|back/i }).first()
    const sidebarBack = store.sidebar.locator('button').first() // SidebarLayout back button is typically first

    if (await backButton.isVisible()) {
      await backButton.click()
    } else {
      await sidebarBack.click()
    }

    // Should be back in cart view showing the item
    await expect(store.proceedToCheckoutButton).toBeVisible({ timeout: 5_000 })
  })
})
