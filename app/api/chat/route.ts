import { openai } from '@ai-sdk/openai'
import { streamText, tool, stepCountIs, UIMessage, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { searchByText, searchByImage, getProductById } from '@/lib/catalog'

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

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: openai('gpt-4o'),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
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
          const products = searchByText(query)
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
          const products = searchByImage(imageDescription)
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
