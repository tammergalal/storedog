import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page object model for the Storedog storefront.
 * Encapsulates all selectors and common actions used across test specs.
 */
export class StoredogPage {
  readonly page: Page

  // ── Nav ──────────────────────────────────────────────────────────────────
  readonly navbar: Locator
  readonly allProductsLink: Locator
  readonly bestsellersLink: Locator
  readonly newItemsLink: Locator
  readonly topsLink: Locator

  // ── Product grid / cards ─────────────────────────────────────────────────
  readonly productGrid: Locator
  readonly productItems: Locator
  readonly addToCartButton: Locator
  readonly variantSelect: Locator

  // ── Sidebar ───────────────────────────────────────────────────────────────
  readonly sidebar: Locator
  readonly closeSidebar: Locator

  // ── Cart sidebar ──────────────────────────────────────────────────────────
  readonly proceedToCheckoutButton: Locator

  // ── Checkout sidebar ──────────────────────────────────────────────────────
  readonly paymentWidget: Locator
  readonly shippingWidget: Locator
  readonly confirmPurchaseButton: Locator
  readonly discountCodeInput: Locator
  readonly applyDiscountButton: Locator
  readonly checkoutError: Locator

  // ── Order confirmation ────────────────────────────────────────────────────
  readonly orderConfirmation: Locator

  constructor(page: Page) {
    this.page = page

    // Nav
    this.navbar = page.locator('nav#main-navbar')
    this.allProductsLink = page.locator('#all-products-link')
    this.bestsellersLink = page.locator('#bestsellers-link')
    this.newItemsLink = page.locator('#new-items-link')
    this.topsLink = page.locator('#tops-link')

    // Product grid
    this.productGrid = page.locator('.product-grid')
    this.productItems = page.locator('.product-item')
    this.addToCartButton = page.locator('#add-to-cart-button')
    this.variantSelect = page.locator('select#variant-select')

    // Sidebar — #cart-sidebar is the cart view, #sidebar is the checkout view
    this.sidebar = page.locator('#cart-sidebar, #sidebar')
    this.closeSidebar = page.locator('#close-sidebar')

    // Cart
    this.proceedToCheckoutButton = page.locator('[data-dd-action-name="Proceed to Checkout"]')

    // Checkout
    this.paymentWidget = page.locator('.payment-widget, [class*="PaymentWidget"]').first()
    this.shippingWidget = page.locator('.shipping-widget, [class*="ShippingWidget"]').first()
    this.confirmPurchaseButton = page.locator('button[data-dd-action-name="Confirm Purchase"]')
    this.discountCodeInput = page.locator('input[name="discount-code"]')
    this.applyDiscountButton = page.locator('button[data-dd-action-name="Apply Discount"]')
    this.checkoutError = page.locator('[class*="error"], .text-red').first()

    // Confirmation
    this.orderConfirmation = page.locator('.purchase-confirmed-msg')
  }

  /** Navigate to the homepage and wait for the navbar to appear. */
  async goHome() {
    await this.page.goto('/')
    await this.navbar.waitFor({ state: 'visible', timeout: 15_000 })
  }

  /** Navigate to the all-products listing page and wait for the product grid. */
  async goToProducts() {
    await this.page.goto('/products')
    await this.productGrid.waitFor({ state: 'visible', timeout: 15_000 })
  }

  /** Navigate to a product detail page by slug (full page load — resets CartContext). */
  async goToProduct(slug: string) {
    await this.page.goto(`/products/${slug}`)
    await this.addToCartButton.waitFor({ state: 'visible', timeout: 10_000 })
  }

  /**
   * Navigate to a product detail page via SPA link click (preserves cart state).
   * Navigates to /products first, then clicks the product link — no full page reload.
   */
  async goToProductSPA(slug: string) {
    // Click the nav "All Products" link — SPA navigation
    await this.allProductsLink.click()
    await this.productGrid.waitFor({ state: 'visible', timeout: 10_000 })
    // Click the product card link
    const productLink = this.page.locator(`a[href="/products/${slug}"]`).first()
    await productLink.waitFor({ state: 'visible', timeout: 5_000 })
    await productLink.click()
    await this.addToCartButton.waitFor({ state: 'visible', timeout: 10_000 })
  }

  /** Add the current product to cart and wait for the cart sidebar to open. */
  async addToCart() {
    await this.addToCartButton.click()
    await this.sidebar.waitFor({ state: 'visible', timeout: 10_000 })
  }

  /** Proceed from the cart sidebar to the checkout view. */
  async proceedToCheckout() {
    await this.proceedToCheckoutButton.waitFor({ state: 'visible', timeout: 5_000 })
    await this.proceedToCheckoutButton.click()
    // Wait for checkout widgets to appear
    await this.confirmPurchaseButton.waitFor({ state: 'visible', timeout: 5_000 })
  }

  /** Confirm the purchase and wait for the order confirmation view. */
  async confirmPurchase() {
    await this.confirmPurchaseButton.click()
    await this.orderConfirmation.waitFor({ state: 'visible', timeout: 15_000 })
  }

  /** Clear localStorage to reset cart state between tests. */
  async clearCart() {
    await this.page.evaluate(() => {
      localStorage.removeItem('cartToken')
    })
  }
}
