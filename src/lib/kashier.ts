// Kashier.io payment integration
// Documentation: https://developers.kashier.io/
//
// All merchant-id/API-key lookup, hosted-checkout URL building, and
// HMAC-SHA256 signing now happens server-side in
// supabase/functions/create-order (and the webhook is verified in
// supabase/functions/kashier-webhook). No Kashier secret and no
// signature-building logic may live in this frontend -- these types just
// describe the shape of the create-order edge function's request/response
// for callers like src/pages/Checkout.tsx.

export type CreateOrderItem = {
  product_id: string
  size: string
  color: string
  quantity: number
}

export type CreateOrderCustomer = {
  fullName: string
  email: string
  phone?: string
  address: string
  city: string
  country: string
  notes?: string
}

export type CreateOrderRequest = {
  items: CreateOrderItem[]
  customer: CreateOrderCustomer
  couponCode?: string
}

export type CreateOrderResponse = {
  orderId: string
  checkoutUrl: string
  discountAmount: number
}
