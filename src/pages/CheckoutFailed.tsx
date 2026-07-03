import { Link, useSearchParams } from 'react-router-dom'
import { useT } from '@/contexts/LanguageContext'

export default function CheckoutFailed() {
  const [params] = useSearchParams()
  const orderId = params.get('orderId') || ''
  const t = useT()

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <p className="text-zen text-muted-foreground mb-4">{t.failedEyebrow}</p>
      <h1 className="font-display text-5xl md:text-6xl mb-6 text-balance">
        {t.failedTitle}
      </h1>
      <p className="text-muted-foreground max-w-md font-light mb-4">
        {t.failedDesc}
      </p>
      {orderId && (
        <p className="text-xs text-muted-foreground tracking-widest uppercase mb-10">
          {t.failedReference(orderId)}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
        <Link
          to="/checkout"
          className="bg-primary text-primary-foreground px-7 py-3.5 text-sm tracking-widest uppercase hover:bg-primary/90 transition-colors"
        >
          {t.failedTryAgain}
        </Link>
        <Link
          to="/cart"
          className="text-sm tracking-wider border-b border-foreground/30 pb-1 hover:border-foreground"
        >
          {t.failedBack}
        </Link>
      </div>
    </div>
  )
}
