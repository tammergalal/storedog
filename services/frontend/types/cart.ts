export interface LineItem {
  id: number
  product_id: number
  variant_id: number
  quantity: number
  price: number
  name: string
  slug: string | null
  image_url: string | null
}

export interface Cart {
  id: string
  token: string
  state: string
  email: string | null
  currency: string
  item_count: number
  subtotal: number
  discount_amount: number
  discount_code: string | null
  ship_total: number
  total: number
  line_items: LineItem[]
}
