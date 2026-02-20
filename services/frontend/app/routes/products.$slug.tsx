import { json } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { ProductView } from '@components/product'
import { getProduct, getProducts } from '@lib/api/products'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const referer = request.headers.get('referer') ?? ''
  if (referer.includes('/search')) {
    await new Promise((r) =>
      setTimeout(r, Math.round(Math.random() * 7000) + 500)
    )
  }

  const [product, relatedProducts] = await Promise.all([
    getProduct({ slug: params.slug! }),
    getProducts({ per_page: 4 }),
  ])

  return json({ product, relatedProducts })
}

export default function ProductPage() {
  const { product, relatedProducts } = useLoaderData<typeof loader>()

  return <ProductView product={product} relatedProducts={relatedProducts} />
}
