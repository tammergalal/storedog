import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { ProductList } from '@components/product'
import { getProducts } from '@lib/api/products'
import { getPages } from '@lib/api/pages'
import { getTaxons } from '@lib/api/taxons'
import { codeStash } from 'code-stash'
import config from '../../featureFlags.config.json'

export async function loader() {
  const products = await getProducts()
  const pages = await getPages()
  const taxons = await getTaxons()

  const flag =
    (await codeStash('product-card-frustration', { file: config })) || false

  return json({
    products,
    pages,
    taxons,
    cardVersion: flag ? 'v2' : 'v1',
  })
}

export default function ProductsIndex() {
  const { products, pages, taxons, cardVersion } =
    useLoaderData<typeof loader>()

  return (
    <ProductList
      products={products}
      pages={pages}
      taxons={taxons}
      cardVersion={cardVersion as 'v1' | 'v2'}
    />
  )
}
