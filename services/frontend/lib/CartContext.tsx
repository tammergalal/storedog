import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from 'react'
import {
  createCart,
  getCart,
  deleteCart,
  addToCart,
  removeFromCart,
  updateQuantity,
  applyCouponCode,
} from '@lib/api/cart'
import { datadogRum } from '@datadog/browser-rum'
import userData from '@config/user_data.json'
import type { Cart } from '@customTypes/cart'

type CartProviderProps = {
  children: ReactNode
}

type CartContextType = {
  cart: Cart | null
  cartToken: string | null
  cartError: any
  cartUser: any
  setCart: (cart: Cart | null) => void
  cartInit: () => Promise<string | null>
  cartEmpty: () => Promise<void>
  cartDelete: () => Promise<void>
  cartAdd: (variantId: string, quantity: number) => Promise<any>
  cartRemove: (lineItemId: string | number) => Promise<any>
  cartUpdate: (lineItemId: string | number, quantity: number) => Promise<any>
  applyDiscount: (couponCode: string) => Promise<any>
}

export const CartContext = createContext<CartContextType>({
  cart: null,
  cartToken: null,
  cartError: null,
  cartUser: null,
  setCart: () => {},
  cartInit: async () => null,
  cartEmpty: async () => {},
  cartDelete: async () => {},
  cartAdd: async () => {},
  cartRemove: async () => {},
  cartUpdate: async () => {},
  applyDiscount: async () => {},
})

export const CartProvider = ({ children }: CartProviderProps) => {
  const [cart, setCart] = useState<Cart | null>(null)
  const [cartToken, setCartToken] = useState<string | null>(null)
  const [cartError, setCartError] = useState<any>()
  const [cartUser, setCartUser] = useState<any>()

  useEffect(() => {
    cartInit()
  }, [])

  useEffect(() => {
    localStorage.setItem('cartToken', cartToken || '')
  }, [cartToken])

  useEffect(() => {
    // if user exists in local storage, set user or create a new user
    if (localStorage.getItem('rum_user')) {
      const user = JSON.parse(localStorage.getItem('rum_user') || '')
      datadogRum.setUser(user)
      setCartUser(user)
    } else {
      const user = userData[Math.floor(Math.random() * userData.length)]
      datadogRum.setUser(user)
      localStorage.setItem('rum_user', JSON.stringify(user))
      setCartUser(user)
    }
  }, [])

  // init cart — returns the resolved token so callers can use it directly
  const cartInit = async (): Promise<string | null> => {
    const storedToken = localStorage.getItem('cartToken')

    try {
      if (storedToken && storedToken !== 'undefined') {
        let cartData: Cart
        try {
          cartData = await getCart(storedToken)
        } catch {
          // Token invalid, create a new cart
          localStorage.removeItem('cartToken')
          cartData = await createCart()
        }

        setCart(cartData)
        setCartToken(cartData.token)
        setCartError(null)
        return cartData.token
      } else {
        const cartData = await createCart()
        localStorage.setItem('cartToken', cartData.token)
        setCart(cartData)
        setCartToken(cartData.token)
        setCartError(null)
        return cartData.token
      }
    } catch (error) {
      console.error(error)
      setCartError(error)
      return null
    }
  }

  // empty cart — calls backend to delete the server-side cart before clearing local state
  const cartEmpty = async () => {
    try {
      if (cartToken) {
        await deleteCart(cartToken)
      }
      setCart(null)
      setCartToken(null)
      setCartError(null)
    } catch (error) {
      console.error(error)
      setCartError(error)
    }
  }

  // delete cart
  const cartDelete = async () => {
    try {
      if (cartToken) {
        await deleteCart(cartToken)
      }
      setCart(null)
      setCartToken(null)
      setCartError(null)
    } catch (error) {
      console.error(error)
      setCartError(error)
    }
  }

  // add to cart — uses cartInit return value directly to avoid localStorage race condition
  const cartAdd = async (variantId: string, quantity: number) => {
    try {
      const token = cartToken || (await cartInit())
      if (!token) {
        setCartError('Could not initialize cart')
        return { error: 'Could not initialize cart' }
      }
      const cartData = await addToCart(token, variantId, quantity)
      setCart(cartData)
      setCartError(null)
      return cartData
    } catch (error) {
      console.error(error)
      setCartError(error)
      return { error }
    }
  }

  // remove from cart
  const cartRemove = async (lineItemId: string | number) => {
    try {
      if (cartToken) {
        const cartData = await removeFromCart(cartToken, lineItemId)
        setCart(cartData)
        setCartError(null)
      } else {
        setCartError('Cart not found')
      }
    } catch (error) {
      console.error(error)
      setCartError(error)
    }
  }

  // update quantity
  const cartUpdate = async (lineItemId: string | number, quantity: number) => {
    try {
      if (cartToken) {
        const cartData = await updateQuantity(cartToken, lineItemId, quantity)
        setCart(cartData)
        setCartError(null)
      } else {
        setCartError('Cart not found')
      }
    } catch (error) {
      console.error(error)
      setCartError(error)
    }
  }

  const applyDiscount = async (couponCode: string) => {
    try {
      if (cartToken) {
        const cartData = await applyCouponCode(cartToken, couponCode)
        console.log('Discount Applied response', cartData)
        setCart(cartData)
        setCartError(null)
      } else {
        setCartError('Cart not found')
      }
    } catch (error) {
      console.error(error)
      setCartError(error)
    }
  }

  return (
    <CartContext.Provider
      value={{
        cart,
        cartToken,
        cartError,
        cartUser,
        setCart,
        cartInit,
        cartEmpty,
        cartDelete,
        cartAdd,
        cartRemove,
        cartUpdate,
        applyDiscount,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
