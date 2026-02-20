import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Container } from '@components/ui'
import { SEO } from '@components/common'
import { ProductCard } from '@components/product'
import { getProducts } from '@lib/api/products'
import type { Product } from '@customTypes/product'

export async function loader() {
  try {
    const allProducts: Product[] = await getProducts()

    const hatProducts = (Array.isArray(allProducts) ? allProducts : []).filter(
      (product) =>
        product.name?.toLowerCase().includes('hat') ||
        product.name?.toLowerCase().includes('cap') ||
        product.name?.toLowerCase().includes('beanie') ||
        product.description?.toLowerCase().includes('hat') ||
        product.description?.toLowerCase().includes('headwear')
    )

    return json({ hatProducts: hatProducts.slice(0, 12) })
  } catch (error) {
    console.error('Error fetching hat products:', error)
    return json({ hatProducts: [] })
  }
}

export default function CoolHatsPage() {
  const { hatProducts } = useLoaderData<typeof loader>()

  return (
    <>
      <SEO
        title="Cool Hats - Storedog"
        description="Discover our amazing collection of cool hats, caps, and headwear. Style meets comfort in our curated selection."
      />

      <Container className="pt-8 pb-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
            Cool Hats Collection
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Welcome to our awesome hat collection! You clicked on the Cool Hats
            ad and landed here. Discover headwear that's both stylish and
            functional.
          </p>
        </div>

        {/* Hat Products Section */}
        {hatProducts.length > 0 ? (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Featured Hat Products
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {hatProducts.map((product: any) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  variant="simple"
                  imgProps={{
                    width: 300,
                    height: 300,
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">&#x1F9E2;</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No Hat Products Found
            </h2>
            <p className="text-gray-600">
              We're still building our hat collection! Check back soon for awesome
              headwear.
            </p>
          </div>
        )}

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="bg-purple-900 rounded-lg p-8">
            <h2 className="text-3xl font-bold mb-4 text-white">
              Love Fashion? We've Got You Covered!
            </h2>
            <p className="text-xl mb-6 text-white opacity-90">
              Join our hat enthusiasts community and be the first to know about
              new arrivals.
            </p>
            <a
              href="/"
              className="inline-block bg-white text-purple-800 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Explore All Products
            </a>
          </div>
        </div>
      </Container>
    </>
  )
}
