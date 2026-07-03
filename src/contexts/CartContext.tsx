import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Product } from '@/lib/supabase'

export type CartItem = {
  product: Product
  size: string
  color: string
  quantity: number
}

type CartContextType = {
  items: CartItem[]
  addItem: (product: Product, size: string, color: string, quantity?: number) => void
  removeItem: (productId: string, size: string, color: string) => void
  updateQuantity: (productId: string, size: string, color: string, quantity: number) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_KEY = 'zen-shoes-cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items))
  }, [items])

  function addItem(product: Product, size: string, color: string, quantity = 1) {
    setItems(current => {
      const idx = current.findIndex(
        i => i.product.id === product.id && i.size === size && i.color === color
      )
      if (idx >= 0) {
        const copy = [...current]
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + quantity }
        return copy
      }
      return [...current, { product, size, color, quantity }]
    })
  }

  function removeItem(productId: string, size: string, color: string) {
    setItems(current => current.filter(
      i => !(i.product.id === productId && i.size === size && i.color === color)
    ))
  }

  function updateQuantity(productId: string, size: string, color: string, quantity: number) {
    if (quantity <= 0) {
      removeItem(productId, size, color)
      return
    }
    setItems(current => current.map(i =>
      i.product.id === productId && i.size === size && i.color === color
        ? { ...i, quantity }
        : i
    ))
  }

  function clearCart() {
    setItems([])
  }

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
