import { cartRequest } from '@lib/apiClient'
import type { Cart } from '@customTypes/cart'

export type { Cart }

export async function createCart(token?: string | null): Promise<Cart> {
  return cartRequest<Cart>('/cart', token, { method: 'POST' })
}

export async function getCart(token: string): Promise<Cart> {
  return cartRequest<Cart>('/cart', token)
}

export async function emptyCart(token: string): Promise<Cart> {
  return cartRequest<Cart>('/cart/empty', token, { method: 'PATCH' })
}

export async function deleteCart(token: string): Promise<void> {
  await cartRequest('/cart', token, { method: 'DELETE' })
}

export async function addToCart(
  token: string,
  variantId: string | number,
  quantity: number
): Promise<Cart> {
  return cartRequest<Cart>('/cart/add_item', token, {
    method: 'POST',
    body: JSON.stringify({ variant_id: variantId, quantity }),
  })
}

export async function removeFromCart(
  token: string,
  lineItemId: string | number
): Promise<Cart> {
  return cartRequest<Cart>(`/cart/remove_line_item/${lineItemId}`, token, {
    method: 'DELETE',
  })
}

export async function updateQuantity(
  token: string,
  lineItemId: string | number,
  quantity: number
): Promise<Cart> {
  return cartRequest<Cart>('/cart/set_quantity', token, {
    method: 'PATCH',
    body: JSON.stringify({ line_item_id: lineItemId, quantity }),
  })
}

export async function applyCouponCode(
  token: string,
  couponCode: string
): Promise<Cart> {
  return cartRequest<Cart>('/cart/apply_coupon_code', token, {
    method: 'PATCH',
    body: JSON.stringify({ coupon_code: couponCode }),
  })
}
