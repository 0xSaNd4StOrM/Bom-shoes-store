import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '@/contexts/CartContext'
import { useAuth } from '@/contexts/AuthContext'
import { useT, useLanguage } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import { Minus, Plus, X, ArrowRight, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { useSeo } from '@/hooks/useSeo'

type CouponPreview = { amount: number; description: string | null; freeShipping: boolean }

export default function Cart() {
  const { items, updateQuantity, removeItem, totalItems, totalPrice, clearCart, couponCode, setCouponCode } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const { lang } = useLanguage()

  useSeo({ title: `${t.cart} — ${t.brandName}`, description: t.cartEmptyDesc })

  const [couponInput, setCouponInput] = useState('')
  const [applying, setApplying] = useState(false)
  const [discount, setDiscount] = useState<CouponPreview | null>(null)

  // Re-preview a coupon already applied in a previous visit (persisted in
  // localStorage) -- silently drops it if it's no longer valid. Only runs
  // once on mount; a later cart-quantity edit won't refresh this preview
  // (see task note: reasonable preview, not bulletproof) -- the authoritative
  // number is always recomputed at order creation regardless.
  useEffect(() => {
    if (couponCode && items.length > 0) {
      void applyCoupon(couponCode, { silent: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function applyCoupon(code: string, opts?: { silent?: boolean }) {
    setApplying(true)
    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: {
          code,
          items: items.map(i => ({ product_id: i.product.id, size: i.size, color: i.color, quantity: i.quantity })),
          customerEmail: user?.email,
        },
      })
      if (error) throw error
      if (!data?.valid) {
        if (opts?.silent) setCouponCode(null)
        else toast.error(data?.reason || t.cartCouponInvalid)
        setDiscount(null)
        return
      }
      setCouponCode(code)
      setDiscount({ amount: data.discountAmount, description: data.description, freeShipping: !!data.freeShipping })
    } catch (err: any) {
      console.error(err)
      if (!opts?.silent) toast.error(err?.message || t.cartCouponInvalid)
      setDiscount(null)
    } finally {
      setApplying(false)
    }
  }

  function handleApplyClick() {
    const code = couponInput.trim()
    if (!code) return
    void applyCoupon(code)
  }

  function handleRemoveCoupon() {
    setCouponCode(null)
    setDiscount(null)
    setCouponInput('')
  }

  const shipping = discount?.freeShipping ? 0 : totalPrice > 200 ? 0 : 15
  const tax = totalPrice * 0.08
  const hasDiscount = !!discount && discount.amount > 0
  const grand = totalPrice + shipping + tax - (hasDiscount ? discount!.amount : 0)

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          <ShoppingBag className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-zen text-muted-foreground mb-4">{t.cartEyebrow}</p>
        <h1 className="font-display text-4xl md:text-5xl mb-4">{t.cartEmptyTitle}</h1>
        <p className="text-muted-foreground max-w-sm mb-8 font-light">
          {t.cartEmptyDesc}
        </p>
        <Link
          to="/shop"
          className="bg-foreground text-background px-7 py-3.5 text-sm tracking-widest uppercase hover:bg-foreground/85 transition-colors"
        >
          {t.cartEmptyCta}
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream px-6 lg:px-10 py-12 lg:py-16">
      <div className="max-w-[1400px] mx-auto">
        <p className="text-zen text-muted-foreground mb-4">{t.cartEyebrow}</p>
        <h1 className="font-display text-4xl md:text-6xl mb-12">
          {t.cartPieces(totalItems)}
        </h1>

        <div className="grid lg:grid-cols-[1fr_400px] gap-12 lg:gap-16">
          {/* Items */}
          <div className="space-y-8">
            {items.map(item => (
              <div
                key={`${item.product.id}-${item.size}-${item.color}`}
                className="flex gap-4 sm:gap-6 pb-8 border-b border-border last:border-0"
              >
                <Link to={`/product/${item.product.slug}`} className="flex-shrink-0 w-24 sm:w-32 aspect-square bg-muted overflow-hidden">
                  <img
                    src={item.product.image_url || ''}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link
                        to={`/product/${item.product.slug}`}
                        className="font-display text-xl hover:text-muted-foreground transition-colors"
                      >
                        {item.product.name}
                      </Link>
                      <p className="text-xs text-muted-foreground tracking-wider uppercase mt-1">
                        {item.product.category}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {item.color}, Size {item.size}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.product.id, item.size, item.color)}
                      className="p-1 -m-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label={t.cartRemove}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center border border-border">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.size, item.color, item.quantity - 1)}
                        className="p-2 hover:bg-muted transition-colors cursor-pointer"
                        aria-label={t.cartDecrease}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-10 text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.size, item.color, item.quantity + 1)}
                        className="p-2 hover:bg-muted transition-colors cursor-pointer"
                        aria-label={t.cartIncrease}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-sm font-medium">
                      ${(item.product.price * item.quantity).toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-4">
              <button
                onClick={clearCart}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase cursor-pointer"
              >
                {t.cartClear}
              </button>
              <Link
                to="/shop"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase"
              >
                {t.cartContinue}
              </Link>
            </div>
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-28 h-fit">
            <div className="border border-border p-6 lg:p-8 bg-card">
              <h2 className="font-display text-2xl mb-6">{t.checkoutYourOrder}</h2>

              {/* Coupon */}
              <div className="mb-6">
                {!couponCode ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={e => setCouponInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleApplyClick() } }}
                      placeholder={t.cartCouponPlaceholder}
                      className="flex-1 min-w-0 bg-transparent border-b border-foreground/30 focus:border-foreground outline-none py-2 text-sm transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleApplyClick}
                      disabled={applying || !couponInput.trim()}
                      className="px-4 text-xs tracking-widest uppercase border border-border hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {t.cartCouponApply}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 text-sm border border-border px-3 py-2">
                    <span className="truncate">
                      {couponCode}
                      {discount?.description ? ` — ${discount.description}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="p-1 -m-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex-shrink-0"
                      aria-label={t.cartRemove}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t.cartSubtotal}</dt>
                  <dd>${totalPrice.toFixed(0)}</dd>
                </div>
                {hasDiscount && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t.cartDiscount}</dt>
                    <dd>−${discount!.amount.toFixed(0)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t.cartShipping}</dt>
                  <dd>{shipping === 0 ? t.cartFree : `$${shipping.toFixed(0)}`}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t.cartTax}</dt>
                  <dd>${tax.toFixed(0)}</dd>
                </div>
                <div className="pt-3 mt-3 border-t border-border flex justify-between items-baseline">
                  <dt>{t.cartTotal}</dt>
                  <dd className="font-display text-2xl">${grand.toFixed(0)}</dd>
                </div>
              </dl>
              <button
                onClick={() => navigate('/checkout')}
                className="mt-6 w-full bg-foreground text-background py-4 text-sm tracking-widest uppercase hover:bg-foreground/85 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {t.cartCheckout}
                <ArrowRight className="w-4 h-4 flip-rtl" />
              </button>
              <p className="text-[11px] text-muted-foreground text-center mt-4">
                {t.cartSecure}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
