# Local AI Command Center

A local-first, panel-driven control surface for AI operations, built with Next.js 15 and modern web technologies.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run preflight checks
pnpm run preflight

# Start development server
pnpm run dev
```

## Architecture

This project follows the canonical architecture defined in the master guide:

- **Frontend**: Next.js 15 App Router + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js runtime with Route Handlers and Server Actions
- **Database**: SQLite + Drizzle ORM for transactional data
- **Vector Store**: LanceDB for RAG and embeddings
- **Runtime**: Ollama for local model inference
- **Streaming**: Server-Sent Events (SSE)

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Ollama (running locally on `http://127.0.0.1:11434`)

### Setup

1. Clone and install:

   ```bash
   git clone <repository>
   cd command-center
   pnpm install
   ```

2. Run preflight checks:

   ```bash
   pnpm run preflight
   ```

3. Start development:
   ```bash
   pnpm run dev
   ```

### Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Type checking
- `pnpm test` - Run tests
- `pnpm format` - Format code

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (command-center)/  # Route group for main UI
│   ├── api/               # API routes
│   └── globals.css
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   └── layout/           # Layout components
├── lib/                  # Core libraries
│   ├── config/           # Configuration
│   ├── db/               # Database setup
│   ├── runtime/          # Runtime adapters
│   └── utils/            # Utilities
└── types/                # TypeScript definitions
```

## Environment Variables

Create a `.env.local` file:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
DATABASE_URL=./data/command-center.db
LANCEDB_DIR=./data/lancedb
LOG_DIR=./data/logs
```

## License

MIT
