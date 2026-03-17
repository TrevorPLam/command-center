# ADR-001: Canonical Architecture Decision

## Status

Accepted

## Context

The Command Center project had multiple architectural approaches in the planning documents:

- Tauri desktop application with static export + Node sidecar
- Local Next.js server with Route Handlers and Server Actions
- Various combinations of runtimes, databases, and tool protocols

We needed to choose a single canonical architecture to guide implementation.

## Decision

We adopt the **local Next.js 15 App Router architecture** as the canonical approach:

### Core Stack

- **Frontend**: Next.js 15 App Router + TypeScript + Tailwind CSS + shadcn/ui
- **Runtime**: Node.js server on same machine as AI models
- **Database**: SQLite + Drizzle ORM for transactional data
- **Vector Store**: LanceDB for RAG and embeddings
- **AI Runtime**: Ollama as primary inference runtime
- **Streaming**: Server-Sent Events (SSE) for real-time updates
- **Tools**: Direct tool registry first, MCP as optional integration

### Deployment Model

- Single-machine local operation
- Browser connects to local Next.js server
- Next.js server orchestrates local AI services
- No remote dependencies for core functionality

## Consequences

### Positive

- Simplified architecture with clear boundaries
- Modern development experience with App Router
- Local-first operation preserves privacy
- Room to grow into Tauri packaging later
- Clear upgrade path for additional runtimes

### Negative

- Requires Node.js runtime (not purely static)
- Single-user limitation in initial design
- Local machine performance constraints

### Neutral

- Tauri becomes a future packaging option
- MCP integration deferred but planned
- Multi-user features require architectural changes

## Implementation Notes

- All panels route through `(command-center)` route group
- Server Components for initial data hydration
- Route Handlers for streaming and browser-facing APIs
- Server Actions for mutations and settings
- Environment validation prevents invalid configurations

## Future Considerations

- Tauri packaging for desktop distribution
- Multi-user support with authentication
- Additional AI runtime adapters
- Cloud deployment options (optional)

---

_This ADR consolidates decisions from planning documents 1.md through 7.md and establishes the canonical architecture for implementation._
