import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCart } from '@/contexts/CartContext'
import { useT } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import { Check } from 'lucide-react'

export default function CheckoutSuccess() {
  const [params] = useSearchParams()
  const orderId = params.get('orderId') || ''
  const { clearCart } = useCart()
  const cleared = useRef(false)
  const t = useT()

  useEffect(() => {
    if (cleared.current) return
    cleared.current = true

    // Clear cart
    clearCart()

    // Update order status in Supabase
    if (orderId) {
      supabase
        .from('orders')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
        })
        .eq('kashier_order_id', orderId)
        .then(() => {})
    }
  }, [orderId])

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-foreground text-background flex items-center justify-center mb-8">
        <Check className="w-9 h-9" strokeWidth={1.5} />
      </div>
      <p className="text-zen text-muted-foreground mb-4">{t.successEyebrow}</p>
      <h1 className="font-display text-5xl md:text-7xl mb-6 text-balance">
        {t.successTitle}
      </h1>
      <p className="text-muted-foreground max-w-md font-light mb-2">
        {t.successDesc}
      </p>
      {orderId && (
        <p className="text-xs text-muted-foreground tracking-widest uppercase mb-10">
          {t.successOrder(orderId)}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
        <Link
          to="/shop"
          className="bg-primary text-primary-foreground px-7 py-3.5 text-sm tracking-widest uppercase hover:bg-primary/90 transition-colors"
        >
          {t.successContinue}
        </Link>
        <Link
          to="/account"
          className="text-sm tracking-wider border-b border-foreground/30 pb-1 hover:border-foreground"
        >
          {t.successViewOrders}
        </Link>
      </div>
    </div>
  )
}
