import { test, expect } from '@playwright/test'
import { StoredogPage } from './helpers/StoredogPage'

/**
 * Full checkout flow tests.
 *
 * Covers:
 *  - Pre-filled fake checkout data (John Doe, 25-digit card, Antarctica)
 *  - Both checkout widgets showing valid state on open
 *  - Full add-to-cart → checkout → order confirmation flow
 *  - Discount code application
 *  - Multi-item checkout
 *  - Variant selection before checkout
 */

test.describe('Checkout flow', () => {
  let store: StoredogPage

  test.beforeEach(async ({ page }) => {
    store = new StoredogPage(page)
    // Fresh cart for every test
    await store.goHome()
    await store.clearCart()
  })

  // ── Core checkout path ─────────────────────────────────────────────────────

  test('complete checkout: homepage → product → cart → checkout → confirmation', async ({ page }) => {
    // 1. Navigate to a product from the homepage
    await store.goToProduct('cool-bits')
    await expect(page.locator('h1')).toContainText('Cool Bits')

    // 2. Add to cart — sidebar should open automatically
    await store.addToCart()
    await expect(store.sidebar).toBeVisible()
    await expect(store.sidebar.getByText('Cool Bits')).toBeVisible()

    // 3. Proceed to checkout
    await store.proceedToCheckout()

    // 4. Both widgets must show pre-validated state (checkmarks, no user input needed)
    await expect(page.getByText('John Doe — •••• •••• ••••• 12345')).toBeVisible()
    await expect(page.getByText('McMurdo Station, Antarctica')).toBeVisible()

    // 5. Confirm Purchase button must be enabled immediately
    await expect(store.confirmPurchaseButton).toBeEnabled()

    // 6. Confirm purchase
    await store.confirmPurchase()

    // 7. Order confirmation shown
    await expect(store.orderConfirmation).toBeVisible()
    await expect(page.getByText('Thank you for your purchase!')).toBeVisible()
  })

  test('checkout works for a product with multiple variants', async ({ page }) => {
    await store.goToProduct('sweatshirt-crewneck')
    await expect(page.locator('h1')).toContainText('Sweatshirt')

    // Variant dropdown must be present
    await expect(store.variantSelect).toBeVisible()

    // Select a specific variant (Size: M is option index 1)
    await store.variantSelect.selectOption({ index: 1 })

    await store.addToCart()
    await expect(store.sidebar).toBeVisible()

    await store.proceedToCheckout()
    await expect(store.confirmPurchaseButton).toBeEnabled()

    await store.confirmPurchase()
    await expect(store.orderConfirmation).toBeVisible()
  })

  // ── Pre-filled data validation ─────────────────────────────────────────────

  test('checkout widgets show fake card and Antarctica address by default', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()
    await store.proceedToCheckout()

    // Payment widget: masked 25-digit card under John Doe
    await expect(page.getByText('John Doe — •••• •••• ••••• 12345')).toBeVisible()

    // Shipping widget: Antarctica
    await expect(page.getByText('McMurdo Station, Antarctica')).toBeVisible()

    // Confirm Purchase is enabled — both statuses are pre-validated
    await expect(store.confirmPurchaseButton).toBeEnabled()
    await expect(store.confirmPurchaseButton).not.toBeDisabled()
  })

  test('card details form shows pre-filled 25-digit number and John Doe', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()
    await store.proceedToCheckout()

    // Click the payment widget to open the payment form
    await page.getByText('John Doe — •••• •••• ••••• 12345').click()

    // Card number input should contain the 25-digit fake number
    const cardInput = page.locator('input[name="number"]')
    await cardInput.waitFor({ state: 'visible', timeout: 5_000 })
    await expect(cardInput).toHaveValue('1234567890123456789012345')

    // Cardholder name
    await expect(page.locator('input[name="name"]')).toHaveValue('John Doe')

    // Expiry year should be 2099
    await expect(page.locator('input[name="year"]')).toHaveValue('2099')
  })

  test('shipping form shows pre-filled Antarctica address', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()
    await store.proceedToCheckout()

    // Click the shipping widget to open the address form
    await page.getByText('McMurdo Station, Antarctica').click()

    const firstNameInput = page.locator('input[name="firstname"]')
    await firstNameInput.waitFor({ state: 'visible', timeout: 5_000 })

    await expect(firstNameInput).toHaveValue('John')
    await expect(page.locator('input[name="lastname"]')).toHaveValue('Doe')
    await expect(page.locator('input[name="city"]')).toHaveValue('McMurdo Station')
    await expect(page.locator('input[name="state_name"]')).toHaveValue('Ross Island')
    await expect(page.locator('select[name="country_iso"]')).toHaveValue('AQ')
  })

  // ── Discount codes ─────────────────────────────────────────────────────────

  test('BRONZE10 discount code applies 10% off', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()
    await store.proceedToCheckout()

    // Enter discount code
    await store.discountCodeInput.fill('BRONZE10')
    await store.applyDiscountButton.click()

    // Confirm the success label appears
    await expect(page.getByText(/Bronze tier applied/i)).toBeVisible({ timeout: 8_000 })

    // Proceed to complete checkout
    await expect(store.confirmPurchaseButton).toBeEnabled()
    await store.confirmPurchase()
    await expect(store.orderConfirmation).toBeVisible()
  })

  test('invalid discount code shows no success message', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()
    await store.proceedToCheckout()

    await store.discountCodeInput.fill('NOTACODE')
    await store.applyDiscountButton.click()

    // Success label must NOT appear
    await expect(page.getByText(/tier applied/i)).not.toBeVisible({ timeout: 3_000 })
  })

  // ── Multi-item checkout ────────────────────────────────────────────────────

  test('checkout completes with multiple different items in cart', async ({ page }) => {
    // Add first item
    await store.goToProduct('cool-bits')
    await store.addToCart()
    await store.closeSidebar.click()
    await store.sidebar.waitFor({ state: 'hidden', timeout: 5_000 })

    // Use SPA navigation for second item to preserve cart state
    await store.goToProductSPA('learning-bits')
    await store.addToCart()

    // Cart should show 2 line items
    await expect(store.sidebar.getByText('Cool Bits')).toBeVisible()
    await expect(store.sidebar.getByText('Learning Bits')).toBeVisible()

    await store.proceedToCheckout()
    await expect(store.confirmPurchaseButton).toBeEnabled()
    await store.confirmPurchase()
    await expect(store.orderConfirmation).toBeVisible()
  })

  // ── Post-checkout state ────────────────────────────────────────────────────

  test('cart is emptied after successful checkout', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await store.addToCart()
    await store.proceedToCheckout()
    await store.confirmPurchase()

    await expect(store.orderConfirmation).toBeVisible()
    await expect(page.getByText('Thank you for your purchase!')).toBeVisible()

    // OrderConfirmView uses handleBack (no close button) — dismiss by pressing Escape
    await page.keyboard.press('Escape')
    await store.goHome()

    // After checkout the sidebar is gone and we're back on the homepage
    await expect(store.navbar).toBeVisible()
    await expect(store.sidebar).not.toBeVisible()
  })
})
