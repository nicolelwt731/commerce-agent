import { openai } from '@ai-sdk/openai'
import { streamText, tool, stepCountIs, UIMessage, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { searchByVector, getProductById } from '@/lib/catalog'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are ShopBot, a friendly and knowledgeable AI shopping assistant for ShopSmart — a premium online commerce store.

Your capabilities:
1. **General conversation**: Answer questions about yourself, what you can do, greet users, and have natural conversations.
2. **Text-based product recommendations**: When users describe what they are looking for, use the searchProductsByText tool to find relevant products from the catalog and present them with helpful context.
3. **Image-based product search**: When a user uploads a photo of a product or an item they like, analyse the image carefully — identify the category, style, colour, material, brand style, and key attributes — then use the searchProductsByImage tool with a detailed description of what you see. Present the matching products.

Guidelines:
- Always be warm, helpful, and conversational.
- When recommending products, explain WHY each product fits the user's needs.
- Mention key details: price, rating, whether it's in stock.
- For image searches, describe what you see in the image before showing results.
- If no products match, suggest alternative search terms.
- You can call multiple tools in sequence if needed (e.g., search then get details).
- Never make up products that aren't in the catalog.
- Format product listings clearly so the UI can render them as cards.

Store information:
- ShopSmart carries electronics, clothing, sports equipment, and home goods.
- All prices are in USD.
- Products marked "inStock: false" are currently unavailable.`

interface UserContext {
  name: string
  preferences: string[]
}

function buildSystemPrompt(userContext?: UserContext): string {
  if (!userContext) return SYSTEM_PROMPT

  const lines = [
    SYSTEM_PROMPT,
    '',
    '## Personalisation',
    `The signed-in user's name is ${userContext.name}. Address them by name naturally in your responses — at least once per reply, but not in every sentence.`,
  ]

  if (userContext.preferences.length > 0) {
    lines.push(
      `They have shown interest in: ${userContext.preferences.join(', ')} (inferred from their cart and saved items).`,
      'Proactively connect these interests to your recommendations. For example, if they ask about electronics and they follow running, highlight sport-relevant electronics.',
      `When starting the conversation, greet them as ${userContext.name} and acknowledge what you know about their taste in one sentence.`,
    )
  } else {
    lines.push(`Greet them as ${userContext.name} when starting the conversation.`)
  }

  return lines.join('\n')
}

export async function POST(req: Request) {
  let body: { messages: UIMessage[]; userContext?: UserContext }
  try {
    body = await req.json()
  } catch (err) {
    console.error('[chat] failed to parse request body:', err)
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages, userContext } = body

  // Sanitize messages before conversion:
  // - Strip file parts from every message except the most recent user message
  //   (old image context is not needed and stale blob URLs break the pipeline).
  // - In the most recent user message, keep only file parts with a valid data URL
  //   (blob:// URLs are browser-only and cannot be resolved on the server).
  const lastUserIndex = messages.reduce(
    (last, msg, i) => (msg.role === 'user' ? i : last),
    -1,
  )
  const sanitized = messages.map((msg, i) => {
    const parts = msg.parts ?? []
    if (i === lastUserIndex) {
      return {
        ...msg,
        parts: parts.filter(part => {
          if (part.type !== 'file') return true
          const fp = part as { url?: string }
          return typeof fp.url === 'string' && fp.url.startsWith('data:')
        }),
      }
    }
    return { ...msg, parts: parts.filter(part => part.type !== 'file') }
  }) as UIMessage[]

  let modelMessages
  try {
    modelMessages = await convertToModelMessages(sanitized)
  } catch (err) {
    console.error('[chat] convertToModelMessages failed:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Workaround: convertToModelMessages sets data = FileUIPart.url (a full data URL
  // string like "data:image/jpeg;base64,/9j/..."). But @ai-sdk/openai expects data
  // to be the raw base64 content — it prepends "data:${mediaType};base64," itself.
  // Without this fix the payload sent to GPT-4o is a double-prefixed data URL which
  // it cannot decode, causing the "image didn't come through" response.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fixedModelMessages = modelMessages.map((msg: any) => {
    if (msg.role !== 'user' || !Array.isArray(msg.content)) return msg
    return {
      ...msg,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: msg.content.map((part: any) => {
        if (
          part.type === 'file' &&
          typeof part.data === 'string' &&
          part.data.startsWith('data:')
        ) {
          const base64 = part.data.split(',')[1]
          return base64 ? { ...part, data: base64 } : part
        }
        return part
      }),
    }
  })

  const result = streamText({
    model: openai('gpt-4o'),
    system: buildSystemPrompt(userContext),
    messages: fixedModelMessages,
    stopWhen: stepCountIs(5),
    tools: {
      searchProductsByText: tool({
        description:
          'Search the product catalog using a text query. Use this when the user describes what they are looking for in words. Returns a list of matching products with full details.',
        inputSchema: z.object({
          query: z
            .string()
            .describe(
              'The search query describing what the user wants. Include category, style, use case, and any specific attributes mentioned.',
            ),
        }),
        execute: async ({ query }) => {
          const products = await searchByVector(query)
          if (products.length === 0) {
            return {
              found: false,
              message: `No products found for "${query}". Try a different search term.`,
              products: [],
            }
          }
          return {
            found: true,
            count: products.length,
            query,
            products,
          }
        },
      }),

      searchProductsByImage: tool({
        description:
          'Search the product catalog based on attributes extracted from an uploaded image. Use this when the user uploads a photo and wants to find similar products. Pass a detailed natural-language description of the visual attributes you observe in the image.',
        inputSchema: z.object({
          imageDescription: z
            .string()
            .describe(
              'A detailed description of the product or item visible in the image. Include: product category (clothing, electronics, etc.), subcategory, colours, style, material, brand if visible, intended use, and any other distinguishing visual attributes.',
            ),
        }),
        execute: async ({ imageDescription }) => {
          const products = await searchByVector(imageDescription)
          if (products.length === 0) {
            return {
              found: false,
              message:
                'No similar products found in our catalog based on your image. Try describing the product differently.',
              products: [],
              imageDescription,
            }
          }
          return {
            found: true,
            count: products.length,
            imageDescription,
            products,
          }
        },
      }),

      getProductDetails: tool({
        description:
          'Retrieve full details for a specific product by its ID. Use this when you need more information about a particular product, or when the user asks for more details about a specific item.',
        inputSchema: z.object({
          productId: z
            .string()
            .describe('The unique product ID (e.g. "elec-001", "cloth-002")'),
        }),
        execute: async ({ productId }) => {
          const product = getProductById(productId)
          if (!product) {
            return {
              found: false,
              message: `Product with ID "${productId}" not found.`,
            }
          }
          return {
            found: true,
            product,
          }
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
