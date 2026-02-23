import { FC } from 'react'
import cn from 'clsx'
import { Link } from '@remix-run/react'
import { Product } from '@customTypes/product'
import s from './ProductCard.module.css'
import usePrice from '@lib/hooks/usePrice'
import ProductTag from '../ProductTag'

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

  return (
    <div className={`${rootClassName} product-item`}>
      {variant === 'slim' && (
        <>
          <div className={s.header}>
            <Link to={`/products/${product.slug}`} aria-label={product.name}>
              {product.name}
            </Link>
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

      {variant === 'simple' && (
        <>
          {!noNameTag && (
            <div className={s.header}>
              <h3 className={s.name}>
                <Link to={`/products/${product.slug}`} aria-label={product.name} className={s.link}>
                  {product.name}
                </Link>
              </h3>
              <div className={s.price}>
                {`${price} ${product.price?.currency}`}
              </div>
            </div>
          )}
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

      {variant === 'default' && (
        <>
          <Link to={`/products/${product.slug}`} aria-label={product.name}>
            <ProductTag
              name={product.name}
              price={`${price} ${product.price?.currency}`}
            />
          </Link>

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
    </div>
  )
}

export default ProductCard
