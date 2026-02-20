import { json } from '@remix-run/node'
import type { ActionFunctionArgs } from '@remix-run/node'
import { cartRequest } from '@lib/apiClient'
import { setSpanTags } from '@lib/spanTags'
import type { Cart } from '@customTypes/cart'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { variant_id, quantity } = (await request.json()) as {
    variant_id?: unknown
    quantity?: unknown
  }
  const orderToken = request.headers.get('x-spree-order-token')
  if (!orderToken) {
    return json({ error: 'Missing order token' }, { status: 401 })
  }

  if (!variant_id || !quantity) {
    return json({ error: 'variant_id and quantity are required' }, { status: 400 })
  }

  try {
    const cart = await cartRequest<Cart>('/cart/add_item', orderToken, {
      method: 'POST',
      body: JSON.stringify({ variant_id, quantity }),
    })

    setSpanTags({
      'cart.item_count': cart.item_count,
      'cart.total': cart.total,
    })

    return json(cart)
  } catch (error) {
    console.error('Cart add error:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}
