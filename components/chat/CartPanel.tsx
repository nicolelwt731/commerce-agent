'use client'

import Image from 'next/image'
import { X, ShoppingCart, Heart, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface CartPanelProps {
  open: boolean
  onClose: () => void
}

export function CartPanel({ open, onClose }: CartPanelProps) {
  const [tab, setTab] = useState<'cart' | 'saved'>('cart')
  const { cart, saved, removeFromCart, updateQuantity, toggleSaved, addToCart } = useStore()

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">My Profile</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('cart')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors',
              tab === 'cart'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <ShoppingCart className="w-4 h-4" />
            Cart
            {cart.length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('saved')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors',
              tab === 'saved'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Heart className="w-4 h-4" />
            Saved
            {saved.length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
                {saved.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'cart' ? (
            cart.length === 0 ? (
              <EmptyState icon={<ShoppingBag className="w-8 h-8 text-gray-300" />} text="Your cart is empty" />
            ) : (
              <ul className="divide-y divide-gray-100">
                {cart.map((item) => (
                  <li key={item.id} className="flex gap-3 p-3">
                    <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                      <Image src={item.imageUrl} alt={item.name} fill sizes="56px" className="object-cover" unoptimized />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-snug">{item.name}</p>
                      <p className="text-xs text-indigo-600 font-semibold mt-0.5">${item.price.toFixed(2)}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-600"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-medium w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-5 h-5 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-600"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="ml-auto p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : (
            saved.length === 0 ? (
              <EmptyState icon={<Heart className="w-8 h-8 text-gray-300" />} text="No saved items yet" />
            ) : (
              <ul className="divide-y divide-gray-100">
                {saved.map((item) => (
                  <li key={item.id} className="flex gap-3 p-3">
                    <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                      <Image src={item.imageUrl} alt={item.name} fill sizes="56px" className="object-cover" unoptimized />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-snug">{item.name}</p>
                      <p className="text-xs text-indigo-600 font-semibold mt-0.5">${item.price.toFixed(2)}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          onClick={() => { addToCart(item); toggleSaved(item) }}
                          disabled={!item.inStock}
                          className={cn(
                            'text-xs px-2 py-1 rounded-lg font-medium transition-colors',
                            item.inStock
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                          )}
                        >
                          {item.inStock ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                        <button
                          onClick={() => toggleSaved(item)}
                          className="ml-auto p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>

        {/* Cart footer */}
        {tab === 'cart' && cart.length > 0 && (
          <div className="border-t border-gray-200 p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total</span>
              <span className="font-bold text-gray-900">${cartTotal.toFixed(2)}</span>
            </div>
            <button className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
              Checkout
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center px-4">
      {icon}
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  )
}
