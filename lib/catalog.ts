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
 * - Must match at least ceil(tokens * 0.5) tokens overall.
 *   e.g. "running shoes marathon" (3 tokens) → need 2/3 to match anything,
 *   so shoes that match "running" + "shoes" pass even if "marathon" is absent.
 */
export function searchByText(query: string, limit = 5): Product[] {
  const tokens = tokenise(query)
  if (tokens.length === 0) return catalog.slice(0, limit)

  const requiredMatches = Math.ceil(tokens.length * 0.5)

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
 * The imageDescription should be a natural-language description of the visual
 * attributes seen in the uploaded image (colours, style, material, category, etc.).
 */
export function searchByImage(imageDescription: string, limit = 5): Product[] {
  // Re-use the text search on the extracted description
  return searchByText(imageDescription, limit)
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
