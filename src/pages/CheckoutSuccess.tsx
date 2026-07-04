import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCart } from '@/contexts/CartContext'
import { useT } from '@/contexts/LanguageContext'
import { Check } from 'lucide-react'
import { useSeo } from '@/hooks/useSeo'

export default function CheckoutSuccess() {
  const [params] = useSearchParams()
  const orderId = params.get('orderId') || ''
  const { clearCart } = useCart()
  const cleared = useRef(false)
  const t = useT()

  useSeo({ title: `${t.successTitle} — ${t.brandName}`, description: t.successDesc })

  // Payment confirmation is no longer trusted from the client: this page is
  // just where Kashier redirects the browser back to, which can happen
  // before, after, or without the server-to-server webhook ever firing. The
  // only place payment_status/status/stock are ever mutated is
  // fulfill_order(), called from supabase/functions/kashier-webhook once
  // Kashier actually confirms the payment. (Previously this effect called
  // supabase.from('orders').update({ payment_status: 'paid', ... }) directly
  // from the browser -- anyone could visit this URL with any orderId and
  // mark that order paid without paying, which is the same class of bug
  // this whole change fixes elsewhere; removed rather than left in place.)
  useEffect(() => {
    if (cleared.current) return
    cleared.current = true
    clearCart()
  }, [])

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
