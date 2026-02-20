import { json } from '@remix-run/node'
import type { ActionFunctionArgs } from '@remix-run/node'
import { cartRequest } from '@lib/apiClient'
import { setSpanTags } from '@lib/spanTags'
import type { Cart } from '@customTypes/cart'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'PATCH') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { coupon_code } = (await request.json()) as { coupon_code?: unknown }
  const orderToken = request.headers.get('x-spree-order-token')
  if (!orderToken) {
    return json({ error: 'Missing order token' }, { status: 401 })
  }

  if (!coupon_code || typeof coupon_code !== 'string') {
    return json({ error: 'coupon_code is required' }, { status: 400 })
  }

  try {
    const cart = await cartRequest<Cart>('/cart/apply_coupon_code', orderToken, {
      method: 'PATCH',
      body: JSON.stringify({ coupon_code }),
    })

    setSpanTags({
      'discount.code': coupon_code,
      'cart.total': cart.total,
    })

    return json(cart)
  } catch (error) {
    console.error('Apply coupon error:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}
