import { json } from '@remix-run/node'
import { useLoaderData, Link } from '@remix-run/react'
import Ad from '@components/common/Ad'
import { ProductCard } from '@components/product'
import { Grid, Marquee } from '@components/ui'
import { getProducts } from '@lib/api/products'
import { getTaxons } from '@lib/api/taxons'

export async function loader() {
  let products = await getProducts()

  if (products && Array.isArray(products)) {
    products.reverse()
  } else {
    products = []
  }

  const taxons = await getTaxons()

  return json({ products, taxons })
}

const FEATURED_CATEGORIES = [
  {
    title: 'Tops & Clothing',
    description: 'Performance layers for every condition.',
    href: '/taxonomies/categories',
  },
  {
    title: 'Hats & Caps',
    description: 'Sun protection and trail-ready style.',
    href: '/taxonomies/categories',
  },
  {
    title: 'Bags & Gear',
    description: 'Carry everything the trail demands.',
    href: '/taxonomies/categories',
  },
]

export default function Home() {
  const { products } = useLoaderData<typeof loader>()

  function handleHeroCtaClick() {
    import('@datadog/browser-rum').then(({ datadogRum }) => {
      datadogRum.addAction('Hero CTA Clicked', {
        destination: '/taxonomies/categories',
      })
    })
  }

  return (
    <>
      {/* Zone 1 — Full-bleed Hero Banner */}
      <section className="bg-brand w-full py-20 px-6 text-center text-white">
        <h1
          className="text-4xl md:text-6xl font-bold mb-4"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Gear up. Explore more.
        </h1>
        <p className="text-lg md:text-xl mb-8 opacity-90">
          Premium outdoor gear for every adventure.
        </p>
        <Ad />
        <Link
          to="/taxonomies/categories"
          onClick={handleHeroCtaClick}
          className="inline-block mt-6 px-8 py-3 bg-white text-brand font-semibold rounded-lg hover:bg-opacity-90 transition-colors"
        >
          Shop Now
        </Link>
      </section>

      {/* Zone 2 — Featured Categories Row */}
      <section className="w-full py-12 px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {FEATURED_CATEGORIES.map((category) => (
            <Link
              key={category.title}
              to={category.href}
              className="block p-6 rounded-xl border transition-colors"
              style={{
                backgroundColor: 'var(--surface-alt)',
                borderColor: 'var(--border-subtle)',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor =
                  'var(--surface-hover, var(--surface))'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.backgroundColor =
                  'var(--surface-alt)'
              }}
            >
              <h2 className="text-lg font-semibold mb-2">{category.title}</h2>
              <p className="text-sm opacity-70">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Zone 3 — Products Grid + Marquee */}
      <Grid variant="filled">
        {products.slice(0, 6).map((product: any, i: number) => (
          <ProductCard
            key={product.id}
            product={product}
            imgProps={{
              width: i === 0 ? 1080 : 540,
              height: i === 0 ? 1080 : 540,
              priority: true,
            }}
          />
        ))}
      </Grid>

      <Marquee>
        {products.map((product: any) => (
          <ProductCard key={product.id} product={product} variant="slim" />
        ))}
      </Marquee>
    </>
  )
}
