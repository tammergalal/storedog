import { catalogRequest } from '@lib/apiClient'
import type { Taxon } from '@customTypes/taxons'

export type { Taxon }

export async function getTaxons(params?: {
  include?: string
  page?: number
  per_page?: number
}): Promise<Record<string, Taxon & { children: Taxon[] }>> {
  const taxons = await catalogRequest<Taxon[]>('/taxons')
  // Build the same parent→children structure the frontend expects
  const taxonsObj: Record<string, Taxon & { children: Taxon[] }> = {}
  for (const taxon of taxons) {
    const key = taxon.name.toLowerCase()
    taxonsObj[key] = taxon as Taxon & { children: Taxon[] }
  }
  return taxonsObj
}

export async function getTaxon(params: {
  id: string | number
  include?: string
}): Promise<Taxon> {
  return catalogRequest<Taxon>(`/taxons/by-permalink/${params.id}`)
}
