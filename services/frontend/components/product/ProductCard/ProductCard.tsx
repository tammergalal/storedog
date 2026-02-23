import { FC, useState } from 'react'
import cn from 'clsx'
import { Link } from '@remix-run/react'
import { Product } from '@customTypes/product'
import s from './ProductCard.module.css'
import usePrice from '@lib/hooks/usePrice'
import ProductTag from '../ProductTag'
import { datadogRum } from '@datadog/browser-rum'

interface Props {
  className?: string
  product: Product
  noNameTag?: boolean
  imgProps?: React.ImgHTMLAttributes<HTMLImageElement>
  variant?: 'default' | 'slim' | 'simple'
}

const placeholderImg = '/product-img-placeholder.svg'

const ProductCard: FC<Props> = ({
  product,
  imgProps,
  className,
  noNameTag = false,
  variant = 'default',
}) => {
  const [added, setAdded] = useState(false)

  const { price } = usePrice({
    amount: product.price.value,
    baseAmount: product.price.value,
    currencyCode: product.price.currency,
  })

  const rootClassName = cn(
    s.root,
    { [s.slim]: variant === 'slim', [s.simple]: variant === 'simple' },
    className
  )

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault() // prevent navigation to product page
    e.stopPropagation()
    // Get first variant ID from product
    const variantId = product.variants?.[0]?.id ?? product.id
    if (!variantId) return
    await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
    })
    // NOTE: No loading/disabled state — intentional. Allows duplicate requests on double-click.
    // This is an intentional APM scenario showing duplicate POST /api/cart/add spans.
    datadogRum.addAction('Quick Add to Cart', {
      product_id: product.id,
      product_name: product.name,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  if (variant === 'simple') {
    return (
      <div className="relative group">
        <Link to={`/products/${product.slug}`} className={`${rootClassName} product-item`} aria-label={product.name}>
          {!noNameTag && (
            <div className={s.header}>
              <h3 className={s.name}>
                <span>{product.name}</span>
              </h3>
              <div className={s.price}>
                {`${price} ${product.price?.currency}`}
              </div>
            </div>
          )}
          <div className={`${s.imageContainer} relative`}>
            {product?.images && (
              <div>
                <img
                  alt={product.name || 'Product Image'}
                  className={s.productImage}
                  src={product.images[0]?.url || placeholderImg}
                  height={540}
                  width={540}
                  {...imgProps}
                />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={handleQuickAdd}
                className="add-to-cart-btn w-full bg-brand text-white text-sm font-medium py-2 px-4 rounded hover:bg-brand-dark transition-colors"
              >
                {added ? '✓ Added' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </Link>
      </div>
    )
  }

  return (
    <Link to={`/products/${product.slug}`} className={`${rootClassName} product-item`} aria-label={product.name}>
      {variant === 'slim' && (
        <>
          <div className={s.header}>
            <span>{product.name}</span>
          </div>
          {product?.images && (
            <div>
              <img
                src={product.images[0]?.url || placeholderImg}
                alt={product.name || 'Product Image'}
                height={320}
                width={320}
                {...imgProps}
              />
            </div>
          )}
        </>
      )}

      {variant === 'default' && (
        <>
          <ProductTag name={product.name} price={price} />
          <div className={s.imageContainer}>
            {product?.images && (
              <div>
                <img
                  alt={product.name || 'Product Image'}
                  className={s.productImage}
                  src={product.images[0]?.url || placeholderImg}
                  height={540}
                  width={540}
                  {...imgProps}
                />
              </div>
            )}
          </div>
        </>
      )}
    </Link>
  )
}

export default ProductCard
