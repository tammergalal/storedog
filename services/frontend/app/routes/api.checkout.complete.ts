import { json } from '@remix-run/node'
import type { ActionFunctionArgs } from '@remix-run/node'
import { cartRequest } from '@lib/apiClient'
import { setSpanTags } from '@lib/spanTags'
import type { Cart } from '@customTypes/cart'

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'PATCH') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  const orderToken = request.headers.get('x-spree-order-token')
  if (!orderToken) {
    return json({ error: 'Missing order token' }, { status: 401 })
  }

  try {
    const cart = await cartRequest<Cart>('/checkout/complete', orderToken, {
      method: 'PATCH',
    })

    setSpanTags({
      'order.id': cart.id,
      'cart.total': cart.total,
      'cart.item_count': cart.item_count,
    })

    return json(cart)
  } catch (error) {
    console.error('Checkout complete error:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}
