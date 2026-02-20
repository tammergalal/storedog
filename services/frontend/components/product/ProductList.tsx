import { Link } from '@remix-run/react'
import { useState, useEffect } from 'react'
import cn from 'clsx'
import { Layout } from '@components/common'
import ProductCard from '@components/product/ProductCard'
import { ProductCard as ProductCardV2 } from '@components/product/ProductCard/ProductCard-v2'
import { Container, Skeleton } from '@components/ui'
import rangeMap from '@lib/range-map'

import { Product } from '@customTypes/product'
import { Page } from '@customTypes/page'
import type { Taxon } from '@customTypes/taxons'

interface Props {
  products: Product[]
  /** Passed by callers but not currently rendered. Kept for API compatibility. */
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
  // if products prop is still empty after 5 seconds, show not found message
  const [notFound, setNotFound] = useState(false)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (products.length === 0) {
        setNotFound(true)
      }
    }, 5000)
    return () => clearTimeout(timeout)
  }, [products])

  function renderTaxonsList(nodes: Taxon[]) {
    return nodes.filter((node) => node?.name).map((node) => (
      <li
        className={node.children?.length ? 'list-none' : 'list-disc'}
        key={node.id}
      >
        {node.children?.length ? (
          node.name
        ) : (
          <Link to={`/taxonomies/${node.permalink}`}>
            {node.name}
          </Link>
        )}
        {node.children && node.children.length > 0 && (
          <ul className="ps-5 mt-2 space-y-1 list-disc list-inside">
            {renderTaxonsList(node.children)}
          </ul>
        )}
      </li>
    ))
  }

  const ProductCardComponent =
    cardVersion === 'v2' ? ProductCardV2 : ProductCard

  return (
    <Container>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-3 mb-20">
        <div className="col-span-8 lg:col-span-2 order-1 lg:order-none">
          <ul
            id="taxons-list"
            className="space-y-4 text-gray-500 list-disc list-inside dark:text-gray-400"
          >
            {renderTaxonsList(Object.values(taxons))}
          </ul>
        </div>
        {/* Products */}
        <div className="col-span-8 order-3 lg:order-none">
          <h2 className="mb-4 text-3xl font-bold">
            Products{' '}
            {taxon?.id ? (
              <span className="text-accent">in {taxon.name}</span>
            ) : null}
          </h2>
          {products?.length ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 product-grid">
              {products.map((product: Product) => (
                <ProductCardComponent
                  variant="simple"
                  key={product.slug}
                  className="animated fadeIn"
                  product={product}
                  imgProps={{
                    width: 480,
                    height: 480,
                  }}
                />
              ))}
            </div>
          ) : notFound ? (
            <div className="">
              <p>No products found!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rangeMap(12, (i) => (
                <Skeleton key={i}>
                  <div className="w-60 h-60" />
                </Skeleton>
              ))}
            </div>
          )}{' '}
        </div>

        <div className="col-span-8 lg:col-span-2 order-2 lg:order-none">
          {/* do nothing here for now */}
        </div>
      </div>
    </Container>
  )
}

ProductList.Layout = Layout
