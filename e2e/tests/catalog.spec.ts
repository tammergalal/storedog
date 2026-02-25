import { test, expect } from '@playwright/test'
import { StoredogPage } from './helpers/StoredogPage'

/**
 * Catalog and navigation tests.
 *
 * Covers:
 *  - Homepage renders product grid
 *  - Navigation links work
 *  - Product detail page loads correctly
 *  - Category / taxon filtering
 */

test.describe('Catalog and navigation', () => {
  let store: StoredogPage

  test.beforeEach(async ({ page }) => {
    store = new StoredogPage(page)
  })

  // ── Homepage ───────────────────────────────────────────────────────────────

  test('homepage loads with hero and navbar', async ({ page }) => {
    await store.goHome()
    await expect(store.navbar).toBeVisible()
    // Hero headline
    await expect(page.getByText(/The Best Bits|All in One Place/i).first()).toBeVisible()
    // "Shop by Category" section
    await expect(page.getByText('Shop by Category')).toBeVisible()
  })

  test('navbar is visible and contains navigation links', async ({ page }) => {
    await store.goHome()
    await expect(store.navbar).toBeVisible()
    await expect(store.allProductsLink).toBeVisible()
    await expect(store.bestsellersLink).toBeVisible()
  })

  // ── Navigation ─────────────────────────────────────────────────────────────

  test('all-products nav link shows product grid', async ({ page }) => {
    await store.goHome()
    await store.allProductsLink.click()
    await page.waitForURL(/products/, { timeout: 8_000 })
    await expect(store.productGrid).toBeVisible()
    const count = await store.productItems.count()
    expect(count).toBeGreaterThan(0)
  })

  test('bestsellers nav link navigates to bestsellers page', async ({ page }) => {
    await store.goHome()
    await store.bestsellersLink.click()
    await page.waitForURL(/bestsellers/, { timeout: 8_000 })
    await expect(store.productGrid).toBeVisible()
  })

  test('footer links are present', async ({ page }) => {
    await store.goHome()
    // Scroll to bottom to ensure footer is rendered
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const footerLinks = page.locator('.footer-link')
    const count = await footerLinks.count()
    expect(count).toBeGreaterThan(0)
  })

  // ── Product detail pages ───────────────────────────────────────────────────

  test('sticker product detail page loads', async ({ page }) => {
    await store.goToProduct('cool-bits')
    await expect(page.locator('h1')).toContainText('Cool Bits')
    await expect(page.getByText(/USD/)).toBeVisible()
    await expect(store.addToCartButton).toBeVisible()
    await expect(store.addToCartButton).toBeEnabled()
  })

  test('apparel product detail page shows variant selector', async ({ page }) => {
    await store.goToProduct('sweatshirt-crewneck')
    await expect(page.locator('h1')).toContainText('Sweatshirt')
    await expect(store.variantSelect).toBeVisible()

    const options = await store.variantSelect.locator('option').count()
    expect(options).toBeGreaterThan(1)
  })

  test('clicking a product card navigates to the product page', async ({ page }) => {
    await store.goHome()
    const firstCard = store.productItems.first()
    await firstCard.click()
    await expect(store.addToCartButton).toBeVisible({ timeout: 10_000 })
    expect(page.url()).toContain('/products/')
  })

  // ── Health checks ──────────────────────────────────────────────────────────

  test('catalog API responds correctly', async ({ request }) => {
    const resp = await request.get('/services/catalog/products?per_page=5')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.products).toBeInstanceOf(Array)
    expect(body.products.length).toBeGreaterThan(0)
    expect(body.meta.count).toBeGreaterThan(0)
  })

  test('cart API health check returns ok', async ({ request }) => {
    const resp = await request.get('/services/cart/health')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.status).toBe('ok')
  })

  test('discounts API responds to a known code', async ({ request }) => {
    const resp = await request.get('/services/discounts/discount-code?discount_code=BRONZE10')
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.tier).toBe('bronze')
    expect(body.discount_value).toBe(10)
  })
})
