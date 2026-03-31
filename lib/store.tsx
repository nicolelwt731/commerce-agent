'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ProductCardProps } from '@/components/chat/ProductCard'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem extends ProductCardProps {
  quantity: number
}

interface StoreState {
  cart: CartItem[]
  saved: ProductCardProps[]
  addToCart: (product: ProductCardProps) => void
  removeFromCart: (id: string) => void
  updateQuantity: (id: string, delta: number) => void
  toggleSaved: (product: ProductCardProps) => void
  isSaved: (id: string) => boolean
  cartCount: number
  savedCount: number
}

// ─── Context ──────────────────────────────────────────────────────────────────

const StoreContext = createContext<StoreState | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [saved, setSaved] = useState<ProductCardProps[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Load from localStorage once on mount
  useEffect(() => {
    try {
      const storedCart = localStorage.getItem('shopbot_cart')
      const storedSaved = localStorage.getItem('shopbot_saved')
      if (storedCart) setCart(JSON.parse(storedCart))
      if (storedSaved) setSaved(JSON.parse(storedSaved))
    } catch {
      // ignore parse errors
    }
    setHydrated(true)
  }, [])

  // Persist cart
  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem('shopbot_cart', JSON.stringify(cart))
  }, [cart, hydrated])

  // Persist saved
  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem('shopbot_saved', JSON.stringify(saved))
  }, [saved, hydrated])

  const addToCart = useCallback((product: ProductCardProps) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }, [])

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    )
  }, [])

  const toggleSaved = useCallback((product: ProductCardProps) => {
    setSaved((prev) => {
      const exists = prev.some((p) => p.id === product.id)
      return exists ? prev.filter((p) => p.id !== product.id) : [...prev, product]
    })
  }, [])

  const isSaved = useCallback(
    (id: string) => saved.some((p) => p.id === id),
    [saved],
  )

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)
  const savedCount = saved.length

  return (
    <StoreContext.Provider
      value={{
        cart,
        saved,
        addToCart,
        removeFromCart,
        updateQuantity,
        toggleSaved,
        isSaved,
        cartCount,
        savedCount,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
