import { embed, embedMany } from 'ai'
import { openai } from '@ai-sdk/openai'
import catalogData from '@/data/catalog.json'

export interface Product {
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

const catalog: Product[] = catalogData as Product[]

// ─── Vector Search ─────────────────────────────────────────────────────────

let _catalogEmbeddings: number[][] | null = null

/** Lazily compute and cache embeddings for all products (one API call). */
async function getCatalogEmbeddings(): Promise<number[][]> {
  if (_catalogEmbeddings) return _catalogEmbeddings
  const texts = catalog.map(
    (p) =>
      `${p.name} ${p.category} ${p.subcategory} ${p.tags.join(' ')} ${p.description}`,
  )
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: texts,
  })
  _catalogEmbeddings = embeddings
  return embeddings
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Semantic search using text-embedding-3-small cosine similarity.
 * Falls back to keyword search if the embedding call fails.
 */
export async function searchByVector(query: string, limit = 5): Promise<Product[]> {
  try {
    const [{ embedding: queryEmbedding }, productEmbeddings] = await Promise.all([
      embed({ model: openai.embedding('text-embedding-3-small'), value: query }),
      getCatalogEmbeddings(),
    ])
    return catalog
      .map((product, i) => ({
        product,
        score: cosineSimilarity(queryEmbedding, productEmbeddings[i]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ product }) => product)
  } catch (err) {
    console.error('[searchByVector] embedding failed, falling back to keyword search:', err)
    return searchByText(query, limit)
  }
}

// ─── Keyword Search (kept as fallback) ────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'is',
  'are', 'was', 'be', 'been', 'have', 'has', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'i', 'me', 'my', 'you',
  'your', 'we', 'our', 'it', 'its', 'this', 'that', 'some', 'give', 'get',
  'show', 'find', 'recommend', 'suggest', 'want', 'need', 'looking',
])

/**
 * Tokenise a query string into lowercase words for keyword matching.
 * Common stop words and short filler words are removed.
 */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
}

interface ScoreResult {
  score: number
  matchedTokens: number
  strongMatchTokens: number
}

/**
 * Score a product against a set of query tokens.
 * Returns total score, how many tokens matched anything, and how many had a
 * strong match (name or tag level, worth ≥ 4 points per token).
 */
function scoreProduct(product: Product, tokens: string[]): ScoreResult {
  const nameTokens = tokenise(product.name)
  const tagTokens = product.tags.flatMap((t) => tokenise(t))
  const descTokens = tokenise(product.description)
  const categoryTokens = tokenise(`${product.category} ${product.subcategory}`)

  let score = 0
  let matchedTokens = 0
  let strongMatchTokens = 0

  for (const token of tokens) {
    let tokenScore = 0
    let strong = false
    if (nameTokens.some((n) => n.includes(token) || token.includes(n))) {
      tokenScore += 4
      strong = true
    }
    if (tagTokens.some((t) => t.includes(token) || token.includes(t))) {
      tokenScore += 3
      strong = true
    }
    if (categoryTokens.some((c) => c.includes(token) || token.includes(c))) {
      tokenScore += 2
    }
    if (descTokens.some((d) => d.includes(token) || token.includes(d))) {
      tokenScore += 1
    }
    if (tokenScore > 0) matchedTokens++
    if (strong) strongMatchTokens++
    score += tokenScore
  }

  return { score, matchedTokens, strongMatchTokens }
}

/**
 * Search the product catalog by a free-text query.
 * Returns up to `limit` results, sorted by relevance.
 *
 * Filtering rules:
 * - Must have at least 1 strong match (name or tag level).
 * - Must match at least ceil(tokens * minMatchRatio) tokens overall.
 *   Default ratio 0.5: "running shoes marathon" needs 2/3 tokens to match,
 *   so shoes matching "running" + "shoes" pass even if "marathon" is absent.
 */
export function searchByText(query: string, limit = 5, minMatchRatio = 0.5): Product[] {
  const tokens = tokenise(query)
  if (tokens.length === 0) return catalog.slice(0, limit)

  const requiredMatches = Math.ceil(tokens.length * minMatchRatio)

  const scored = catalog
    .map((product) => ({ product, ...scoreProduct(product, tokens) }))
    .filter(({ strongMatchTokens, matchedTokens }) =>
      strongMatchTokens >= 1 && matchedTokens >= requiredMatches,
    )
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map(({ product }) => product)
}

/**
 * Search the product catalog using attributes extracted from an image description.
 * Uses a lower minMatchRatio (0.2) because GPT-4o produces verbose descriptions
 * with many tokens that don't exist in the catalog (colours, brand names, materials,
 * etc.), so requiring 50% would incorrectly filter out strong category matches.
 * A product still needs at least 1 strong name/tag match to appear.
 */
export function searchByImage(imageDescription: string, limit = 5): Product[] {
  return searchByText(imageDescription, limit, 0.2)
}

/**
 * Retrieve a single product by ID.
 */
export function getProductById(id: string): Product | undefined {
  return catalog.find((p) => p.id === id)
}

/**
 * Return the full catalog.
 */
export function getAllProducts(): Product[] {
  return catalog
}
