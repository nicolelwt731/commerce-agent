'use client'

import { UIMessage } from 'ai'
import { Bot, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { ProductCard, ProductCardProps } from './ProductCard'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: UIMessage
}

/**
 * Parses tool output from the AI SDK v6 tool part output field.
 * The execute() functions in route.ts return { found, products, ... }.
 */
function parseProductsFromOutput(output: unknown): ProductCardProps[] | null {
  if (!output || typeof output !== 'object') return null
  const r = output as Record<string, unknown>
  if (!r.found || !Array.isArray(r.products) || r.products.length === 0) {
    return null
  }
  return r.products as ProductCardProps[]
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white',
          isUser ? 'bg-indigo-600' : 'bg-gray-700',
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          'flex flex-col gap-2 max-w-[75%]',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        {message.parts.map((part, index) => {
          // --- Text parts ---
          if (part.type === 'text' && part.text.trim()) {
            return (
              <div
                key={index}
                className={cn(
                  'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                  isUser
                    ? 'bg-indigo-600 text-white rounded-tr-sm whitespace-pre-wrap'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm prose prose-sm max-w-none prose-p:my-1 prose-li:my-0 prose-headings:my-2 prose-strong:font-semibold',
                )}
              >
                {isUser ? part.text : <ReactMarkdown>{part.text}</ReactMarkdown>}
              </div>
            )
          }

          // --- File parts (image uploads shown on user side) ---
          if (part.type === 'file' && isUser) {
            const filePart = part as { type: 'file'; mediaType?: string; url?: string }
            const isImage = filePart.mediaType?.startsWith('image/')
            if (isImage && filePart.url) {
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={index}
                  src={filePart.url}
                  alt="Uploaded for visual search"
                  className="max-w-[200px] max-h-[200px] rounded-xl border border-indigo-200 object-cover"
                />
              )
            }
            return (
              <div
                key={index}
                className="px-3 py-2 bg-indigo-100 border border-indigo-200 rounded-xl text-xs text-indigo-700 flex items-center gap-2"
              >
                <span className="text-base">📎</span>
                <span>File attached</span>
              </div>
            )
          }

          // --- Tool parts (AI SDK v6: type is "tool-{toolName}" or "dynamic-tool") ---
          // We handle all tool parts generically using startsWith check
          const isToolPart =
            part.type.startsWith('tool-') || part.type === 'dynamic-tool'

          if (isToolPart) {
            // Cast to a generic tool part shape
            const toolPart = part as {
              type: string
              state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
              toolName?: string
              input?: unknown
              output?: unknown
              errorText?: string
            }

            const toolName =
              toolPart.toolName ??
              (part.type !== 'dynamic-tool'
                ? part.type.replace(/^tool-/, '')
                : 'tool')

            // While input is being streamed or the call is about to execute
            if (
              toolPart.state === 'input-streaming' ||
              toolPart.state === 'input-available'
            ) {
              return (
                <div
                  key={index}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 flex items-center gap-2"
                >
                  <span className="animate-spin inline-block w-3 h-3 border border-gray-400 border-t-transparent rounded-full" />
                  {toolName === 'searchProductsByText' && 'Searching catalog...'}
                  {toolName === 'searchProductsByImage' && 'Analysing image & searching catalog...'}
                  {toolName === 'getProductDetails' && 'Fetching product details...'}
                  {!['searchProductsByText', 'searchProductsByImage', 'getProductDetails'].includes(toolName) &&
                    `Running ${toolName}...`}
                </div>
              )
            }

            // Output available — try to render product cards
            if (toolPart.state === 'output-available') {
              const products = parseProductsFromOutput(toolPart.output)
              if (!products) return null
              return (
                <div key={index} className="flex flex-col gap-2 w-full">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                    {products.length} product{products.length !== 1 ? 's' : ''} found
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-2 chat-scroll">
                    {products.map((product) => (
                      <ProductCard key={product.id} {...product} />
                    ))}
                  </div>
                </div>
              )
            }

            // Error state
            if (toolPart.state === 'output-error') {
              return (
                <div
                  key={index}
                  className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600"
                >
                  Search failed: {toolPart.errorText ?? 'Unknown error'}
                </div>
              )
            }
          }

          return null
        })}
      </div>
    </div>
  )
}
