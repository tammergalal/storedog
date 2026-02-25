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
      name: 'John Doe',
      number: '1234567890123456789012345', // 25 digits — no real card can have this
      month: '01',
      year: '2099',
      verification_value: '000',
    },
  } as PaymentAttributes,
  addressFields: {
    firstname: 'John',
    lastname: 'Doe',
    email: 'john@ddtraining.datadoghq.com',
    address1: '1 Penguin Lane',
    address2: '',
    zipcode: '00000',
    city: 'McMurdo Station',
    phone: '555-555-0000',
    state_name: 'Ross Island',
    country_iso: 'AQ',
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
  // Pre-validated — fake data is always ready, no user entry needed
  const [addressStatus, setAddressError] = useState<{ ok: boolean | null; message: any }>({ ok: true, message: null })
  const [paymentStatus, setPaymentError] = useState<{ ok: boolean | null; message: any }>({ ok: true, message: null })
  const { cartToken } = useCart()

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

  // Declare memos before any callback that references them (temporal dead zone)
  const cardFields = useMemo(() => state.cardFields, [state.cardFields])
  const addressFields = useMemo(() => state.addressFields, [state.addressFields])

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

  // Simulated checkout — advances cart state for real APM traces, always resolves as success
  const handleCompleteCheckout = useCallback(async () => {
    if (!cartToken) return {}
    const payload = {
      email: addressFields.email,
      ship_address: addressFields,
      bill_address: addressFields,
      payment_method_id: 1,
    }
    try {
      // Drive through state machine: cart → address → delivery → payment → complete
      await updateCheckout(cartToken, payload)
      await updateCheckout(cartToken, payload)
      await updateCheckout(cartToken, payload)
      return await completeCheckout(cartToken)
    } catch {
      // Return success regardless — this is a demo, no real payment processing
      return {}
    }
  }, [cartToken, addressFields])

  useEffect(() => {
    if (cartToken) {
      getPaymentMethods()
    }
  }, [cartToken, getPaymentMethods])

  // Note: address/payment/shipping updates happen in handleCompleteCheckout for real APM traces

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
