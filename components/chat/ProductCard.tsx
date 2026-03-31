'use client'

import Image from 'next/image'
import { ShoppingCart, Star, Package } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProductCardProps {
  id: string
  name: string
  category: string
  subcategory: string
  price: number
  description: string
  tags: string[]
  imageUrl: string
  inStock: boolean
  rating: number
}

export function ProductCard({
  name,
  category,
  price,
  description,
  imageUrl,
  inStock,
  rating,
}: ProductCardProps) {
  return (
    <div className="flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 w-52 flex-shrink-0">
      {/* Product image */}
      <div className="relative w-full h-40 bg-gray-100">
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes="208px"
          className="object-cover"
          unoptimized
        />
        {!inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-xs font-semibold bg-black/60 px-2 py-1 rounded">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        {/* Category badge */}
        <span className="text-[10px] font-medium uppercase tracking-wide text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded w-fit">
          {category}
        </span>

        {/* Name */}
        <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
          {name}
        </h3>

        {/* Description */}
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
          {description}
        </p>

        {/* Rating */}
        <div className="flex items-center gap-1">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="text-xs font-medium text-gray-700">{rating.toFixed(1)}</span>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          <span className="text-sm font-bold text-gray-900">
            ${price.toFixed(2)}
          </span>
          <button
            className={cn(
              'flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors',
              inStock
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed',
            )}
            disabled={!inStock}
          >
            {inStock ? (
              <>
                <ShoppingCart className="w-3 h-3" />
                Add
              </>
            ) : (
              <>
                <Package className="w-3 h-3" />
                Notify
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
