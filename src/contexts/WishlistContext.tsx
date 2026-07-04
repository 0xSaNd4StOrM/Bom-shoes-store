import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LanguageContext'

type WishlistContextType = {
  isWishlisted: (productId: string) => boolean
  toggleWishlist: (productId: string) => Promise<void>
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [wishlisted, setWishlisted] = useState<Set<string>>(new Set())
  // ponytail: per-product in-flight guard, blocks a second toggle instead of queuing it
  const pending = useRef<Set<string>>(new Set())
  const t = useT()

  // Reload whenever auth state settles on a user (or clears on sign-out).
  useEffect(() => {
    if (!user) {
      setWishlisted(new Set())
      return
    }
    supabase
      .from('wishlist_items')
      .select('product_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setWishlisted(new Set((data || []).map(row => row.product_id)))
      })
  }, [user])

  function isWishlisted(productId: string) {
    return wishlisted.has(productId)
  }

  async function toggleWishlist(productId: string) {
    if (!user) return
    if (pending.current.has(productId)) return // a toggle for this product is already in flight
    pending.current.add(productId)

    const wasWishlisted = wishlisted.has(productId)

    // Optimistic update first, revert below if the DB call fails.
    setWishlisted(current => {
      const next = new Set(current)
      if (wasWishlisted) next.delete(productId)
      else next.add(productId)
      return next
    })

    try {
      const { error } = wasWishlisted
        ? await supabase.from('wishlist_items').delete().eq('user_id', user.id).eq('product_id', productId)
        : await supabase.from('wishlist_items').insert({ user_id: user.id, product_id: productId })

      if (error) {
        setWishlisted(current => {
          const next = new Set(current)
          if (wasWishlisted) next.add(productId)
          else next.delete(productId)
          return next
        })
        toast.error(t.wishlistError)
      }
    } finally {
      pending.current.delete(productId)
    }
  }

  return (
    <WishlistContext.Provider value={{ isWishlisted, toggleWishlist }}>
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider')
  return ctx
}
