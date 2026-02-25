import { FC } from 'react'
import cn from 'clsx'
import { Link } from '@remix-run/react'
import { Product } from '@customTypes/product'
import s from './ProductCard.module.css'
import usePrice from '@lib/hooks/usePrice'

interface Props {
  className?: string
  product: Product
  noNameTag?: boolean
  imgProps?: React.ImgHTMLAttributes<HTMLImageElement>
  variant?: 'default' | 'slim' | 'simple'
}

const placeholderImg = '/product-img-placeholder.svg'

export const ProductCard: FC<Props> = ({
  product,
  imgProps,
  className,
  noNameTag = false,
  variant = 'default',
}) => {
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

  if (variant === 'slim') {
    return (
      <div className={`${rootClassName} product-item`} aria-label={product.name}>
        <div className={s.imageContainer}>
          {product?.images && (
            <img
              src={product.images[0]?.url || placeholderImg}
              alt={product.name || 'Product Image'}
              className={s.productImage}
              height={320}
              width={320}
              {...imgProps}
            />
          )}
        </div>
        <div className={s.slimOverlay}>
          <Link to={`/products/${product.slug}`} aria-label={product.name}>
            <span className={s.slimName}>{product.name}</span>
          </Link>
        </div>
      </div>
    )
  }

  // Default and Simple variants — card with info band
  return (
    <div className={`${rootClassName} product-item`} aria-label={product.name}>
      <Link to={`/products/${product.slug}`} aria-label={product.name}>
        <div className={s.imageContainer}>
          {product?.images && (
            <img
              alt={product.name || 'Product Image'}
              className={s.productImage}
              src={product.images[0]?.url || placeholderImg}
              height={540}
              width={540}
              {...imgProps}
            />
          )}
        </div>
        {!noNameTag && (
          <div className={s.infoBand}>
            <h3 className={s.productName}>{product.name}</h3>
            <div className={s.productPrice}>
              {`${price} ${product.price?.currency}`}
            </div>
          </div>
        )}
      </Link>
    </div>
  )
}

export default ProductCard
