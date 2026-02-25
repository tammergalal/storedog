import cn from 'clsx'
import s from './ProductView.module.css'
import { FC } from 'react'
import type { Product } from '@customTypes/product'
import usePrice from '@lib/hooks/usePrice'
import { ProductSlider, ProductCard } from '@components/product'
import { Container } from '@components/ui'
import { SEO } from '@components/common'
import ProductSidebar from '../ProductSidebar'
interface ProductViewProps {
  product: Product
  relatedProducts: Product[]
}

const ProductView: FC<ProductViewProps> = ({ product, relatedProducts }) => {
  const { price } = usePrice({
    amount: product.price.value,
    baseAmount: product.price.value,
    currencyCode: product.price.currency,
  })

  return (
    <>
      <Container className="max-w-none w-full" clean>
        <div className={cn(s.root, 'fit')}>
          <div className={cn(s.main, 'fit')}>
            <div className={s.sliderContainer}>
              <ProductSlider key={product.id}>
                {product.images.map((image, i) => (
                  <div key={image.url} className={s.imageContainer}>
                    <img
                      className={s.img}
                      src={image.url!}
                      alt={image.alt || 'Product Image'}
                      width={600}
                      height={600}
                    />
                  </div>
                ))}
              </ProductSlider>
            </div>
          </div>

          <ProductSidebar
            key={product.id}
            product={product}
            className={s.sidebar}
            price={`${price} ${product.price?.currency}`}
          />
        </div>
        <section className={s.relatedSection}>
          <h2 className={s.relatedHeading}>Related Products</h2>
          <div className={s.relatedProductsGrid}>
            {relatedProducts.map((p) => (
              <div key={p.slug} className="animated fadeIn">
                <ProductCard
                  noNameTag
                  product={p}
                  key={p.slug}
                  variant="simple"
                  className="animated fadeIn"
                  imgProps={{
                    width: 300,
                    height: 300,
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      </Container>
      <SEO
        title={product.name}
        description={product.description}
        openGraph={{
          type: 'website',
          title: product.name,
          description: product.description,
          images: [
            {
              url: product.images[0]?.url!,
              width: '800',
              height: '600',
              alt: product.name,
            },
          ],
        }}
      />
    </>
  )
}

export default ProductView
