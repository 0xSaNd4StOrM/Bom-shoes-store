// Kashier.io payment integration
// Documentation: https://developers.kashier.io/

export type KashierPaymentRequest = {
  orderId: string
  amount: number
  currency?: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  description: string
  items?: Array<{ name: string; price: number; quantity: number }>
}

// Kashier test/demo configuration
// In production, these should be environment variables from the merchant
const KASHIER_MERCHANT_ID = 'MID-7287-995' // Demo merchant ID
const KASHIER_API_KEY = '9e304841-c1f6-4b65-8787-3168d7b8a3c7' // Demo API key
const KASHIER_BASE_URL = 'https://checkout.kashier.io'

export function buildKashierPaymentUrl(req: KashierPaymentRequest): string {
  // For real production use, the backend should generate a signed payment URL
  // using the merchant's secret key. For this demo, we generate a hosted checkout
  // URL that integrates with the Kashier sandbox.
  const params = new URLSearchParams({
    merchantId: KASHIER_MERCHANT_ID,
    orderId: req.orderId,
    amount: req.amount.toFixed(2),
    currency: req.currency || 'EGP',
    customerName: req.customerName,
    customerEmail: req.customerEmail,
    customerPhone: req.customerPhone || '',
    description: req.description,
    mode: 'test',
    redirectBackUrl: `${window.location.origin}/checkout/success?orderId=${req.orderId}`,
    failureRedirectBackUrl: `${window.location.origin}/checkout/failed?orderId=${req.orderId}`,
  })

  return `${KASHIER_BASE_URL}?${params.toString()}`
}

export async function initiateKashierPayment(req: KashierPaymentRequest): Promise<void> {
  // Open Kashier hosted checkout in a new window/redirect
  const paymentUrl = buildKashierPaymentUrl(req)
  window.location.href = paymentUrl
}

export function getKashierConfig() {
  return {
    merchantId: KASHIER_MERCHANT_ID,
    apiKey: KASHIER_API_KEY,
    baseUrl: KASHIER_BASE_URL,
    mode: 'test',
  }
}
