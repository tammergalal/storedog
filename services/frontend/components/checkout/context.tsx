import React, {
  FC,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useReducer,
  useContext,
  createContext,
} from 'react'

import {
  listPaymentMethods,
  listShippingRates,
  updateCheckout,
  completeCheckout,
} from '@lib/api/checkout'
import { useCart } from '@lib/CartContext'
import type {
  PaymentAttributes,
  AddressAttributes,
  ShippingRate,
} from '@customTypes/checkout'

export type State = {
  cardFields: PaymentAttributes
  addressFields: AddressAttributes
}

type CheckoutContextType = State & {
  shippingRate: ShippingRate | null
  addressStatus: {
    ok: boolean | null
    message: any
  }
  paymentStatus: {
    ok: boolean | null
    message: any
  }
  setCardFields: (cardFields: PaymentAttributes) => void
  setAddressFields: (addressFields: AddressAttributes) => void
  clearCheckoutFields: () => void
  handleCompleteCheckout: () => void
}

type Action =
  | {
      type: 'SET_CARD_FIELDS'
      card: PaymentAttributes
    }
  | {
      type: 'SET_ADDRESS_FIELDS'
      address: AddressAttributes
    }
  | {
      type: 'CLEAR_CHECKOUT_FIELDS'
    }

const initialState: State = {
  cardFields: {
    payment_method_id: '1',
    source_attributes: {
      name: 'Jade Angelou',
      number: '4111111111111111',
      month: '01',
      year: '2027',
      verification_value: '123',
    },
  } as PaymentAttributes,
  addressFields: {
    firstname: 'Jade',
    lastname: 'Angelou',
    email: 'jade@ddtraining.datadoghq.com',
    address1: '32 Stenson Drive',
    address2: '',
    zipcode: '94016',
    city: 'San Francisco',
    phone: '555-555-5555',
    state_name: 'CA',
    country_iso: 'US',
  } as AddressAttributes,
}

export const CheckoutContext = createContext<State>(initialState)

CheckoutContext.displayName = 'CheckoutContext'

const checkoutReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_CARD_FIELDS':
      return {
        ...state,
        cardFields: action.card,
      }
    case 'SET_ADDRESS_FIELDS':
      return {
        ...state,
        addressFields: action.address,
      }
    case 'CLEAR_CHECKOUT_FIELDS':
      return {
        ...state,
        cardFields: initialState.cardFields,
        addressFields: initialState.addressFields,
      }
    default:
      return state
  }
}

export const CheckoutProvider: FC = (props) => {
  const [state, dispatch] = useReducer(checkoutReducer, initialState)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [shippingRate, setShippingRate] = useState<ShippingRate | null>(null)
  const [addressStatus, setAddressError] = useState({ ok: null, message: null })
  const [paymentStatus, setPaymentError] = useState({ ok: null, message: null })
  const { cart, cartToken, cartUser } = useCart()

  const getPaymentMethods = useCallback(async () => {
    const result = await listPaymentMethods(cartToken)
    setPaymentMethods(result.payment_methods || [])
  }, [cartToken, setPaymentMethods])

  const getShippingRates = useCallback(async () => {
    const result = await listShippingRates(cartToken)
    const rates = result.shipping_rates || []
    if (rates.length > 0) {
      setShippingRate(rates[0])
    }
  }, [cartToken, setShippingRate])

  const updateAddress = useCallback(
    async (address: AddressAttributes) => {
      try {
        const updatedCart = await updateCheckout(cartToken, {
          email: address.email,
          order: {
            email: address.email,
            bill_address_attributes: address,
            ship_address_attributes: address,
          },
        })

        if ((updatedCart as any).error) {
          throw (updatedCart as any).error
        }

        await getShippingRates()

        setAddressError({ ok: true, message: null })
      } catch (error) {
        console.log(error)
        setAddressError({ ok: false, message: error })
      }
    },
    [cartToken, getShippingRates]
  )

  const handleCompleteCheckout = useCallback(async () => {
    const completedCart = await completeCheckout(cartToken!)
    return completedCart
  }, [cartToken])

  const updatePayment = useCallback(
    async (payment: PaymentAttributes) => {
      try {
        await updateCheckout(cartToken, {
          order: {
            payments_attributes: [payment],
          },
        })
        setPaymentError({ ok: true, message: null })
      } catch (error) {
        console.log(error)
        setPaymentError({ ok: false, message: error })
      }
    },
    [cartToken]
  )

  const updateShipping = useCallback(
    async (rate: ShippingRate) => {
      try {
        await updateCheckout(cartToken, {
          order: {
            shipments_attributes: [
              {
                id: rate.id,
                selected_shipping_rate_id: rate.id,
              },
            ],
          },
        })
      } catch (error) {
        console.log(error)
      }
    },
    [cartToken]
  )

  const setCardFields = useCallback(
    (card: PaymentAttributes) => dispatch({ type: 'SET_CARD_FIELDS', card }),
    [dispatch]
  )

  const setAddressFields = useCallback(
    (address: AddressAttributes) =>
      dispatch({ type: 'SET_ADDRESS_FIELDS', address }),
    [dispatch]
  )

  const clearCheckoutFields = useCallback(
    () => dispatch({ type: 'CLEAR_CHECKOUT_FIELDS' }),
    [dispatch]
  )

  const cardFields = useMemo(() => state.cardFields, [state.cardFields])

  const addressFields = useMemo(
    () => state.addressFields,
    [state.addressFields]
  )

  useEffect(() => {
    if (cartToken) {
      getPaymentMethods()
    }
  }, [cartToken, getPaymentMethods])

  useEffect(() => {
    if (cartToken && cart?.line_items.length && addressFields.country_iso) {
      updateAddress(addressFields)
    }
  }, [cart, cartToken, addressFields, updateAddress])

  useEffect(() => {
    if (cartToken && cardFields.source_attributes.number) {
      updatePayment(cardFields)
    }
  }, [cartToken, cardFields, updatePayment])

  useEffect(() => {
    if (cartToken && shippingRate?.id) {
      updateShipping(shippingRate)
    }
  }, [cartToken, shippingRate, updateShipping])

  // set user name and email based on rum user
  useEffect(() => {
    if (cartUser && cartUser.name && cartUser.email) {
      setAddressFields({
        ...initialState.addressFields,
        email: cartUser.email,
        firstname: cartUser.name.split(' ')[0],
        lastname: cartUser.name.split(' ')[1],
      })
    }
  }, [cartUser, setAddressFields])

  const value = useMemo(
    () => ({
      cardFields,
      addressFields,
      shippingRate,
      addressStatus,
      paymentStatus,
      setCardFields,
      setAddressFields,
      clearCheckoutFields,
      handleCompleteCheckout,
    }),
    [
      cardFields,
      addressFields,
      shippingRate,
      addressStatus,
      paymentStatus,
      setCardFields,
      setAddressFields,
      clearCheckoutFields,
      handleCompleteCheckout,
    ]
  )

  return <CheckoutContext.Provider value={value} {...props} />
}

export const useCheckoutContext = () => {
  const context = useContext<CheckoutContextType>(CheckoutContext)
  if (context === undefined) {
    throw new Error(`useCheckoutContext must be used within a CheckoutProvider`)
  }
  return context
}
