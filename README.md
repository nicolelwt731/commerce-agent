# ShopBot — AI Commerce Agent

An Amazon Rufus-inspired shopping assistant that handles general conversation, text-based product recommendations, and image-based product search — all through a single unified agent.

## Features

| Capability | Example |
| --- | --- |
| General conversation | "What can you do?" |
| Text product search | "Recommend running shoes for a marathon" |
| Image product search | Upload a photo → finds similar items |
| Personalised recommendations | Sign in → bot tailors results to your saved/cart history |
| Cart & wishlist | Add, save, adjust quantities — persisted across sessions |

## Tech Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) | Route Handlers for streaming SSE, zero-config Vercel deploy |
| AI Model | GPT-4o via Vercel AI SDK v6 | Multimodal (text + vision), reliable tool calling |
| Search | `text-embedding-3-small` + cosine similarity | Semantic search; falls back to keyword scoring |
| Auth | Clerk | Fastest integration with Next.js; user context injected into system prompt |
| State | React Context + localStorage | Simple catalog size; no backend DB needed |
| UI | Tailwind CSS + react-markdown + lucide-react | — |

## Architecture

```
User input / image upload
  └─ ChatInterface (useChat + DefaultChatTransport)
       └─ POST /api/chat
            ├─ Sanitize messages (strip stale blob URLs)
            ├─ Inject userContext into system prompt (name + inferred interests)
            ├─ streamText(gpt-4o, tools)
            │    ├─ searchProductsByText  → searchByVector → cosine similarity
            │    ├─ searchProductsByImage → GPT-4o describes image → searchByVector
            │    └─ getProductDetails     → exact ID lookup
            └─ toUIMessageStreamResponse()
                 └─ MessageBubble renders text (Markdown) + ProductCard grid
```

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

Required env vars (see `.env.example`):

- `OPENAI_API_KEY` — [platform.openai.com](https://platform.openai.com/api-keys)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` — [dashboard.clerk.com](https://dashboard.clerk.com)

## Agent API

### `POST /api/chat`

Streams an AI response using the Vercel AI SDK UIMessage protocol.

Request body:

```json
{
  "messages": [UIMessage],
  "userContext": { "name": "string", "preferences": ["string"] }
}
```

Tools invoked by the model:

| Tool | Input | Description |
| --- | --- | --- |
| `searchProductsByText` | `{ query }` | Semantic search by text |
| `searchProductsByImage` | `{ imageDescription }` | Semantic search from GPT-4o image description |
| `getProductDetails` | `{ productId }` | Exact lookup by ID |

## Catalog

20 products across 4 categories: Electronics, Clothing, Sports, Home.
IDs follow the pattern `{category-prefix}-{number}` e.g. `elec-001`, `cloth-002`.

## Potential Improvements

- **Real catalog** — connect to Postgres (Neon) or Shopify Storefront API
- **Server-side cart persistence** — store cart in Clerk user metadata or a DB
- **Checkout** — Stripe integration
- **Streaming product cards** — render partial cards as tool result streams ✓ *(implemented)*
- **Vector search** — semantic similarity via embeddings ✓ *(implemented)*
- **Auth & personalisation** — Clerk + system prompt injection ✓ *(implemented)*
