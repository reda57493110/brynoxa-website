import { expect, test } from '@playwright/test'

test.describe('storefront UX', () => {
  test('opens new routes at the top and restores scroll on back', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /laptops, gaming pcs/i })).toBeVisible()

    await page.evaluate(() => window.scrollTo(0, 600))
    const previousScroll = await page.evaluate(() => window.scrollY)
    expect(previousScroll).toBeGreaterThan(300)

    await page.getByRole('link', { name: 'Contact' }).first().click()
    await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(40)

    await page.goBack()
    await expect(page.getByRole('heading', { name: /laptops, gaming pcs/i })).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300)
  })

  test('closes the mobile navigation with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('exposes the compare route', async ({ page }) => {
    await page.goto('/compare')
    await expect(page.getByText('Nothing to compare')).toBeVisible()
  })

  test('redirects guests away from admin routes', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })

  test('revalidates a guest checkout before placing an order', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'brynoxa-cart',
        JSON.stringify({
          state: {
            items: [
              {
                productId: 'stale-product',
                name: 'Stale product',
                slug: 'stale-product',
                price: 100,
                image: '',
                stock: 4,
                qty: 2,
              },
            ],
          },
          version: 0,
        })
      )
    })
    await page.route('**/api/v1/settings', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            shippingFlatRate: 25,
            freeShippingMin: 500,
            taxRate: 0,
          },
        }),
      })
    )
    await page.route('**/api/v1/products/compare*', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              _id: 'stale-product',
              stock: 1,
            },
          ],
        }),
      })
    )
    await page.route('**/api/v1/coupons/validate*', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Invalid coupon' }),
      })
    )

    await page.goto('/checkout')
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()
    await expect(page.getByText('25 DH').first()).toBeVisible()
    await page.getByLabel('Coupon code').fill('STALE')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByText('Invalid coupon')).toBeVisible()

    await page.getByLabel('Email').fill('guest@example.com')
    await page.getByLabel('Full name').fill('Guest Customer')
    await page.getByLabel('Phone').fill('0600000000')
    await page.getByLabel('Address').fill('1 Main Street')
    await page.getByLabel('City').fill('Casablanca')
    await page.getByRole('button', { name: 'Place COD order' }).last().click()
    await expect(page.getByText(/Stock changed for/)).toBeVisible()
  })
})
