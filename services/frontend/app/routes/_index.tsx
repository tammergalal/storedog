import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
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

  const taxonsData = await getTaxons()
  // Use children of root taxons as display categories (e.g. Stickers, Tops, Pants…)
  // Fall back to root taxons if no children exist
  const allRoots = Object.values(taxonsData) as any[]
  const children = allRoots.flatMap((t: any) => t.children ?? [])
  const categories = children.length > 0 ? children : allRoots

  return json({ products, categories })
}

export default function Home() {
  const { products, categories } = useLoaderData<typeof loader>()

  function handleHeroCtaClick() {
    import('@datadog/browser-rum').then(({ datadogRum }) => {
      datadogRum.addAction('Hero CTA Clicked', {
        destination: '/products',
      })
    })
  }

  return (
    <div style={{ backgroundColor: 'var(--surface)' }}>
      {/* Zone 1 — Full-bleed Hero Banner */}
      <section style={{
        minHeight: '44vh',
        background: 'linear-gradient(135deg, #2d1b4e 0%, #632ca6 50%, #8a5cbf 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
      }}>
        <div style={{ maxWidth: '640px' }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 'clamp(28px, 5vw, 40px)',
            color: '#ffffff',
            lineHeight: 1.15,
            marginBottom: '14px',
            letterSpacing: '-0.02em',
          }}>
            The Best Bits,<br />All in One Place.
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.82)',
            marginBottom: '28px',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.6,
          }}>
            Explore our full collection of products, handpicked for quality and value.
          </p>
          <a
            href="/products"
            style={{
              display: 'inline-block',
              backgroundColor: '#ffffff',
              color: '#632ca6',
              borderRadius: '6px',
              padding: '12px 28px',
              fontFamily: 'var(--font-sans)',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: '0.01em',
              transition: 'transform 150ms ease, box-shadow 150ms ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            }}
            onClick={handleHeroCtaClick}
          >
            Shop Now
          </a>
        </div>
      </section>

      {/* Zone 2 — Shop by Category (real taxons) */}
      {categories && categories.length > 0 && (
        <section style={{ padding: '48px 48px', backgroundColor: 'var(--surface)', maxWidth: '1600px', margin: '0 auto' }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--text-base)',
            marginBottom: '32px',
            letterSpacing: '-0.02em',
          }}>Shop by Category</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
            {categories.map((taxon: any, i: number) => {
              const gradients = [
                'linear-gradient(135deg, #2d1b4e, #632ca6)',
                'linear-gradient(135deg, #1a2a3a, #2d5a8e)',
                'linear-gradient(135deg, #1a3a2a, #4A7C59)',
                'linear-gradient(135deg, #3a2a1a, #C47D2A)',
                'linear-gradient(135deg, #3a1a2a, #8e2d5a)',
                'linear-gradient(135deg, #1a1a3a, #5a4e8e)',
              ]
              return (
                <a
                  key={taxon.id}
                  href={`/taxonomies/${taxon.permalink || taxon.id}`}
                  style={{
                    display: 'block',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    textDecoration: 'none',
                    transition: 'box-shadow 200ms ease, transform 200ms ease',
                    backgroundColor: '#fff',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
                    (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
                    (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ height: '120px', background: gradients[i % gradients.length] }} />
                  <div style={{ padding: '14px 16px 16px' }}>
                    <h3 style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--text-base)',
                      margin: 0,
                    }}>{taxon.name}</h3>
                  </div>
                </a>
              )
            })}
          </div>
        </section>
      )}

      {/* Zone 3 — Products Grid + Marquee */}
      <div style={{ paddingBottom: '48px' }}>
        <Grid variant="filled">
          {products.slice(0, 6).map((product: any, i: number) => (
            <ProductCard
              key={product.id}
              product={product}
              imgProps={{
                width: i === 0 ? 1080 : 540,
                height: i === 0 ? 1080 : 540,
              }}
            />
          ))}
        </Grid>
      </div>

      <Marquee>
        {products.map((product: any) => (
          <ProductCard key={product.id} product={product} variant="slim" />
        ))}
      </Marquee>

      {/* Ad placement — below fold */}
      <div className="advertisement-wrapper" style={{ marginTop: '48px' }}>
        <Ad />
      </div>
    </div>
  )
}
