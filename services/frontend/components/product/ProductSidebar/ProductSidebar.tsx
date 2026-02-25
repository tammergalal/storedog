import s from './ProductSidebar.module.css'
import { datadogRum } from '@datadog/browser-rum'
import { FC, useEffect, useState } from 'react'
import { useCart } from '@lib/CartContext'
import type { Product, ProductVariant } from '@customTypes/product'
import { Button, Text, useUI } from '@components/ui'

function getProductDetails(slug: string, sku: string | undefined): Array<{ label: string; value: string }> {
  const details: Array<{ label: string; value: string }> = []

  if (slug.includes('jeans') || slug.includes('pants')) {
    details.push({ label: 'Material', value: '100% denim' })
    details.push({ label: 'Fit', value: 'Classic straight fit' })
    details.push({ label: 'Care', value: 'Machine wash cold, hang dry' })
    details.push({ label: 'Origin', value: 'Made with love (and caffeine)' })
  } else if (slug.includes('sweatshirt') || slug.includes('hoodie')) {
    details.push({ label: 'Material', value: '100% ring-spun cotton fleece' })
    details.push({ label: 'Fit', value: 'Unisex relaxed fit' })
    details.push({ label: 'Care', value: 'Machine wash cold, tumble dry low' })
    details.push({ label: 'Origin', value: 'Made with love (and caffeine)' })
  } else if (slug.includes('shirt') || slug.includes('tee') || slug.includes('t-shirt')) {
    details.push({ label: 'Material', value: '100% pre-shrunk cotton' })
    details.push({ label: 'Fit', value: 'Unisex relaxed fit' })
    details.push({ label: 'Care', value: 'Machine wash cold, tumble dry low' })
    details.push({ label: 'Origin', value: 'Made with love (and caffeine)' })
  } else {
    // Stickers (default)
    details.push({ label: 'Material', value: 'Durable vinyl' })
    details.push({ label: 'Size', value: 'Approx. 3" × 3"' })
    details.push({ label: 'Finish', value: 'Glossy, UV & water resistant' })
    details.push({ label: 'Residue', value: 'Removes cleanly — no sticky regrets' })
  }

  details.push({ label: 'Ships', value: 'Free on orders over $25' })
  if (sku) details.push({ label: 'SKU', value: sku })

  return details
}

interface ProductSidebarProps {
  product: Product
  className?: string
  price?: string
}

const ProductSidebar: FC<ProductSidebarProps> = ({ product, className, price }) => {
  const { cart, cartAdd, cartError } = useCart()
  const { openSidebar, setSidebarView } = useUI()
  const [loading, setLoading] = useState(false)
  const [variant, setVariant] = useState<ProductVariant | null>(null)

  useEffect(() => {
    if (!product) return
    setVariant(product.variants[0] || null)
  }, [product])

  const addToCart = async () => {
    setLoading(true)
    try {
      const cartRes = await cartAdd(
        String(variant ? variant.id : product.variants[0]?.id),
        1
      )

      if (cartRes.error) {
        throw new Error(cartRes.error)
      }

      datadogRum.addAction('Product Added to Cart', {
        cartTotal: cart?.total,
        product: {
          name: product.name,
          sku: variant?.sku || null,
          id: product.id,
          price: product.price.value,
          slug: product.slug,
          variantName: variant?.options_text || 'default',
        },
      })

      setSidebarView('CART_VIEW')
      openSidebar()
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  return (
    <div className={className}>
      <div className={s.sidebarContent}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--text-base)',
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
            lineHeight: 1.2,
          }}>
            {product.name}
          </h1>
          {price && (
            <div style={{
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--brand)',
            }}>
              {price}
            </div>
          )}
        </div>

        <div className={s.description}>
          <Text
            className="break-words w-full max-w-xl"
            html={product.description || ''}
          />
        </div>

        {cartError && (
          <div className={s.errorMessage}>
            {cartError.message}
          </div>
        )}

        <div>
          {product.variants && product.variants.length > 1 ? (
            <div>
              <label className={s.variantLabel}>Variant</label>
              <select
                value={variant?.id}
                id="variant-select"
                data-dd-action-name="Variant select dropdown"
                className={s.variantSelect}
                onChange={(e) => {
                  const selectedVariant = product.variants.find(
                    (v) => v.id === Number(e.target.value)
                  )
                  setVariant(selectedVariant || null)
                }}
              >
                {product.variants
                  .filter((v) => v.in_stock)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.options_text || `Variant ${v.id}`}
                    </option>
                  ))}
              </select>
            </div>
          ) : null}
        </div>

        <Button
          aria-label="Add to Cart"
          type="button"
          id="add-to-cart-button"
          className={s.button}
          onClick={addToCart}
          loading={loading}
          disabled={variant?.in_stock === false}
        >
          {variant?.in_stock === false
            ? 'Not Available'
            : 'Add To Cart'}
        </Button>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-muted)', marginBottom: '14px' }}>Details</p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: '10px', columnGap: '20px' }}>
            {getProductDetails(product.slug, variant?.sku).map(({ label, value }) => (
              <>
                <dt key={`${label}-dt`} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingTop: '1px' }}>{label}</dt>
                <dd key={`${label}-dd`} style={{ fontSize: '14px', color: 'var(--text-base)', margin: 0, lineHeight: 1.5 }}>{value}</dd>
              </>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}

export default ProductSidebar
