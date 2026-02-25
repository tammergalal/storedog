import { ChangeEvent, FocusEventHandler, useEffect, useState } from 'react'
import cn from 'clsx'
import { Link } from '@remix-run/react'
import s from './CartItem.module.css'
import { useUI } from '@components/ui/context'
import type { LineItem } from '@customTypes/cart'
import usePrice from '@lib/hooks/usePrice'
import { useCart } from '@lib/CartContext'
import Quantity from '@components/ui/Quantity'

type ItemOption = {
  name: string
  nameId: number
  value: string
  valueId: number
}

const placeholderImg = '/product-img-placeholder.svg'

const CartItem = ({
  item,
  variant = 'default',
  currencyCode,
  ...rest
}: {
  variant?: 'default' | 'display'
  item: LineItem
  currencyCode: string
}) => {
  const { cartRemove, cartUpdate } = useCart()
  const { closeSidebarIfPresent } = useUI()
  const [removing, setRemoving] = useState(false)
  const [quantity, setQuantity] = useState<number>(item.quantity)

  const { price } = usePrice({
    amount: item.price * item.quantity,
    baseAmount: item.price * item.quantity,
    currencyCode,
  })

  const handleChange = async ({
    target: { value },
  }: ChangeEvent<HTMLInputElement>) => {
    try {
      await cartUpdate(item.id, Number(value))
      setQuantity(Number(value))
    } catch (error) {
      console.error(error)
    }
  }

  const updateQuantity = async (n = 1) => {
    try {
      const val = Number(quantity) + n
      await cartUpdate(item.id, val)
      setQuantity(val)
    } catch (error) {
      console.error(error)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await cartRemove(item.id)
    } catch (error) {
      setRemoving(false)
    }
  }

  useEffect(() => {
    // Reset the quantity state if the item quantity changes
    if (item.quantity !== Number(quantity)) {
      setQuantity(item.quantity)
    }
    // do this differently as it could break easily
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.quantity])

  return (
    <li
      className={cn(s.root, {
        'opacity-50 pointer-events-none': removing,
      })}
      {...rest}
    >
      <div className="flex flex-row" style={{ gap: '12px' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '4px',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <Link to={`/products/${item.slug || item.product_id}`} onClick={() => closeSidebarIfPresent()}>
            <img
              className={s.productImage}
              width={72}
              height={72}
              src={item.image_url || placeholderImg}
              alt={item.name || 'Product Image'}
            />
          </Link>
        </div>
        <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
          <Link to={`/products/${item.slug || item.product_id}`} onClick={() => closeSidebarIfPresent()}>
            <span className={s.productName}>
              {item.name}
            </span>
          </Link>
          <span
            className="mt-1"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--brand)',
            }}
          >
            {price}
          </span>
          {variant === 'display' && (
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Qty: {quantity}
            </div>
          )}
        </div>
      </div>
      {variant === 'default' && (
        <Quantity
          value={quantity}
          handleRemove={handleRemove}
          handleChange={handleChange}
          increase={() => updateQuantity(1)}
          decrease={() => updateQuantity(-1)}
        />
      )}
    </li>
  )
}

export default CartItem
