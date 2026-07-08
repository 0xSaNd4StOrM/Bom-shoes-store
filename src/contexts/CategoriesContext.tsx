import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase, Category } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'

type CategoriesContextType = {
  categories: Category[]
  loading: boolean
  categoryLabel: (value: string) => string
  reload: () => Promise<void>
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined)

// Same "fetch once, degrade gracefully" shape as CurrencyContext/site_content:
// an empty array on a fetch error just means category filters/dropdowns
// render with no options rather than crashing the page.
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { lang } = useLanguage()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('position')
    setCategories(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  function categoryLabel(value: string): string {
    const c = categories.find(c => c.value === value)
    if (!c) return value
    return lang === 'ar' ? c.label_ar : c.label_en
  }

  return (
    <CategoriesContext.Provider value={{ categories, loading, categoryLabel, reload }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories() {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories must be used within CategoriesProvider')
  return ctx
}
