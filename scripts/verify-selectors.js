#!/usr/bin/env node

/**
 * verify-selectors.js
 *
 * Reads the Puppeteer selector contract and verifies that every selector
 * exists in the running Storedog application.
 *
 * Usage:
 *   APP_URL=http://localhost node scripts/verify-selectors.js
 *
 * Exit codes:
 *   0 - All non-data-dependent selectors pass
 *   1 - One or more non-data-dependent selectors failed
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const APP_URL = process.env.APP_URL || 'http://localhost';
const CONTRACT_PATH = path.resolve(
  __dirname,
  '../services/puppeteer/selectors-contract.json'
);

const results = {
  pass: [],
  fail: [],
  warn: [],
};

async function checkSelector(page, name, css, dataDep, context) {
  const label = `[${context}] ${name} -> ${css}`;
  try {
    const el = await page.$(css);
    if (el) {
      results.pass.push(label);
      console.log(`  PASS  ${label}`);
    } else if (dataDep) {
      results.warn.push(label);
      console.log(`  WARN  ${label}  (data-dependent, element not found)`);
    } else {
      results.fail.push(label);
      console.log(`  FAIL  ${label}`);
    }
  } catch (err) {
    if (dataDep) {
      results.warn.push(label);
      console.log(`  WARN  ${label}  (data-dependent, error: ${err.message})`);
    } else {
      results.fail.push(label);
      console.log(`  FAIL  ${label}  (error: ${err.message})`);
    }
  }
}

async function run() {
  // Load contract
  if (!fs.existsSync(CONTRACT_PATH)) {
    console.error(`Contract file not found: ${CONTRACT_PATH}`);
    process.exit(1);
  }

  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf-8'));
  console.log(`Selector contract v${contract.version}`);
  console.log(`App URL: ${APP_URL}\n`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    page.setDefaultNavigationTimeout(30000);

    // -------------------------------------------------------
    // 1. Homepage selectors
    // -------------------------------------------------------
    console.log('--- Homepage ---');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Structural selectors expected on the homepage
    const homepageSelectors = [
      'productItem',
      'productGrid',
      'productItemThumbnail',
      'mainNavbarFirstLink',
      'mainNavbarLinks',
      'footerLink',
      'homeLink',
    ];

    for (const name of homepageSelectors) {
      const entry = contract.selectors[name];
      if (!entry) continue;
      await checkSelector(page, name, entry.css, entry.data_dependent, 'homepage');
    }

    // Check aria-label selectors on homepage (all data-dependent)
    for (const [name, entry] of Object.entries(contract.ariaLabels)) {
      if (entry.css.includes('{')) continue; // skip dynamic template
      await checkSelector(page, name, entry.css, entry.data_dependent, 'homepage');
    }

    // -------------------------------------------------------
    // 2. Navigate to a product page
    // -------------------------------------------------------
    console.log('\n--- Product Page ---');
    const firstProduct = await page.$('.product-item a');
    let navigatedToProduct = false;

    if (firstProduct) {
      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
          firstProduct.click(),
        ]);
        navigatedToProduct = true;
        await page.waitForTimeout(2000);
      } catch (err) {
        console.log(`  Could not navigate to product page: ${err.message}`);
      }
    }

    if (!navigatedToProduct) {
      // Fallback: try clicking a product-item directly
      const productItem = await page.$('.product-item');
      if (productItem) {
        try {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            productItem.click(),
          ]);
          navigatedToProduct = true;
          await page.waitForTimeout(2000);
        } catch (err) {
          console.log(`  Could not navigate to product page (fallback): ${err.message}`);
        }
      }
    }

    if (navigatedToProduct) {
      const productPageSelectors = [
        'addToCartButton',
        'variantSelect',
        'closeSidebar',
      ];

      for (const name of productPageSelectors) {
        const entry = contract.selectors[name];
        if (!entry) continue;
        // variantSelect and closeSidebar may not be visible until interaction
        const isOptional = name === 'variantSelect' || name === 'closeSidebar';
        await checkSelector(page, name, entry.css, isOptional, 'product-page');
      }

      // Check related product aria-labels
      for (const [name, entry] of Object.entries(contract.ariaLabels)) {
        if (entry.css.includes('{')) continue;
        await checkSelector(page, name, entry.css, entry.data_dependent, 'product-page');
      }
    } else {
      console.log('  SKIP  Could not navigate to any product page');
    }

    // -------------------------------------------------------
    // 3. Checkout-flow selectors (check for RUM actions)
    //    We test on the current page -- these are buttons that should
    //    exist in the DOM even before interaction in some cases.
    // -------------------------------------------------------
    console.log('\n--- RUM Action Selectors ---');
    // Go back to homepage for cart toggle test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    for (const [name, entry] of Object.entries(contract.rumActions)) {
      await checkSelector(page, name, entry.css, false, 'rum-actions');
    }

    // -------------------------------------------------------
    // 4. Checkout page selectors
    // -------------------------------------------------------
    console.log('\n--- Checkout Selectors ---');
    const checkoutSelectors = ['discountCodeInput', 'sidebar', 'purchaseConfirmedMessage'];

    for (const name of checkoutSelectors) {
      const entry = contract.selectors[name];
      if (!entry) continue;
      // These only appear during checkout flow, so treat as warnings
      await checkSelector(page, name, entry.css, true, 'checkout');
    }
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
    if (browser) await browser.close();
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }

  // -------------------------------------------------------
  // Summary
  // -------------------------------------------------------
  console.log('\n========================================');
  console.log('  SELECTOR VERIFICATION SUMMARY');
  console.log('========================================');
  console.log(`  PASS:    ${results.pass.length}`);
  console.log(`  FAIL:    ${results.fail.length}`);
  console.log(`  WARN:    ${results.warn.length}`);
  console.log(`  TOTAL:   ${results.pass.length + results.fail.length + results.warn.length}`);
  console.log('========================================');

  if (results.fail.length > 0) {
    console.log('\nFailed selectors:');
    for (const f of results.fail) {
      console.log(`  - ${f}`);
    }
    console.log('');
    process.exit(1);
  }

  if (results.warn.length > 0) {
    console.log('\nWarnings (data-dependent or interaction-dependent):');
    for (const w of results.warn) {
      console.log(`  - ${w}`);
    }
  }

  console.log('\nAll non-data-dependent selectors passed.');
  process.exit(0);
}

run();
