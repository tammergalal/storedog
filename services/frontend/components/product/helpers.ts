import type { Product, ProductVariant } from '@customTypes/product'
export type SelectedOptions = Record<string, string | null>
import { Dispatch, SetStateAction } from 'react'

export function getProductVariant(product: Product, opts: SelectedOptions): ProductVariant | undefined {
  // With flat variants, selection is simplified — match by options_text
  return product.variants.find((variant) => {
    return Object.values(opts).some(
      (value) => value && variant.options_text?.toLowerCase().includes(value.toLowerCase())
    )
  })
}

export function selectDefaultOptionFromProduct(
  product: Product,
  updater: Dispatch<SetStateAction<SelectedOptions>>
) {
  // Select the first variant's options_text as default
  const firstVariant = product.variants[0]
  if (firstVariant?.options_text) {
    updater((choices) => ({
      ...choices,
      options: firstVariant.options_text?.toLowerCase() || null,
    }))
  }
}
