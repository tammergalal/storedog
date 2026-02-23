import { json } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { ProductList } from '@components/product'
import { getPages } from '@lib/api/pages'
import { getTaxon, getTaxons } from '@lib/api/taxons'
import { getProducts } from '@lib/api/products'

export async function loader({ params }: LoaderFunctionArgs) {
  const { taxonomy, slug } = params

  const pages = await getPages()
  const taxon = await getTaxon({ id: `${taxonomy}/${slug}` })
  const taxons = await getTaxons()
  const products = await getProducts({ taxon: taxon.permalink })

  return json({ pages, taxon, taxons, products })
}

export default function TaxonomySlugPage() {
  const { pages, taxon, taxons, products } = useLoaderData<typeof loader>()

  return (
    <ProductList
      products={products}
      pages={pages}
      taxons={taxons}
      taxon={taxon}
    />
  )
}
