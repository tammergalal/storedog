export interface ProductImage {
  url: string
  alt: string | null
}

export interface ProductVariant {
  id: number
  sku: string | null
  price: number
  options_text: string | null
  in_stock: boolean
  image_url: string | null
}

export interface ProductTaxon {
  id: number
  name: string
  permalink: string
}

export interface Product {
  id: number
  slug: string
  name: string
  description: string | null
  price: { value: number; currency: string }
  images: ProductImage[]
  variants: ProductVariant[]
  taxons: ProductTaxon[]
  available: boolean
}

export interface ProductListResponse {
  products: Product[]
  meta: { count: number; pages: number }
}
