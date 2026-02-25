import { FC, useState } from 'react'
import cn from 'clsx'
import { Link } from '@remix-run/react'
import { Product } from '@customTypes/product'
import s from './ProductCard.module.css'
import usePrice from '@lib/hooks/usePrice'
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
    e.preventDefault()
    e.stopPropagation()
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

  // Slim variant — text overlay for marquee
  if (variant === 'slim') {
    return (
      <Link
        to={`/products/${product.slug}`}
        className={`${rootClassName} product-item`}
        aria-label={product.name}
      >
        <div className={s.imageContainer}>
          {product?.images && (
            <img
              loading="lazy"
              alt={product.name || 'Product Image'}
              className={s.productImage}
              src={product.images[0]?.url || placeholderImg}
              height={320}
              width={320}
              {...imgProps}
            />
          )}
        </div>
        <div className={s.slimOverlay}>
          <span className={s.slimName}>{product.name}</span>
          <span className={s.slimPrice}>{price}</span>
        </div>
      </Link>
    )
  }

  // Default and Simple variants — card with info band + quick-add overlay
  return (
    <Link
      to={`/products/${product.slug}`}
      className={`${rootClassName} product-item`}
      aria-label={product.name}
    >
      <div className={s.imageContainer}>
        {product?.images && (
          <img
            loading="lazy"
            alt={product.name || 'Product Image'}
            className={s.productImage}
            src={product.images[0]?.url || placeholderImg}
            height={540}
            width={540}
            {...imgProps}
          />
        )}
        <div className={s.quickAddOverlay}>
          <button
            onClick={handleQuickAdd}
            className={`add-to-cart-btn ${s.quickAddBtn}`}
          >
            {added ? 'Added!' : 'Add to Cart'}
          </button>
        </div>
      </div>
      <div className={s.infoBand}>
        <h3 className={s.productName}>{product.name}</h3>
        <div className={s.productPrice}>{price}</div>
      </div>
    </Link>
  )
}

export default ProductCard
