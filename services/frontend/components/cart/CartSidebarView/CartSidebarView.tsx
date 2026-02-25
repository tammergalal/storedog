import cn from 'clsx'
import { Link } from '@remix-run/react'
import { FC } from 'react'
import s from './CartSidebarView.module.css'
import CartItem from '../CartItem'
import { Button } from '@components/ui'
import { useUI } from '@components/ui/context'
import { Bag, Cross, Check } from '@components/icons'
import { useCart } from '@lib/CartContext'
import usePrice from '@lib/hooks/usePrice'
import SidebarLayout from '@components/common/SidebarLayout'

const CartSidebarView: FC = () => {
  const { closeSidebar, setSidebarView } = useUI()
  const { cart } = useCart()

  const { price: subTotal } = usePrice(
    cart && {
      amount: Number(cart.subtotal),
      currencyCode: cart.currency,
    }
  )
  const { price: total } = usePrice(
    cart && {
      amount: Number(cart.total),
      currencyCode: cart.currency,
    }
  )
  const handleClose = () => closeSidebar()
  const goToCheckout = () => setSidebarView('CHECKOUT_VIEW')

  const error = null
  const success = null

  return (
    <SidebarLayout
      id="cart-sidebar"
      className={cn({
        [s.empty]: error || success || !cart,
      })}
      handleClose={handleClose}
    >
      {!cart || !cart.line_items.length ? (
        <div className="flex-1 px-4 flex flex-col justify-center items-center">
          <span
            className="rounded-full flex items-center justify-center w-16 h-16 p-12"
            style={{
              border: '1px dashed var(--border-subtle)',
              backgroundColor: 'var(--surface-alt)',
              color: 'var(--text-muted)',
            }}
          >
            <Bag className="absolute" />
          </span>
          <h2
            className="pt-6 text-xl tracking-wide text-center"
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              color: 'var(--text-muted)',
            }}
          >
            Your cart is empty
          </h2>
          <p
            className="px-10 text-center pt-2 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Browse our collection and add items to your cart.
          </p>
          <Link
            to="/"
            onClick={handleClose}
            className="mt-4 text-sm font-medium"
            style={{ color: 'var(--brand)' }}
          >
            Continue Shopping
          </Link>
        </div>
      ) : error ? (
        <div className="flex-1 px-4 flex flex-col justify-center items-center">
          <span className="border border-white rounded-full flex items-center justify-center w-16 h-16">
            <Cross width={24} height={24} />
          </span>
          <h2 className="pt-6 text-xl font-light text-center">
            We couldn't process the purchase. Please check your card information
            and try again.
          </h2>
        </div>
      ) : success ? (
        <div className="flex-1 px-4 flex flex-col justify-center items-center">
          <span className="border border-white rounded-full flex items-center justify-center w-16 h-16">
            <Check />
          </span>
          <h2 className="pt-6 text-xl font-light text-center">
            Thank you for your order.
          </h2>
        </div>
      ) : (
        <>
          <div className="px-4 sm:px-6 flex-1">
            <h2
              className="pt-2 pb-4"
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '20px',
                fontWeight: 600,
                color: 'var(--text-base)',
              }}
            >
              Your Cart
            </h2>
            <ul className={s.lineItemsList}>
              {cart?.line_items.map((item: any) => (
                <CartItem
                  key={item.id}
                  item={item}
                  currencyCode={cart?.currency}
                />
              ))}
            </ul>
          </div>

          <div
            className="flex-shrink-0 px-6 py-6 sm:px-6 sticky z-20 bottom-0 w-full right-0 left-0"
            style={{
              backgroundColor: '#ffffff',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <ul className="pb-2">
              <li className="flex justify-between py-1">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                <span className="text-sm" style={{ fontWeight: 600, color: 'var(--text-base)' }}>{subTotal}</span>
              </li>
              <li className="flex justify-between py-1">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Taxes</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Calculated at checkout</span>
              </li>
              <li className="flex justify-between py-1">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Shipping</span>
                <span className="text-sm" style={{ fontWeight: 600, color: 'var(--text-base)' }}>
                  {Number(cart?.ship_total).toFixed(2) || 'TBD'}
                </span>
              </li>
            </ul>
            <div
              className="flex justify-between py-3 mb-2"
              style={{
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-base)',
              }}
            >
              <span>Total</span>
              <span>{total}</span>
            </div>
            <div id="proceed-to-checkout">
              <button
                onClick={goToCheckout}
                data-dd-action-name="Proceed to Checkout"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--brand)',
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '14px 24px',
                  fontSize: '15px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--brand-dark)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--brand)')}
              >
                Proceed to Checkout ({total})
              </button>
            </div>
          </div>
        </>
      )}
    </SidebarLayout>
  )
}

export default CartSidebarView
