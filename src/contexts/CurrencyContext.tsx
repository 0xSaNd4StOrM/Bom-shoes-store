import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'

// Singleton row id -- see supabase/migrations. Always read this exact id.
const STORE_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

// Display currency only -- Kashier always settles in EGP (see create-order).
// This just controls how prices are shown to shoppers.
type CurrencyContextType = {
  currency: string
  formatPrice: (amount: number) => string
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

// Symbol + side per currency code, bilingual. PREFIX => "$420";
// SUFFIX => "420 ج.م". Unknown codes fall back to "<code> <amount>".
function symbolFor(code: string, lang: string): { symbol: string; side: 'prefix' | 'suffix' } | null {
  switch (code) {
    case 'USD': return { symbol: '$', side: 'prefix' }
    case 'EUR': return { symbol: '€', side: 'prefix' }
    case 'GBP': return { symbol: '£', side: 'prefix' }
    case 'EGP': return lang === 'ar' ? { symbol: 'ج.م', side: 'suffix' } : { symbol: 'E£', side: 'prefix' }
    case 'SAR': return { symbol: lang === 'ar' ? 'ر.س' : 'SAR', side: 'suffix' }
    case 'AED': return { symbol: lang === 'ar' ? 'د.إ' : 'AED', side: 'suffix' }
    default: return null
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { lang } = useLanguage()
  const [currency, setCurrency] = useState('EGP')

  // One-time fetch of the admin-configured display currency. Stays 'EGP' on a
  // missing row or fetch error (two-arg .then, never .catch on the query
  // builder -- it's a thenable, not a real promise).
  useEffect(() => {
    let cancelled = false
    supabase
      .from('store_settings')
      .select('currency')
      .eq('id', STORE_SETTINGS_ID)
      .maybeSingle()
      .then(
        ({ data }) => { if (!cancelled) setCurrency(data?.currency || 'EGP') },
        () => {} // leave 'EGP' default
      )
    return () => { cancelled = true }
  }, [])

  function formatPrice(amount: number): string {
    const rounded = Math.round(amount)
    const fmt = symbolFor(currency, lang)
    if (!fmt) return `${currency} ${rounded}`
    return fmt.side === 'prefix' ? `${fmt.symbol}${rounded}` : `${rounded} ${fmt.symbol}`
  }

  return (
    <CurrencyContext.Provider value={{ currency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}
