'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Send, ImagePlus, X, ShoppingBag, Loader2, ShoppingCart } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { CartPanel } from './CartPanel'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const WELCOME_SUGGESTIONS = [
  'Recommend me running shoes for a marathon',
  'What wireless headphones do you have?',
  'Show me home appliances under $100',
  'I need sports equipment for a home gym',
]

export function ChatInterface() {
  const [input, setInput] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const { cartCount, savedCount } = useStore()
  const [pendingImage, setPendingImage] = useState<{
    dataUrl: string
    mimeType: string
    fileName: string
    file: File
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setPendingImage({
          dataUrl: reader.result as string,
          mimeType: file.type,
          fileName: file.name,
          file,
        })
      }
      reader.readAsDataURL(file)
      // Reset so the same file can be re-selected
      e.target.value = ''
    },
    [],
  )

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      const trimmed = input.trim()
      if (!trimmed && !pendingImage) return
      if (isLoading) return

      if (pendingImage) {
        // Use DataTransfer to build a proper FileList for the AI SDK
        const dt = new DataTransfer()
        dt.items.add(pendingImage.file)
        sendMessage({
          text: trimmed || 'Find products similar to this image.',
          files: dt.files,
        })
        setPendingImage(null)
      } else {
        sendMessage({ text: trimmed })
      }

      setInput('')
    },
    [input, pendingImage, isLoading, sendMessage],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const handleSuggestion = useCallback(
    (text: string) => {
      sendMessage({ text })
    },
    [sendMessage],
  )

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      <CartPanel open={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-center w-9 h-9 bg-indigo-600 rounded-xl">
          <ShoppingBag className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900">ShopBot</h1>
          <p className="text-xs text-gray-400">AI Commerce Assistant</p>
        </div>
        <div
          className={cn(
            'ml-auto flex items-center gap-1.5 text-xs px-2 py-1 rounded-full',
            isLoading
              ? 'bg-amber-50 text-amber-600'
              : 'bg-green-50 text-green-600',
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              isLoading ? 'bg-amber-400 animate-pulse' : 'bg-green-400',
            )}
          />
          {isLoading ? 'Thinking...' : 'Online'}
        </div>

        {/* Cart / saved button */}
        <button
          onClick={() => setCartOpen(true)}
          className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="Open cart"
        >
          <ShoppingCart className="w-5 h-5" />
          {(cartCount + savedCount) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-indigo-600 text-white text-[10px] font-bold rounded-full px-1">
              {cartCount + savedCount}
            </span>
          )}
        </button>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto chat-scroll bg-gray-50">
        {!hasMessages ? (
          /* Welcome screen */
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4 py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Welcome to ShopSmart
              </h2>
              <p className="text-sm text-gray-500 max-w-sm">
                Ask me anything — search by text, upload a product photo, or
                just say hello.
              </p>
            </div>

            {/* Suggestion chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {WELCOME_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestion(suggestion)}
                  className="text-left text-sm px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-gray-700 shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex gap-3 px-4 py-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-700">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
                <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 rounded-2xl rounded-tl-sm shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Image preview strip */}
      {pendingImage && (
        <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 border-t border-indigo-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pendingImage.dataUrl}
            alt="Preview"
            className="w-12 h-12 object-cover rounded-lg border border-indigo-200"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-indigo-700 truncate">
              {pendingImage.fileName}
            </p>
            <p className="text-xs text-indigo-400">
              Image ready for visual product search
            </p>
          </div>
          <button
            onClick={() => setPendingImage(null)}
            className="p-1 rounded-full hover:bg-indigo-100 text-indigo-500"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50 transition-all"
        >
          {/* Image upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex-shrink-0 mb-0.5 p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Upload image for visual search"
            title="Upload image for visual product search"
          >
            <ImagePlus className="w-5 h-5" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={
              pendingImage
                ? 'Add a description or press Send to search by image...'
                : 'Ask about products, or upload an image...'
            }
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none leading-relaxed py-1 max-h-40 disabled:opacity-60"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && !pendingImage)}
            className="flex-shrink-0 mb-0.5 p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <p className="text-center text-xs text-gray-300 mt-2">
          ShopBot may make mistakes. Prices and availability are illustrative.
        </p>
      </div>
    </div>
  )
}
