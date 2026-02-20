import { catalogRequest } from '@lib/apiClient'
import type { Product, ProductListResponse } from '@customTypes/product'

export type { Product, ProductListResponse }

export async function getProducts(params?: {
  per_page?: number
  page?: number
  taxon?: string
  q?: string
  include?: string
}): Promise<Product[]> {
  const query = new URLSearchParams()
  if (params?.per_page) query.set('per_page', String(params.per_page))
  if (params?.page) query.set('page', String(params.page))
  if (params?.taxon) query.set('taxon', params.taxon)
  if (params?.q) query.set('q', params.q)
  const qs = query.toString()
  const res = await catalogRequest<ProductListResponse>(`/products${qs ? '?' + qs : ''}`)
  return res.products
}

export async function getProduct(params: {
  id?: string
  slug?: string
  include?: string
}): Promise<Product> {
  const slug = params.slug || params.id
  return catalogRequest<Product>(`/products/${slug}`)
}
