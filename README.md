# ShopBot — AI Commerce Agent

An Amazon Rufus-inspired AI shopping assistant that handles general conversation, text-based product recommendations, and image-based product search — all through a single unified agent. Users can save products to a wishlist or add them to a persistent cart directly from chat results.

---

## Features

| Capability | Example |
|-----------|---------|
| **General conversation** | "What's your name?", "What can you do?" |
| **Text product search** | "Recommend running shoes for a marathon" |
| **Image product search** | Upload a photo → finds similar items in the catalog |
| **Add to cart** | Click "Add" on any product card → persisted across sessions |
| **Save to wishlist** | Click the heart icon on any product card → "Saved" tab in profile |
| **Cart & wishlist panel** | Slide-out drawer with quantity controls, totals, and saved items |

All search use cases are handled by a **single agent** with tool calling — no separate models or endpoints per use case.

---

## Tech Stack & Decisions

### Framework — Next.js 16 (App Router)

Next.js 16 with the App Router provides a clean separation between the streaming AI backend (Route Handlers, Server Components) and the interactive React frontend (Client Components). Key reasons:

- **Route Handlers** give a simple, Node.js-native endpoint for streaming AI responses via Server-Sent Events, with no extra server infrastructure.
- **Server Components by default** — catalog data and layout render on the server; only the interactive chat UI ships client-side JavaScript.
- **Turbopack** (the default bundler in Next.js 16) provides near-instant HMR during development without configuration.
- **Zero-config Vercel deployment** — streaming, image optimization, and environment variables all work out of the box.

### AI Model — GPT-4o (OpenAI via Vercel AI SDK)

GPT-4o handles all three agent use cases in a single model call:

- **Text understanding** — interprets natural-language shopping queries and maps them to the right catalog search tool.
- **Structured tool calling** — reliably invokes `searchProductsByText`, `searchProductsByImage`, and `getProductDetails` with well-formed JSON arguments.
- **Vision / multimodal input** — when a user uploads an image, GPT-4o analyses it and generates a detailed natural-language description (colour, style, material, category) passed to the same keyword-scoring search used for text queries.

### AI SDK — Vercel AI SDK v6

- **`streamText` + `toUIMessageStreamResponse()`** handles SSE plumbing, delta chunking, and tool-call streaming.
- **`useChat` with `DefaultChatTransport`** on the client manages message state, loading status, and file attachments.
- **`convertToModelMessages()`** transforms `UIMessage` format (including file parts for image uploads) into the format the model expects.
- **`inputSchema` / `output`** tool definitions are aligned with the MCP specification.
- **`stopWhen: stepCountIs(5)`** prevents runaway multi-step loops while still allowing the agent to chain a search call with a detail lookup in a single turn.

### Agent Pattern — Tool Calling with `streamText`

```
POST /api/chat
 └─ streamText(gpt-4o, systemPrompt, tools)
      ├─ searchProductsByText(query)        → keyword scoring against catalog
      ├─ searchProductsByImage(description) → same scoring, description from vision
      └─ getProductDetails(productId)       → exact lookup by ID
```

A single endpoint + single model + N tools was chosen over a multi-agent router because:

1. **Simpler reasoning** — the model decides which tool to call based on user intent; no separate classifier needed.
2. **Fewer round-trips** — the model can chain `searchProductsByText` → `getProductDetails` in one streamed response.
3. **Easier to extend** — adding a capability means adding one tool definition.

### Search Algorithm — Keyword Scoring with Relevance Filtering

Products are scored against tokenised query terms across weighted fields:

| Field | Weight | Rationale |
| --- | --- | --- |
| `name` | 4× | Strongest signal for product type |
| `tags` | 3× | Curated synonyms and attributes |
| `category` | 2× | Broad intent matching |
| `description` | 1× | Long-tail coverage |

**Stop-word filtering** removes filler words (`recommend`, `show`, `for`, `me`, `a`, etc.) before scoring so they don't inflate irrelevant results.

**Relevance gating** uses two rules to prevent unrelated products from appearing:

1. At least **one strong match** (name or tag level) is required — a product only mentioned in passing in a description is excluded.
2. At least **50% of the meaningful query tokens** must match something — so "running shoes marathon" needs 2 of 3 tokens to match, filtering out products that only share one word like "running".

Context words (e.g., "marathon") that don't exist in the catalog still boost the score of products that do match them, without blocking results when they're absent.

### Cart & Wishlist — React Context + localStorage

State is managed with a `StoreProvider` context (`lib/store.tsx`) and persisted to `localStorage` so cart and saved items survive page refreshes. The store exposes:

- `addToCart` / `removeFromCart` / `updateQuantity`
- `toggleSaved` / `isSaved`
- `cartCount` / `savedCount` for the header badge

The slide-out `CartPanel` has two tabs — **Cart** (with quantity controls, per-item total, and checkout button) and **Saved** (with "Add to Cart" and remove actions).

### UI — Tailwind CSS + shadcn/ui primitives + react-markdown

- **Tailwind CSS** — utility-first styling with no runtime overhead; neutral gray base with a single indigo accent.
- **shadcn/ui** — `cn()` + class-variance-authority for consistent borders, radii, and interactive states.
- **react-markdown + @tailwindcss/typography** — renders AI Markdown responses (bold, lists, headings) as formatted HTML.
- **lucide-react** — consistent iconography (ShoppingBag, ShoppingCart, Heart, Send, ImagePlus, Star, Trash2, etc.).

### Deployment — Vercel

- **Streaming support** — SSE responses from Route Handlers are proxied correctly without buffering.
- **Environment variables** — `OPENAI_API_KEY` is stored securely and never exposed to the client bundle.
- **Zero-config** — no `vercel.json` required; the framework adapter handles routing and function bundling automatically.

