export interface ShippingRate {
  id: number
  name: string
  cost: number
}

export interface PaymentMethod {
  id: number
  name: string
}

export interface AddressAttributes {
  firstname: string
  lastname: string
  address1: string
  address2?: string
  city: string
  phone: string
  zipcode: string
  state_name: string
  country_iso: string
  email: string
}

export interface PaymentAttributes {
  payment_method_id: string
  source_attributes: {
    gateway_payment_profile_id?: string
    number: string
    name: string
    month: string
    year: string
    cc_type?: string
    verification_value: string
  }
}
