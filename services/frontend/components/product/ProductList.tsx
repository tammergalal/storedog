import { Link, useLocation } from '@remix-run/react'
import { useState, useEffect } from 'react'
import { Layout } from '@components/common'
import ProductCard from '@components/product/ProductCard'
import { ProductCard as ProductCardV2 } from '@components/product/ProductCard/ProductCard-v2'
import { Skeleton } from '@components/ui'
import rangeMap from '@lib/range-map'

import { Product } from '@customTypes/product'
import { Page } from '@customTypes/page'
import type { Taxon } from '@customTypes/taxons'

interface Props {
  products: Product[]
  pages?: Page[]
  taxons: Record<string, Taxon>
  taxon?: Taxon
  cardVersion?: 'v1' | 'v2'
}

export default function ProductList({
  products,
  taxons,
  taxon,
  cardVersion,
}: Props) {
  const [notFound, setNotFound] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (products.length === 0) setNotFound(true)
    }, 5000)
    return () => clearTimeout(timeout)
  }, [products])

  const ProductCardComponent =
    cardVersion === 'v2' ? ProductCardV2 : ProductCard

  // Flatten the taxon tree into a list of leaf/child taxons for the filter sidebar
  const filterTaxons: Taxon[] = Object.values(taxons).flatMap((root) =>
    root.children?.length ? root.children : [root]
  )

  return (
    <div style={{ backgroundColor: 'var(--surface)', minHeight: '100vh' }}>

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #2d1b4e 0%, #632ca6 60%, #8a5cbf 100%)',
        padding: '40px 48px 36px',
      }}>
        <p style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.6)',
          marginBottom: '8px',
          fontFamily: 'var(--font-sans)',
        }}>
          {taxon ? `${taxon.name}` : 'Storedog'}
        </p>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(28px, 4vw, 40px)',
          fontWeight: 800,
          color: '#ffffff',
          margin: 0,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}>
          {taxon ? taxon.name : 'All Products'}
        </h1>
        {products.length > 0 && (
          <p style={{
            fontSize: '14px',
            color: 'rgba(255,255,255,0.65)',
            marginTop: '10px',
            fontFamily: 'var(--font-sans)',
          }}>
            {products.length} {products.length === 1 ? 'item' : 'items'}
          </p>
        )}
      </div>

      {/* ── Body: Sidebar + Grid ────────────────────────────────── */}
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: '32px',
        padding: '32px 48px 64px',
        alignItems: 'start',
      }}>

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside>
          <p style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: '12px',
            fontFamily: 'var(--font-sans)',
          }}>
            Categories
          </p>
          <ul id="taxons-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* "All" option */}
            <li>
              <Link
                to="/products"
                style={{
                  display: 'block',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: !taxon ? 600 : 400,
                  color: !taxon ? 'var(--brand)' : 'var(--text-base)',
                  backgroundColor: !taxon ? 'rgba(99,44,166,0.08)' : 'transparent',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-sans)',
                  transition: 'background 150ms ease, color 150ms ease',
                }}
                onMouseEnter={e => {
                  if (taxon) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--surface-alt)'
                }}
                onMouseLeave={e => {
                  if (taxon) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'
                }}
              >
                All Products
              </Link>
            </li>
            {filterTaxons.map((node) => {
              const isActive = taxon?.id === node.id
              return (
                <li key={node.id}>
                  <Link
                    to={`/taxonomies/${node.permalink}`}
                    style={{
                      display: 'block',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--brand)' : 'var(--text-base)',
                      backgroundColor: isActive ? 'rgba(99,44,166,0.08)' : 'transparent',
                      textDecoration: 'none',
                      fontFamily: 'var(--font-sans)',
                      transition: 'background 150ms ease, color 150ms ease',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--surface-alt)'
                    }}
                    onMouseLeave={e => {
                      if (!isActive) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'
                    }}
                  >
                    {node.name}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '20px 0' }} />

          {/* Promo block */}
          <div style={{
            backgroundColor: '#f3eefa',
            borderRadius: '10px',
            padding: '16px',
            border: '1px solid rgba(99,44,166,0.12)',
          }}>
            <p style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--brand)',
              margin: '0 0 4px',
              fontFamily: 'var(--font-heading)',
            }}>Free Shipping</p>
            <p style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              margin: 0,
              lineHeight: 1.5,
              fontFamily: 'var(--font-sans)',
            }}>On all orders over $50.</p>
          </div>
        </aside>

        {/* ── Product Grid ─────────────────────────────────────── */}
        <main>
          {products?.length ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '20px',
            }} className="product-grid">
              {products.map((product: Product) => (
                <ProductCardComponent
                  variant="simple"
                  key={product.slug}
                  className="animated fadeIn"
                  product={product}
                  imgProps={{ width: 480, height: 480 }}
                />
              ))}
            </div>
          ) : notFound ? (
            <div style={{ padding: '64px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                No products found.
              </p>
              <Link to="/products" style={{ color: 'var(--brand)', fontSize: '14px', marginTop: '8px', display: 'inline-block' }}>
                View all products →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
              {rangeMap(12, (i) => (
                <Skeleton key={i}>
                  <div className="w-60 h-60" />
                </Skeleton>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

ProductList.Layout = Layout