---

## Architecture

```
User
 │
 ▼
ChatInterface (React, client)
 │  useChat → DefaultChatTransport
 │  StoreProvider (cart + wishlist state)
 ▼
POST /api/chat  (Next.js Route Handler, Node.js runtime)
 │
 ├─ streamText(gpt-4o, system prompt, tools)
 │
 ├─ Tool: searchProductsByText(query)
 │    └─ catalog.ts → stop-word filter → keyword scoring → relevance gating → top 5
 │
 ├─ Tool: searchProductsByImage(imageDescription)
 │    └─ GPT-4o vision describes the image → same keyword search
 │
 └─ Tool: getProductDetails(productId)
      └─ exact lookup by ID
 │
 ▼
toUIMessageStreamResponse()  →  streamed back to client
 │
 ▼
MessageBubble renders:
  • text parts  → Markdown via react-markdown
  • tool parts  → ProductCard grid (horizontal scroll)
               → each card: Add to Cart button + Heart/Save toggle
  • file parts  → image upload confirmation badge
 │
 ▼
CartPanel (slide-out drawer)
  • Cart tab  → quantity controls, remove, total, checkout
  • Saved tab → add to cart from saved, remove
```

### How image search works

1. User selects an image via the upload button.
2. The browser reads it with `FileReader`; the AI SDK sends it as a `file` part in the `UIMessage`.
3. `convertToModelMessages()` transforms the file part into GPT-4o's native vision format (base64 image block).
4. GPT-4o analyses the image and calls `searchProductsByImage` with a detailed description (colour, style, material, category, intended use).
5. `searchByImage` runs the same keyword-scoring + relevance-gating algorithm as text search.
6. Matching products are returned as structured JSON and rendered as `ProductCard` components.

---

## Project Structure

```text
ai-commerce-agent/
├── app/
│   ├── api/chat/route.ts       # Streaming agent endpoint (streamText + tools)
│   ├── layout.tsx              # Root layout — wraps with StoreProvider
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── chat/
│       ├── CartPanel.tsx       # Slide-out drawer (Cart + Saved tabs)
│       ├── ChatInterface.tsx   # Chat UI — useChat, header badge, image upload
│       ├── MessageBubble.tsx   # Renders text (Markdown) + tool results + file parts
│       └── ProductCard.tsx     # Product card — Add to Cart + Heart/Save buttons
├── data/
│   └── catalog.json            # 20-product catalog (electronics, clothing, sports, home)
├── lib/
│   ├── catalog.ts              # Keyword-scoring search with stop-word filter + relevance gating
│   ├── store.tsx               # Cart & wishlist context with localStorage persistence
│   └── utils.ts                # cn() Tailwind helper
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── README.md
```

---

## Setup

### Prerequisites

- Node.js 18+
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Install & run

```bash
git clone <your-repo-url>
cd ai-commerce-agent

npm install

cp .env.example .env.local
# Edit .env.local and set OPENAI_API_KEY=sk-...

npm run dev
# Open http://localhost:3000
```

---

## API Reference

### `POST /api/chat`

Streams an AI response for a chat turn using the AI SDK UIMessage stream protocol.

#### Request body

```json
{
  "messages": [UIMessage]
}
```

#### Response

A streaming `text/event-stream` response consumed automatically by the `useChat` hook on the client.

#### Tools invoked by the model

| Tool | Input | Output |
| --- | --- | --- |
| `searchProductsByText` | `{ query: string }` | `{ found, count, query, products[] }` |
| `searchProductsByImage` | `{ imageDescription: string }` | `{ found, count, imageDescription, products[] }` |
| `getProductDetails` | `{ productId: string }` | `{ found, product }` |

#### Example

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "id": "1",
      "role": "user",
      "parts": [{ "type": "text", "text": "Recommend running shoes" }]
    }]
  }'
```

---

## Product Catalog

20 products across four categories:

| Category | Products |
| --- | --- |
| Electronics | Headphones, AirPods, 65" QLED TV, Wireless Mouse, iPad Air |
| Clothing | Running T-Shirt, Slim Jeans, Fleece Jacket, Polo Shirt, Running Shoes |
| Sports | Basketball, GPS Watch, Adjustable Dumbbells, Yoga Mat, Suspension Trainer |
| Home | Cordless Vacuum, Pressure Cooker, Smart Bulb Kit, Coffee Machine, Foam Mattress |

Each product has: `id`, `name`, `category`, `subcategory`, `price`, `description`, `tags[]`, `imageUrl`, `inStock`, `rating`.

---

## Deployment

### Vercel (recommended)

```bash
npm i -g vercel
vercel

# Add your API key in the Vercel dashboard:
# Project → Settings → Environment Variables → OPENAI_API_KEY
```

### Docker / self-hosted

```bash
docker build -t ai-commerce-agent .
docker run -p 3000:3000 -e OPENAI_API_KEY=sk-... ai-commerce-agent
```

---

## Potential Improvements

- **Vector search** — replace keyword scoring with OpenAI embeddings + pgvector for semantic similarity and better recall on paraphrase queries.
- **Real catalog** — connect to a Postgres database (e.g., Neon) or a Shopify Storefront API instead of the static JSON file.
- **Auth & personalisation** — add user accounts with Clerk so the cart and wishlist persist server-side and ShopBot can personalise recommendations based on purchase history.
- **Checkout flow** — integrate Stripe for a real payment flow from the cart panel.
- **Streaming product cards** — render partial product cards as the tool result streams in, rather than waiting for the full tool output.
- **Inventory & pricing sync** — connect `getProductDetails` to a live inventory API so stock status and prices are always current.
