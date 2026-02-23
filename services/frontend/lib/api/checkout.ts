import { cartRequest } from '@lib/apiClient'
import type { Cart } from '@customTypes/cart'
import type { ShippingRate, PaymentMethod } from '@customTypes/checkout'

export async function listPaymentMethods(
  token?: string | null
): Promise<{ payment_methods: PaymentMethod[] }> {
  return cartRequest('/checkout/payment_methods', token)
}

export async function listShippingRates(
  token: string
): Promise<{ shipping_rates: ShippingRate[] }> {
  return cartRequest('/checkout/shipping_rates', token)
}

export async function updateCheckout(
  token: string,
  data: {
    email?: string
    order?: Record<string, unknown>
    bill_address?: Record<string, unknown>
    ship_address?: Record<string, unknown>
    payment_method_id?: number
    payments_attributes?: unknown[]
    shipments_attributes?: unknown[]
  }
): Promise<Cart> {
  return cartRequest<Cart>('/checkout', token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function completeCheckout(token: string): Promise<Cart> {
  return cartRequest<Cart>('/checkout/complete', token, { method: 'PATCH' })
}
