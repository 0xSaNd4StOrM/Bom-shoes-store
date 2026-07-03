import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '@/contexts/CartContext'
import { useAuth } from '@/contexts/AuthContext'
import { useT, useLanguage } from '@/contexts/LanguageContext'
import { supabase } from '@/lib/supabase'
import { initiateKashierPayment } from '@/lib/kashier'
import { ArrowLeft, CreditCard, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

export default function Checkout() {
  const { items, totalPrice, clearCart } = useCart()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const { lang } = useLanguage()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    fullName: profile?.full_name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    country: lang === 'ar' ? 'مصر' : 'Egypt',
    notes: '',
  })

  const shipping = totalPrice > 200 ? 0 : 15
  const tax = totalPrice * 0.08
  const grand = totalPrice + shipping + tax

  function setField(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) return
    if (!form.fullName || !form.email || !form.address || !form.city) {
      toast.error(t.checkoutRequired)
      return
    }

    setSubmitting(true)

    try {
      // Create the order in Supabase
      const orderId = `MASHWAR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      const orderItems = items.map(i => ({
        product_id: i.product.id,
        name: i.product.name,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        price: i.product.price,
        image_url: i.product.image_url,
      }))

      const { data: order, error } = await supabase.from('orders').insert({
        user_id: user?.id || null,
        customer_name: form.fullName,
        customer_email: form.email,
        customer_phone: form.phone,
        shipping_address: `${form.address}, ${form.city}, ${form.country}${form.notes ? ' | ' + form.notes : ''}`,
        total_amount: grand,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'kashier',
        kashier_order_id: orderId,
        items: orderItems,
      }).select().single()

      if (error) throw error

      // Update stock
      for (const item of items) {
        await supabase.rpc('decrement_stock', {
          product_id: item.product.id,
          qty: item.quantity,
        }).then(() => {}) // ignore if RPC doesn't exist
        // Fallback: direct update
        await supabase
          .from('products')
          .update({ stock: Math.max(0, item.product.stock - item.quantity) })
          .eq('id', item.product.id)
      }

      // Initiate Kashier payment
      await initiateKashierPayment({
        orderId: orderId,
        amount: grand,
        currency: 'USD',
        customerName: form.fullName,
        customerEmail: form.email,
        customerPhone: form.phone,
        description: `Mashwar order ${orderId}, ${items.length} ${items.length === 1 ? 'piece' : 'pieces'}`,
        items: orderItems,
      })

      // Note: We do NOT clear cart here because the user might return from a failed payment.
      // The cart will be cleared on the success page.
    } catch (err: any) {
      console.error(err)
      toast.error(t.checkoutFailed)
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-zen text-muted-foreground mb-4">{t.cartEyebrow}</p>
        <Link to="/shop" className="font-display text-2xl mb-3">{t.cartEmptyTitle}</Link>
        <Link to="/shop" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          {t.cartEmptyCta}
        </Link>
      </div>
    )
  }

  const fieldFullName = `${t.fieldFullName}${t.fieldRequired}`
  const fieldEmail = `${t.fieldEmail}${t.fieldRequired}`
  const fieldPhone = t.fieldPhone
  const fieldCountry = `${t.fieldCountry}${t.fieldRequired}`
  const fieldAddress = `${t.fieldAddress}${t.fieldRequired}`
  const fieldCity = `${t.fieldCity}${t.fieldRequired}`
  const fieldNotes = t.fieldNotes

  return (
    <div className="px-6 lg:px-10 py-12 lg:py-16">
      <div className="max-w-[1400px] mx-auto">
        <Link
          to="/cart"
          className="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground mb-10"
        >
          <ArrowLeft className="w-3.5 h-3.5 flip-rtl" />
          {t.checkoutBack}
        </Link>

        <div className="grid lg:grid-cols-[1fr_440px] gap-12 lg:gap-16">
          <form onSubmit={handleSubmit} className="space-y-10">
            <div>
              <p className="text-zen text-muted-foreground mb-3">{t.checkoutStep1}</p>
              <h1 className="font-display text-3xl md:text-4xl mb-8">{t.checkoutShipping}</h1>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={fieldFullName} value={form.fullName} onChange={v => setField('fullName', v)} required dir={lang === 'ar' ? 'rtl' : 'ltr'} />
                <Field label={fieldEmail} type="email" value={form.email} onChange={v => setField('email', v)} required dir={lang === 'ar' ? 'rtl' : 'ltr'} />
                <Field label={fieldPhone} type="tel" value={form.phone} onChange={v => setField('phone', v)} dir={lang === 'ar' ? 'rtl' : 'ltr'} />
                <Field label={fieldCountry} value={form.country} onChange={v => setField('country', v)} required dir={lang === 'ar' ? 'rtl' : 'ltr'} />
                <div className="sm:col-span-2">
                  <Field label={fieldAddress} value={form.address} onChange={v => setField('address', v)} required dir={lang === 'ar' ? 'rtl' : 'ltr'} />
                </div>
                <Field label={fieldCity} value={form.city} onChange={v => setField('city', v)} required dir={lang === 'ar' ? 'rtl' : 'ltr'} />
                <Field label={fieldNotes} value={form.notes} onChange={v => setField('notes', v)} dir={lang === 'ar' ? 'rtl' : 'ltr'} />
              </div>
            </div>

            <div>
              <p className="text-zen text-muted-foreground mb-3">{t.checkoutStep2}</p>
              <h2 className="font-display text-3xl md:text-4xl mb-2">{t.checkoutPayment}</h2>
              <p className="text-sm text-muted-foreground font-light mb-6">
                {t.checkoutPaymentDesc}
              </p>
              <div className="border border-border p-6 bg-muted/30">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center flex-shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg mb-1">{t.checkoutKashierTitle}</h3>
                    <p className="text-sm text-muted-foreground font-light leading-relaxed">
                      {t.checkoutKashierDesc}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground tracking-wider">
                      <span className="px-2 py-1 border border-border">VISA</span>
                      <span className="px-2 py-1 border border-border">MASTERCARD</span>
                      <span className="px-2 py-1 border border-border">MEEZA</span>
                      <span className="px-2 py-1 border border-border">FAWRY</span>
                      <span className="px-2 py-1 border border-border">VODAFONE CASH</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground py-4 text-sm tracking-widest uppercase hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? t.checkoutPreparing : (
                <>
                  <CreditCard className="w-4 h-4" />
                  {t.checkoutContinue(grand.toFixed(0))}
                </>
              )}
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              {t.checkoutTerms}
            </p>
          </form>

          {/* Summary */}
          <aside className="lg:sticky lg:top-28 h-fit">
            <div className="border border-border p-6 lg:p-8 bg-card">
              <h2 className="font-display text-2xl mb-6">{t.checkoutYourOrder}</h2>
              <div className="space-y-4 mb-6 max-h-80 overflow-y-auto">
                {items.map(item => (
                  <div key={`${item.product.id}-${item.size}-${item.color}`} className="flex gap-3">
                    <div className="w-14 h-14 bg-muted overflow-hidden flex-shrink-0 relative">
                      <img src={item.product.image_url || ''} alt="" className="w-full h-full object-cover" />
                      <span className="absolute -top-1 -end-1 w-5 h-5 bg-foreground text-background text-[10px] rounded-full flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">{item.color}, {item.size}</p>
                    </div>
                    <p className="text-sm">${(item.product.price * item.quantity).toFixed(0)}</p>
                  </div>
                ))}
              </div>
              <dl className="space-y-2 text-sm border-t border-border pt-4">
                <div className="flex justify-between"><dt className="text-muted-foreground">{t.cartSubtotal}</dt><dd>${totalPrice.toFixed(0)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t.cartShipping}</dt><dd>{shipping === 0 ? t.cartFree : `$${shipping.toFixed(0)}`}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">{t.cartTax}</dt><dd>${tax.toFixed(0)}</dd></div>
                <div className="pt-3 border-t border-border flex justify-between items-baseline">
                  <dt>{t.cartTotal}</dt>
                  <dd className="font-display text-2xl">${grand.toFixed(0)}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', required, dir
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  dir?: 'rtl' | 'ltr'
}) {
  return (
    <label className="block">
      <span className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        dir={dir}
        className="w-full bg-transparent border-b border-foreground/30 focus:border-foreground outline-none py-2 text-sm transition-colors"
      />
    </label>
  )
}
