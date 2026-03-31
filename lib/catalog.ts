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

/**
 * Score a product against a set of query tokens.
 * Higher weight is given to matches in the name and tags.
 */
function scoreProduct(product: Product, tokens: string[]): number {
  const nameTokens = tokenise(product.name)
  const tagTokens = product.tags.flatMap((t) => tokenise(t))
  const descTokens = tokenise(product.description)
  const categoryTokens = tokenise(`${product.category} ${product.subcategory}`)

  let score = 0
  for (const token of tokens) {
    if (nameTokens.some((n) => n.includes(token) || token.includes(n))) {
      score += 4
    }
    if (tagTokens.some((t) => t.includes(token) || token.includes(t))) {
      score += 3
    }
    if (categoryTokens.some((c) => c.includes(token) || token.includes(c))) {
      score += 2
    }
    if (descTokens.some((d) => d.includes(token) || token.includes(d))) {
      score += 1
    }
  }
  return score
}

/**
 * Search the product catalog by a free-text query.
 * Returns up to `limit` results, sorted by relevance.
 */
export function searchByText(query: string, limit = 5): Product[] {
  const tokens = tokenise(query)
  if (tokens.length === 0) return catalog.slice(0, limit)

  // Require a minimum score of 4 (at least one strong name/tag match)
  const minScore = tokens.length === 1 ? 2 : 4
  const scored = catalog
    .map((product) => ({ product, score: scoreProduct(product, tokens) }))
    .filter(({ score }) => score >= minScore)
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
