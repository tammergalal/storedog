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

    const bagProducts = (Array.isArray(allProducts) ? allProducts : []).filter(
      (product) =>
        product.name?.toLowerCase().includes('bag') ||
        product.name?.toLowerCase().includes('purse') ||
        product.name?.toLowerCase().includes('handbag') ||
        product.name?.toLowerCase().includes('backpack') ||
        product.name?.toLowerCase().includes('tote') ||
        product.name?.toLowerCase().includes('clutch') ||
        product.description?.toLowerCase().includes('bag') ||
        product.description?.toLowerCase().includes('purse') ||
        product.description?.toLowerCase().includes('handbag') ||
        product.description?.toLowerCase().includes('backpack')
    )

    return json({ bagProducts: bagProducts.slice(0, 12) })
  } catch (error) {
    console.error('Error fetching bag products:', error)
    return json({ bagProducts: [] })
  }
}

export default function NiceBagsPage() {
  const { bagProducts } = useLoaderData<typeof loader>()

  return (
    <>
      <SEO
        title="Nice Bags - Storedog"
        description="Discover our amazing collection of nice bags, purses, and accessories. Style meets functionality in our curated selection."
      />

      <Container className="pt-8 pb-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
            Nice Bags Collection
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Welcome to our fabulous bag collection! You clicked on the Nice Bags
            ad and landed here. Discover bags that are both stylish and
            practical for every occasion.
          </p>
        </div>

        {/* Bag Products Section */}
        {bagProducts.length > 0 ? (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Featured Bag Products
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {bagProducts.map((product: any) => (
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
            <div className="text-6xl mb-4">&#x1F45C;</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No Bag Products Found
            </h2>
            <p className="text-gray-600">
              We're still building our bag collection! Check back soon for
              fabulous accessories.
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
              Join our fashion-forward community and be the first to know about
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
