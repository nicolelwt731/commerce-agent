# ShopBot — AI Commerce Agent

An Amazon Rufus-inspired AI shopping assistant that handles general conversation, text-based product recommendations, and image-based product search — all through a single unified agent.

---

## Features

| Capability | Example |
|-----------|---------|
| **General conversation** | "What's your name?", "What can you do?" |
| **Text product search** | "Recommend running shoes for a marathon" |
| **Image product search** | Upload a photo → finds similar items in the catalog |

All three use cases are handled by a **single agent** with tool calling — no separate models or endpoints per use case.

---

## Tech Stack & Decisions

### Framework — Next.js 16 (App Router)

Next.js 16 with the App Router provides a clean separation between the streaming AI backend (Route Handlers, Server Components) and the interactive React frontend (Client Components). Key reasons for this choice:

- **Route Handlers** give a simple, Node.js-native endpoint for streaming AI responses via Server-Sent Events, with no extra server infrastructure.
- **Server Components by default** means the catalog data and layout render on the server — only the interactive chat UI ships client-side JavaScript.
- **Turbopack** (the default bundler in Next.js 16) provides near-instant HMR during development without configuration.
- **Zero-config Vercel deployment** — Next.js is Vercel's native framework, so streaming, image optimization, and environment variables all work out of the box.

### AI Model — GPT-4o (OpenAI via Vercel AI SDK)

GPT-4o was chosen as the underlying model because it handles all three agent use cases in a single model call:

- **Text understanding** — interprets natural-language shopping queries and maps them to the right catalog search tool.
- **Structured tool calling** — reliably invokes `searchProductsByText`, `searchProductsByImage`, and `getProductDetails` with well-formed JSON arguments.
- **Vision / multimodal input** — when a user uploads an image, GPT-4o analyses it and generates a detailed natural-language description (colour, style, material, category) that is then passed to the same keyword-scoring search function used for text queries.

Using a single multimodal model eliminates the need to route image queries to a separate vision model, keeping the architecture simple and the latency low.

### AI SDK — Vercel AI SDK v6

The Vercel AI SDK was chosen over calling the OpenAI API directly for several reasons:

- **`streamText` + `toUIMessageStreamResponse()`** handles all the SSE plumbing, delta chunking, and tool-call streaming in a few lines of code.
- **`useChat` with `DefaultChatTransport`** on the client side consumes the stream and manages message state, loading status, and file attachments without any manual fetch logic.
- **`convertToModelMessages()`** transforms the AI SDK's `UIMessage` format (which supports file parts for image uploads) into the format the model expects — including base64 image blocks for vision.
- **`inputSchema` / `output`** tool definitions are aligned with the MCP specification, making the tools forward-compatible.
- **`stopWhen: stepCountIs(5)`** prevents runaway multi-step loops while still allowing the agent to chain a search call with a detail lookup in a single turn.

### Agent Pattern — Tool Calling with `streamText`

Rather than building a pipeline with separate agents per use case, the entire assistant is implemented as a single `streamText` call with three tools:

```
POST /api/chat
 └─ streamText(gpt-4o, systemPrompt, tools)
      ├─ searchProductsByText(query)       → keyword scoring against catalog
      ├─ searchProductsByImage(description) → same scoring, description from vision
      └─ getProductDetails(productId)      → exact lookup by ID
```

This "one endpoint, one model, N tools" pattern was chosen over a multi-agent router because:

1. **Simpler reasoning** — the model decides which tool to call based on the user's intent; no separate classifier is needed.
2. **Fewer round-trips** — the model can call `searchProductsByText` and then immediately call `getProductDetails` on the top result in the same streamed response.
3. **Easier to extend** — adding a new capability (e.g., price comparison, cart management) means adding one more tool definition, not a new agent endpoint.

### Product Catalog — JSON File

The catalog is stored as a flat JSON file (`data/catalog.json`) with 20 products across four categories. This was intentional for the scope of this project:

- **Zero infrastructure** — no database connection, no migrations, no ORM setup. The catalog is read synchronously at request time.
- **Easy to inspect and modify** — the entire dataset is human-readable and version-controlled.
- **Swap-friendly** — the `searchByText` and `searchByImage` functions in `lib/catalog.ts` have a clean interface; replacing the JSON source with a Postgres query or a vector database is a one-file change.

The search algorithm scores each product by keyword overlap across weighted fields:

| Field | Weight | Rationale |
| --- | --- | --- |
| `name` | 4× | Product name is the strongest signal |
| `tags` | 3× | Curated keywords cover synonyms and attributes |
| `category` | 2× | Broad intent matching |
| `description` | 1× | Long-tail coverage |

### UI — Tailwind CSS + shadcn/ui primitives + react-markdown

- **Tailwind CSS** provides utility-first styling with no runtime overhead. The design uses a neutral gray base with a single indigo accent color — appropriate for a commerce assistant interface.
- **shadcn/ui** components (via `cn()` + class-variance-authority) are used for consistent border radii, shadows, and interactive states without pulling in a full component library.
- **react-markdown + @tailwindcss/typography** renders the AI's Markdown responses (bold text, numbered lists, bullet points) as properly formatted HTML rather than showing raw `**` and `##` characters.
- **lucide-react** provides consistent iconography (ShoppingBag, Send, ImagePlus, Star, ShoppingCart).

### Deployment — Vercel

Vercel is the natural deployment target for a Next.js AI streaming application:

- **Streaming support** — SSE responses from Route Handlers are proxied correctly to the client without buffering.
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
 ▼
POST /api/chat  (Next.js Route Handler, Node.js runtime)
 │
 ├─ streamText(gpt-4o, system prompt, tools)
 │
 ├─ Tool: searchProductsByText(query)
 │    └─ catalog.ts → keyword scoring → top 5 products
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
  • text parts     → Markdown via react-markdown (bold, lists, headings)
  • tool parts     → ProductCard grid (horizontal scroll)
  • file parts     → image upload confirmation badge
```

### How image search works

1. User selects an image via the upload button.
2. The browser reads it with `FileReader` and the AI SDK sends it as a `file` part in the `UIMessage`.
3. `convertToModelMessages()` transforms the file part into GPT-4o's native vision format (base64 image block).
4. GPT-4o analyses the image and calls `searchProductsByImage` with a detailed natural-language description (colour, style, material, category, intended use).
5. `searchByImage` runs the same keyword-scoring algorithm as text search against the catalog.
6. Matching products are returned as structured JSON and rendered as `ProductCard` components.

---

## Project Structure

```text
ai-commerce-agent/
├── app/
│   ├── api/chat/route.ts      # Streaming agent endpoint (streamText + tools)
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── chat/
│       ├── ChatInterface.tsx  # Chat UI (useChat, image upload, suggestion chips)
│       ├── MessageBubble.tsx  # Renders text (Markdown) + tool results + file parts
│       └── ProductCard.tsx    # Individual product display card
├── data/
│   └── catalog.json           # 20-product catalog (electronics, clothing, sports, home)
├── lib/
│   ├── catalog.ts             # Keyword-scoring search (text + image)
│   └── utils.ts               # cn() Tailwind helper
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
- **Cart & session state** — persist cart contents across sessions with Upstash Redis and tie them to a user session.
- **Auth & personalisation** — add user accounts with Clerk so ShopBot can learn from purchase history and browsing behaviour.
- **Streaming product cards** — render partial product cards as the tool result streams in, rather than waiting for the full tool output.
- **Inventory & pricing sync** — connect `getProductDetails` to a live inventory API so stock status and prices are always current.
