import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase, Brand } from '@/lib/supabase'

type BrandsContextType = {
  brands: Brand[]
  loading: boolean
  reload: () => Promise<void>
}

const BrandsContext = createContext<BrandsContextType | undefined>(undefined)

// Same fetch-once, degrade-gracefully shape as CategoriesContext: an empty
// array on error just means the brand bar / brands page render nothing rather
// than crashing. Brand `value` is already the display name, so no label map.
export function BrandsProvider({ children }: { children: ReactNode }) {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await supabase.from('brands').select('*').order('position')
    setBrands(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  return (
    <BrandsContext.Provider value={{ brands, loading, reload }}>
      {children}
    </BrandsContext.Provider>
  )
}

export function useBrands() {
  const ctx = useContext(BrandsContext)
  if (!ctx) throw new Error('useBrands must be used within BrandsProvider')
  return ctx
}
