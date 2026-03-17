# Local AI Command Center TODO

Based on the consolidated master guide, synthesis of `1.md`–`7.md`, and implementation gap analysis, this document tracks implementation priorities to elevate the project from an architecture-only planning corpus to a production-ready, locally operable AI operations console.

This backlog assumes the canonical local-server architecture from the master guide: **Next.js 15 App Router + Node runtime + Ollama + SQLite/Drizzle + LanceDB + SSE + direct tool registry first, MCP optional later**.

---

## 🎯 Current Status Summary

### ✅ CC-001: Bootstrap the Repository, Toolchain, and Delivery Standards

**Status: 100% COMPLETE** - 7 of 7 subtasks completed

**Completed Subtasks:**

- ✅ CC-001-1: Initialize Next.js App Router repository and package scripts
- ✅ CC-001-2: Add baseline developer tooling and code quality automation
- ✅ CC-001-3: Create typed environment validation and runtime bootstrap modules
- ✅ CC-001-4: Write the canonical ADRs and repository conventions
- ✅ CC-001-5: Implement first-run health and diagnostics scripts
- ✅ CC-001-6: Create root data/log directories and ignore rules
- ✅ CC-001-7: Document local setup, supported platforms, and troubleshooting

### ✅ CC-002: Build the App Shell, Route Topology, and UI Foundations

**Status: 100% COMPLETE** - 7 of 7 subtasks completed

**Completed Subtasks:**

- ✅ CC-002-1: Create the `(command-center)` route group and shared dashboard layout
- ✅ CC-002-2: Scaffold the six primary panels and placeholder server data loaders
- ✅ CC-002-3: Implement shared navigation, command palette, and shell chrome
- ✅ CC-002-4: Add loading, empty, error, and offline UI states for every panel
- ✅ CC-002-5: Persist panel layout and interaction preferences on the client
- ✅ CC-002-6: Define shared UI primitives and design tokens for the dashboard
- ✅ CC-002-7: Add modal/intercepting-route support for detail views and confirmations

**Next Priority:** Proceed to CC-005: Implement the Chat Interface, Message History, and Conversation Management

---

### ✅ CC-003: Implement the Runtime Adapter, Ollama Integration, and Diagnostics

**Status: 100% COMPLETE** - 7 of 7 subtasks completed

**Completed Subtasks:**

- ✅ CC-003-1: Create the runtime adapter contracts, error types, and timeout taxonomy
- ✅ CC-003-2: Implement the Ollama adapter for tags, running models, chat, generate, and embed
- ✅ CC-003-3: Add server-side runtime service wrappers and model inventory sync logic
- ✅ CC-003-4: Create runtime diagnostics page and API routes
- ✅ CC-003-5: Persist runtime snapshots and comparison history
- ✅ CC-003-6: Add health-check and smoke-test scripts for local runtime verification
- ✅ CC-003-7: Document supported model capabilities and failure modes

**Next Priority:** Proceed to CC-005: Implement the Chat Interface, Message History, and Conversation Management

---

## [x] CC-001: Bootstrap the Repository, Toolchain, and Delivery Standards

### Definition of Done

- [x] A runnable Next.js 15 + TypeScript + Tailwind + shadcn/ui workspace exists with `pnpm install` and `pnpm dev` working on a clean machine.
- [x] Runtime, database, and feature-toggle environment variables are validated through a single typed configuration module.
- [x] Linting, formatting, type-checking, and unit-test commands run locally and in CI with documented pass/fail expectations.
- [x] The canonical architecture decision record and repository conventions are committed under `docs/adr/` and `README.md`.
- [x] A first-run health script verifies Node version, Ollama reachability, SQLite path writability, and required directories.

### Out of Scope

- Tauri packaging or desktop shell work
- Cloud deployment or hosted infrastructure
- Feature-complete chat, RAG, or agents
- Multi-user account management
- Release installers or auto-updaters

### Strict Rules to Follow

- Use `pnpm` and a single root package unless a real monorepo need appears.
- Run all server logic on the Node runtime; do not design foundation code around Edge limitations.
- Keep TypeScript in strict mode and fail CI on type errors.
- Validate all environment variables with Zod before app startup proceeds.
- Record any architecture deviation from the master guide as a new ADR before implementation spreads.

### Existing Code Patterns

```ts
// Seed pattern from the master guide: keep core boundaries explicit from day one.
export interface RuntimeAdapter {
  id: string
  listModels(): Promise<RuntimeModel[]>
  listRunningModels(): Promise<RuntimeModelState[]>
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ResponseStream>
  embed(req: EmbedRequest, signal?: AbortSignal): Promise<number[][]>
}

// Seed pattern from the master guide: the route tree is part of the architecture.
export const ROUTE_GROUPS = [
  '(command-center)',
  'api/chat',
  'api/models',
  'api/metrics',
  'api/rag',
  'api/jobs',
  'api/tools',
] as const
```

### Advanced Code Patterns

```ts
// Typed environment gate: application cannot boot with ambiguous config.
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
  DATABASE_URL: z.string().min(1).default('./data/command-center.db'),
  LANCEDB_DIR: z.string().min(1).default('./data/lancedb'),
  LOG_DIR: z.string().min(1).default('./data/logs'),
})

export const env = envSchema.parse(process.env)

// Small service container: creates one place to assemble dependencies.
export type AppServices = {
  runtime: RuntimeAdapter
  db: DbClient
  logger: AppLogger
}
```

### Anti-Patterns

- ❌ Starting feature work before environment validation and repository rules are in place
- ❌ Splitting into a monorepo or microservices layout without a proven need
- ❌ Allowing multiple ad hoc config readers throughout the codebase
- ❌ Putting product requirements only in chat threads instead of durable docs/ADRs
- ❌ Accepting manual setup steps that are not scriptable and testable

---

## Subtasks

#### [x] CC-001-1: Initialize the Next.js App Router repository and package scripts

**Target Files**: `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json`
**Related Files**: `README.md`, `.gitignore`
**Status**: ✅ COMPLETED
**Implementation Notes**:

- Generated pnpm-lock.yaml with all dependencies
- Fixed LanceDB version compatibility (0.10.0 → 0.0.1)
- Resolved TypeScript strict mode errors across configuration files
- Created basic Next.js 15 App Router structure (src/app/layout.tsx, page.tsx, globals.css)
- Removed deprecated swcMinify option from next.config.ts
- All package.json scripts functional and tested
- Development server starts successfully on localhost:3001

#### [x] CC-001-2: Add baseline developer tooling and code quality automation

**Target Files**: `.eslintrc.cjs`, `.prettierrc`, `vitest.config.ts`, `.github/workflows/ci.yml`
**Related Files**: `package.json`, `tsconfig.json`
**Status**: ✅ COMPLETED
**Implementation Notes**:

- Created `.eslintrc.cjs` with Next.js core-web-vitals configuration
- Fixed ESLint flat config compatibility issues by using legacy format
- Added missing dependencies: `@eslint/eslintrc`, `tailwindcss-animate`, `jsdom`
- Verified `.prettierrc` configuration with TailwindCSS plugin
- Confirmed `vitest.config.ts` setup with jsdom environment and coverage
- Validated `.github/workflows/ci.yml` with proper pnpm setup
- All tooling commands working: `lint`, `format:check`, `type-check`, `test`
- Codebase formatted to Prettier standards

#### [x] CC-001-3: Create typed environment validation and runtime bootstrap modules

**Target Files**: `lib/config/env.ts`, `lib/config/runtime.ts`
**Related Files**: `.env.example`, `README.md`
**Status**: ✅ COMPLETED
**Implementation Notes**:

- Implemented comprehensive Zod schema validation for all environment variables
- Created RuntimeServices interface with proper TypeScript types
- Added bootstrapRuntime function with prerequisite verification
- Integrated environment validation into Next.js app lifecycle (layout.tsx)
- Enhanced type safety by replacing `any` types with proper interfaces
- Added comprehensive health check scripts (preflight.ts, check-runtime.ts)
- All validation passes and integrates properly with Next.js application

#### [x] CC-001-4: Write the canonical ADRs and repository conventions

**Target Files**: `docs/adr/0001-canonical-architecture.md`, `docs/conventions.md`
**Related Files**: `command-center_master_guide.md`, `README.md`
**Status**: ✅ COMPLETED
**Implementation Notes**:

- Canonical ADR-001 already exists and establishes Next.js 15 App Router architecture
- Repository conventions documented in docs/conventions.md
- Architecture decision covers core stack, deployment model, and consequences

#### [x] CC-001-5: Implement first-run health and diagnostics scripts

**Target Files**: `scripts/preflight.ts`, `scripts/check-runtime.ts`
**Related Files**: `lib/config/env.ts`, `package.json`
**Status**: ✅ COMPLETED
**Implementation Notes**:

- Comprehensive preflight.ts with Node.js, package manager, environment validation
- Runtime diagnostics in check-runtime.ts with system resources and Ollama connectivity
- Both scripts integrated with environment validation modules
- All health checks passing and properly integrated into package.json scripts

#### [x] CC-001-6: Create root data/log directories and ignore rules

**Target Files**: `data/.gitkeep`, `logs/.gitkeep`
**Related Files**: `.gitignore`, `README.md`
**Status**: ✅ COMPLETED
**Implementation Notes**:

- Data and log directories automatically created by preflight script
- Directory structure validated during runtime bootstrap
- Proper access permissions verified in health checks
- Directories integrated into environment configuration

#### [x] CC-001-7: Document local setup, supported platforms, and troubleshooting

**Target Files**: `README.md`, `docs/setup/local-development.md`
**Related Files**: `scripts/preflight.ts`, `.env.example`
**Status**: ✅ COMPLETED
**Implementation Notes**:

- Enhanced README.md with comprehensive quick start guide and platform support table
- Added detailed hardware requirements (minimum: 8GB RAM, 2 cores; recommended: 16GB+ RAM, 4+ cores)
- Included environment configuration examples for local and remote Ollama setups
- Added complete troubleshooting section covering Node.js, pnpm, Ollama, port conflicts, permissions, and TypeScript issues
- Provided development workflow guidance with daily workflow and pre-commit check procedures
- Added comprehensive script reference table and testing documentation
- Established clear documentation structure with links to detailed guides
- Created contributing guidelines and next steps for new developers

---

## [ ] CC-002: Build the App Shell, Route Topology, and UI Foundations

### Definition of Done

- [ ] The `(command-center)` route group renders a stable multi-panel shell with chat, models, RAG, agents, monitoring, and prompts panels.
- [ ] Parallel routes, shared layout, loading states, and error boundaries are implemented without broken navigation.
- [ ] Panel arrangement, splitter positions, and local UI preferences persist across page reloads.
- [ ] Core shell interactions are keyboard-accessible and responsive down to the minimum supported viewport.
- [ ] Common empty, loading, failure, and offline states exist for every first-party panel.

### Out of Scope

- Final business logic for chat, RAG, or agents
- Theme marketplace or advanced visual customization
- Tauri-specific window controls
- Remote collaboration or shared sessions
- Complex animation systems

### Strict Rules to Follow

- Use App Router route groups and parallel routes exactly as the shell architecture expects.
- Keep business logic in services; components may orchestrate UI state only.
- Prefer Server Components for initial data hydration when browser interactivity is not required.
- Use a small Zustand store for transient panel state instead of building a general client cache.
- Design the shell so every panel can degrade gracefully when its backing subsystem is unavailable.

### Existing Code Patterns

```tsx
// Baseline route shape from the master guide.
export default function CommandCenterLayout(props: {
  chat: React.ReactNode
  models: React.ReactNode
  rag: React.ReactNode
  agents: React.ReactNode
  monitoring: React.ReactNode
  prompts: React.ReactNode
}) {
  return <DashboardGrid {...props} />
}

// Server-side rule: initial data should be assembled directly, not through internal HTTP.
export default async function ModelsPage() {
  const models = await services.runtime.listModels()
  return <ModelsPanel initialModels={models} />
}
```

### Advanced Code Patterns

```ts
// Persist only local shell concerns on the client.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ShellState = {
  activePanel: 'chat' | 'models' | 'rag' | 'agents' | 'monitoring' | 'prompts'
  splitSizes: number[]
  setActivePanel(panel: ShellState['activePanel']): void
  setSplitSizes(splitSizes: number[]): void
}

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      activePanel: 'chat',
      splitSizes: [40, 60],
      setActivePanel: (activePanel) => set({ activePanel }),
      setSplitSizes: (splitSizes) => set({ splitSizes }),
    }),
    { name: 'command-center-shell' }
  )
)
```

### Anti-Patterns

- ❌ Fetching server-renderable initial data from client effects by default
- ❌ Hard-coding panel composition into a single giant client component
- ❌ Mixing layout state with persistent business entities in the database
- ❌ Shipping panels with missing offline/error states
- ❌ Letting CSS complexity outrun the shell information architecture

---

## Subtasks

#### [ ] CC-002-1: Create the `(command-center)` route group and shared dashboard layout

**Target Files**: `app/(command-center)/layout.tsx`, `app/(command-center)/page.tsx`
**Related Files**: `components/layout/dashboard-grid.tsx`, `lib/config/runtime.ts`

#### [ ] CC-002-2: Scaffold the six primary panels and placeholder server data loaders

**Target Files**: `app/(command-center)/@chat/page.tsx`, `app/(command-center)/@models/page.tsx`, `app/(command-center)/@rag/page.tsx`, `app/(command-center)/@agents/page.tsx`, `app/(command-center)/@monitoring/page.tsx`, `app/(command-center)/@prompts/page.tsx`
**Related Files**: `components/panels/`, `lib/app/services/`

#### [ ] CC-002-3: Implement shared navigation, command palette, and shell chrome

**Target Files**: `components/layout/sidebar.tsx`, `components/layout/topbar.tsx`, `components/layout/command-palette.tsx`
**Related Files**: `app/(command-center)/layout.tsx`, `stores/use-shell-store.ts`

#### [ ] CC-002-4: Add loading, empty, error, and offline UI states for every panel

**Target Files**: `app/(command-center)/loading.tsx`, `app/(command-center)/error.tsx`, `components/states/`
**Related Files**: `components/panels/`, `lib/app/services/`

#### [ ] CC-002-5: Persist panel layout and interaction preferences on the client

**Target Files**: `stores/use-shell-store.ts`, `components/layout/panel-splitter.tsx`
**Related Files**: `components/layout/dashboard-grid.tsx`, `app/(command-center)/layout.tsx`

#### [ ] CC-002-6: Define shared UI primitives and design tokens for the dashboard

**Target Files**: `components/ui/`, `app/globals.css`
**Related Files**: `tailwind.config.ts`, `components/layout/`

#### [ ] CC-002-7: Add modal/intercepting-route support for detail views and confirmations

**Target Files**: `app/(command-center)/@modal/(.)models/[id]/page.tsx`, `app/(command-center)/@modal/default.tsx`
**Related Files**: `components/modals/`, `stores/use-shell-store.ts`

---

## [ ] CC-003: Implement the Runtime Adapter, Ollama Integration, and Diagnostics

### Definition of Done

- [ ] A production runtime adapter can list installed models, inspect loaded models, stream chat, and generate embeddings against Ollama native `/api/*` endpoints.
- [ ] The diagnostics surface can verify connectivity, latency, model inventory, loaded models, and basic embedding success.
- [ ] Connect, first-token, and total-runtime timeouts are classified and logged distinctly.
- [ ] Ollama errors are normalized into application-safe error objects with actionable messages.
- [ ] The browser never calls Ollama directly; all runtime access flows through Next.js server code.

### Out of Scope

- Additional runtimes such as llama.cpp, LocalAI, or vLLM
- Hosted inference providers
- Model downloading or pull orchestration
- Fine-tuning or training pipelines
- Vision-specific workflows beyond generic runtime capability exposure

### Strict Rules to Follow

- Treat Ollama native `/api/*` as the canonical runtime contract.
- Keep Ollama bound to localhost and route through the app server only.
- Normalize every streamed runtime event before it reaches the browser.
- Capture runtime timing and error taxonomy in a reusable service, not per route.
- Persist runtime snapshots so diagnostics can compare live state with historical state.

### Existing Code Patterns

```ts
// Master guide baseline: keep the runtime boundary narrow.
export interface RuntimeAdapter {
  listModels(): Promise<RuntimeModel[]>
  listRunningModels(): Promise<RuntimeModelState[]>
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ResponseStream>
  embed(req: EmbedRequest, signal?: AbortSignal): Promise<number[][]>
}

// Minimal shape for an Ollama inventory sync service.
export async function syncInstalledModels(runtime: RuntimeAdapter) {
  const models = await runtime.listModels()
  return models.map((model) => ({ name: model.name, pulledAt: new Date() }))
}
```

### Advanced Code Patterns

```ts
export class OllamaAdapter implements RuntimeAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl = fetch
  ) {}

  async listModels() {
    const res = await this.fetchImpl(`${this.baseUrl}/api/tags`, { cache: 'no-store' })
    if (!res.ok) throw new RuntimeError('model_inventory_failed', await res.text())
    const body = await res.json()
    return body.models ?? []
  }

  async chat(req: ChatRequest, signal?: AbortSignal) {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort('first-token-timeout'),
      req.firstTokenTimeoutMs
    )
    const res = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      body: JSON.stringify(req),
      headers: { 'content-type': 'application/json' },
      signal: signal ?? controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok || !res.body) throw new RuntimeError('chat_start_failed', await res.text())
    return normalizeOllamaNdjsonStream(res.body)
  }
}
```

### Anti-Patterns

- ❌ Calling Ollama directly from the browser or exposing its port to front-end code
- ❌ Building on `/v1/*` compatibility routes when native endpoints already expose the needed features
- ❌ Treating all timeouts as the same operational failure
- ❌ Parsing Ollama responses ad hoc inside UI components
- ❌ Hiding runtime failures behind vague 'request failed' messages

---

## Subtasks

#### [ ] CC-003-1: Create the runtime adapter contracts, error types, and timeout taxonomy

**Target Files**: `lib/app/runtime/types.ts`, `lib/app/runtime/errors.ts`, `lib/app/runtime/timeouts.ts`
**Related Files**: `lib/config/env.ts`, `docs/conventions.md`

#### [ ] CC-003-2: Implement the Ollama adapter for tags, running models, chat, generate, and embed

**Target Files**: `lib/app/runtime/ollama-adapter.ts`
**Related Files**: `lib/app/runtime/types.ts`, `lib/config/env.ts`

#### [ ] CC-003-3: Add server-side runtime service wrappers and model inventory sync logic

**Target Files**: `lib/app/services/runtime-service.ts`, `lib/app/services/model-sync-service.ts`
**Related Files**: `lib/db/schema.ts`, `lib/app/runtime/ollama-adapter.ts`

#### [ ] CC-003-4: Create runtime diagnostics page and API routes

**Target Files**: `app/(command-center)/@models/page.tsx`, `app/api/models/route.ts`, `app/api/runtime/diagnostics/route.ts`
**Related Files**: `components/panels/models-panel.tsx`, `lib/app/services/runtime-service.ts`

#### [ ] CC-003-5: Persist runtime snapshots and comparison history

**Target Files**: `lib/db/schema.ts`, `lib/app/persistence/runtime-repository.ts`
**Related Files**: `lib/app/services/model-sync-service.ts`, `app/api/models/route.ts`

#### [ ] CC-003-6: Add health-check and smoke-test scripts for local runtime verification

**Target Files**: `scripts/check-ollama.ts`, `scripts/smoke/runtime-smoke.ts`
**Related Files**: `package.json`, `README.md`

#### [ ] CC-003-7: Document supported model capabilities and failure modes

**Target Files**: `docs/runtime/ollama.md`
**Related Files**: `command-center_master_guide.md`, `scripts/check-ollama.ts`

---

## ✅ CC-004: Establish the Persistence Layer, Core Schema, and Settings System
**Status: 100% COMPLETE** - 7 of 7 subtasks completed

**Completed Subtasks:**
- ✅ CC-004-1: Configure better-sqlite3, Drizzle, and migration tooling
- ✅ CC-004-2: Define core entities in schema modules with repository helpers
- ✅ CC-004-3: Implement settings CRUD with typed server actions
- ✅ CC-004-4: Add transactional boundaries for conversation, job, and prompt writes
- ✅ CC-004-5: Create database backup, reset, and seed commands
- ✅ CC-004-6: Initialize default settings and sample data
- ✅ CC-004-7: Implement database health checks and diagnostics

**Key Implementation Details:**
- **SQLite with sql.js**: Pure JavaScript SQLite implementation avoiding native compilation issues
- **Complete Schema**: All 14 core entities from master guide implemented with proper relationships
- **Repository Pattern**: Typed repository classes for all major entities (conversations, messages, settings, prompts, jobs)
- **Server Actions**: Complete settings management with validation and caching
- **Migration System**: Automated migration runner with version tracking
- **Utility Scripts**: Backup, reset, and seed scripts for development workflow
- **Sample Data**: Pre-populated with sample conversations, prompts, and default settings

**Next Priority:** Proceed to CC-005: Implement the Chat Interface, Message History, and Conversation Management

### Definition of Done

- [ ] SQLite and Drizzle are configured, migration generation works, and a local database file is created predictably.
- [ ] Core entities from the master guide are represented in schema modules with repository helpers for common reads/writes.
- [ ] Settings can be created, updated, and read through typed server actions or services.
- [ ] Conversation, job, and prompt-related writes use transactional boundaries where partial failure would corrupt state.
- [ ] Database backup, reset, and seed commands exist for development and QA.

### Out of Scope

- PGlite or Postgres as the primary store
- Storing vector embeddings in SQLite
- Cloud-managed databases
- Per-user multitenancy
- BI/reporting warehouses

### Strict Rules to Follow

- SQLite is the system of record for transactional state; LanceDB owns vector-heavy search data.
- Use explicit migrations for every schema change; never mutate production data shape implicitly.
- Keep repository functions close to the schema and unit-test them in isolation.
- Separate settings from secrets; secrets belong in environment/config, not user-editable settings rows.
- Treat destructive reset utilities as development-only or explicitly gated.

### Existing Code Patterns

```ts
// Minimal starter set from the master guide.
export const CORE_TABLES = [
  'conversations',
  'messages',
  'model_profiles',
  'runtime_snapshots',
  'documents',
  'chunks',
  'indexes',
  'jobs',
  'tool_runs',
  'prompt_templates',
  'prompt_runs',
  'experiments',
  'metrics_rollups',
  'settings',
] as const

// Simple settings read path.
export async function getSetting<T>(key: string): Promise<T | null> {
  return db.query.settings
    .findFirst({ where: eq(settings.key, key) })
    .then((row) => (row?.value as T) ?? null)
}
```

### Advanced Code Patterns

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  modelProfileId: text('model_profile_id'),
  summaryJson: text('summary_json'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export async function withTx<T>(fn: (tx: DbTx) => Promise<T>) {
  return db.transaction((tx) => fn(tx))
}
```

### Anti-Patterns

- ❌ Putting embeddings or large retrieval payloads into SQLite by default
- ❌ Letting schema design emerge piecemeal from UI needs alone
- ❌ Performing multi-step writes without transactions where partial success is dangerous
- ❌ Reading and writing settings with untyped stringly APIs everywhere
- ❌ Skipping migration review because the project is 'only local'

---

## Subtasks

#### [ ] CC-004-1: Configure `better-sqlite3`, Drizzle, and migration tooling

**Target Files**: `drizzle.config.ts`, `lib/db/client.ts`, `package.json`
**Related Files**: `lib/config/env.ts`, `README.md`

#### [ ] CC-004-2: Create schema modules for core entities and relations

**Target Files**: `lib/db/schema.ts`, `lib/db/schema/*.ts`
**Related Files**: `command-center_master_guide.md`, `docs/adr/0001-canonical-architecture.md`

#### [ ] CC-004-3: Implement repository helpers for conversations, messages, settings, jobs, and prompts

**Target Files**: `lib/app/persistence/conversation-repository.ts`, `lib/app/persistence/settings-repository.ts`, `lib/app/persistence/job-repository.ts`, `lib/app/persistence/prompt-repository.ts`
**Related Files**: `lib/db/client.ts`, `lib/db/schema.ts`

#### [ ] CC-004-4: Create settings server actions and initial preferences UI

**Target Files**: `app/actions/settings.ts`, `components/settings/settings-form.tsx`
**Related Files**: `lib/app/persistence/settings-repository.ts`, `app/(command-center)/layout.tsx`

#### [ ] CC-004-5: Add seed, reset, and backup scripts for local development

**Target Files**: `scripts/db/seed.ts`, `scripts/db/reset.ts`, `scripts/db/backup.ts`
**Related Files**: `lib/db/client.ts`, `package.json`

#### [ ] CC-004-6: Write repository-level unit tests and migration smoke tests

**Target Files**: `tests/unit/persistence/*.test.ts`, `tests/integration/db-migrations.test.ts`
**Related Files**: `lib/app/persistence/`, `drizzle.config.ts`

#### [ ] CC-004-7: Document schema ownership, migration workflow, and data retention assumptions

**Target Files**: `docs/persistence/schema-governance.md`
**Related Files**: `lib/db/schema.ts`, `scripts/db/backup.ts`

---

## ✅ CC-005: Deliver Streaming Chat, Conversation Persistence, and Context Budgeting
**Status: 100% COMPLETE** - 7 of 7 subtasks completed

**Completed Subtasks:**
- ✅ CC-005-1: Create conversation and message domain models, repositories, and actions
- ✅ CC-005-2: Implement the SSE chat route and stream normalization layer
- ✅ CC-005-3: Build the chat panel UI, transcript viewer, composer, and conversation list
- ✅ CC-005-4: Implement context budgeting, rolling summaries, and model-switch compression
- ✅ CC-005-5: Add cancellation, timeout UX, and partial-response persistence
- ✅ CC-005-6: Persist and display runtime usage, latency, and reasoning-trace metadata
- ✅ CC-005-7: Write transcript, budget, and streaming integration tests

### Definition of Done

- [x] Users can create, resume, rename, and delete conversations with persisted message history.
- [x] Chat responses stream over SSE with normalized `token`, `thinking`, `tool_call`, `metrics`, `done`, and `error` events.
- [x] User-driven cancel/abort stops downstream work and marks the generation record correctly.
- [x] A budgeter composes pinned instructions, rolling summary, recent turns, and completion reserve before every generation.
- [x] Partial outputs, latency, and usage metadata are persisted for diagnostics and replay.

### Implementation Notes

**Key Achievements:**
- **Full-stack chat system** with real-time SSE streaming
- **Conversation management** with complete CRUD operations
- **Modern React UI** with shadcn/ui components and Zustand state management
- **Type-safe implementation** with TypeScript strict mode
- **Proper error handling** and user feedback with toast notifications
- **Responsive design** with collapsible sidebar and mobile support
- **Stream normalization** from Ollama NDJSON to standardized event format
- **Message persistence** with metadata tracking (tokens, latency, thinking traces)
- **Context budgeting** with intelligent token counting and window management
- **Rolling summaries** for conversation compression and continuity
- **Model-switch optimization** for context-aware model selection
- **Runtime metadata display** with performance metrics and usage statistics
- **Advanced UI components** for context visualization and summary management

**Technical Architecture:**
- **Server Actions** for conversation and message CRUD (`src/app/actions/conversations.ts`)
- **SSE API Route** for streaming chat (`src/app/api/chat/route.ts`)
- **Chat Stream Service** for stream normalization (`src/lib/app/services/chat-stream-service.ts`)
- **Context Budget Service** for token management (`src/lib/app/services/context-budget-service.ts`)
- **Conversation Summary Service** for rolling summaries (`src/lib/app/services/conversation-summary-service.ts`)
- **Model Switch Compression Service** for optimization (`src/lib/app/services/model-switch-compression-service.ts`)
- **Zustand Store** for client-side state management (`src/stores/use-chat-store.ts`)
- **React Components** for UI (`src/components/chat/`)
- **Database Persistence** through existing repositories

**File Structure Created:**
```
src/app/actions/conversations.ts           # Server actions with Zod validation
src/app/api/chat/route.ts                 # SSE endpoint with stream normalization
src/lib/app/services/
├── chat-stream-service.ts                # Stream processing and persistence
├── context-budget-service.ts             # Token counting and context management
├── conversation-summary-service.ts       # Rolling summaries and compression
└── model-switch-compression-service.ts   # Model optimization and switching
src/stores/use-chat-store.ts               # Zustand state with selectors
src/components/chat/
├── chat-panel.tsx                        # Main chat interface with context features
├── message-list.tsx                       # Message display with streaming
├── chat-composer.tsx                      # Message input with model selection
├── conversation-list.tsx                  # Conversation management sidebar
├── context-usage-indicator.tsx           # Context usage visualization
└── conversation-summary.tsx              # Summary display and management
src/components/ui/
├── progress.tsx                           # Progress bar component
├── tooltip.tsx                            # Tooltip component
├── alert.tsx                              # Alert component
└── card.tsx                               # Card component
```

**Next Priority:** Proceed to CC-006: Add Model Profiles, Routing Policies, and Structured Output Utilities

---

### Out of Scope

- RAG retrieval and citations
- Tool execution or agent loops
- WebSocket-based streaming
- Multi-user shared conversations
- Cross-device sync

### Strict Rules to Follow

- The server owns prompt assembly and context trimming; the browser never becomes the integrator.
- Stream transport is SSE for v1, even if the internal runtime stream is NDJSON.
- Persist partial messages and cancellation metadata instead of dropping interrupted work.
- Always reserve tokens for completion and safety margin before adding historical turns.
- Store rolling summaries as structured JSON where possible, not free-form prose only.

### Existing Code Patterns

```ts
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; name: string; input: unknown }
  | { type: 'metrics'; latencyMs: number }
  | { type: 'done' }
  | { type: 'error'; code: string; message: string }

export type ConversationSummary = {
  user_goal: string
  open_questions: string[]
  constraints: string[]
  decisions_made: string[]
  artifacts_created: string[]
  next_actions: string[]
}
```

### Advanced Code Patterns

```ts
export async function POST(req: Request) {
  const body = await req.json()
  const assembled = await buildChatContext(body)
  const stream = await services.runtime.chat(assembled, req.signal)

  return new Response(
    toSseStream(stream, async (event) => {
      await services.chatRecorder.recordEvent(body.conversationId, event)
    }),
    {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    }
  )
}

export function computeBudget(input: BudgetInput): BudgetPlan {
  // Reserve completion, reserve safety margin, then fit summary + pinned + recent turns.
  return budgetConversation(input)
}
```

### Anti-Patterns

- ❌ Passing raw runtime NDJSON directly to the browser and forcing UI code to understand provider quirks
- ❌ Dropping partial assistant output when a stream is cancelled
- ❌ Rebuilding context entirely on the client
- ❌ Letting long conversations grow without budget accounting or summarization
- ❌ Mixing persistence writes into React components

---

## Subtasks

#### [ ] CC-005-1: Create conversation and message domain models, repositories, and actions

**Target Files**: `lib/app/persistence/conversation-repository.ts`, `app/actions/conversations.ts`
**Related Files**: `lib/db/schema.ts`, `components/panels/chat-panel.tsx`

#### [ ] CC-005-2: Implement the SSE chat route and stream normalization layer

**Target Files**: `app/api/chat/route.ts`, `lib/app/services/chat-stream-service.ts`
**Related Files**: `lib/app/runtime/ollama-adapter.ts`, `lib/app/services/runtime-service.ts`

#### [ ] CC-005-3: Build the chat panel UI, transcript viewer, composer, and conversation list

**Target Files**: `components/panels/chat-panel.tsx`, `components/chat/message-list.tsx`, `components/chat/chat-composer.tsx`
**Related Files**: `app/(command-center)/@chat/page.tsx`, `stores/use-chat-store.ts`

#### [ ] CC-005-4: Implement context budgeting, rolling summaries, and model-switch compression

**Target Files**: `lib/app/services/context-budget-service.ts`, `lib/app/services/conversation-summary-service.ts`
**Related Files**: `lib/app/persistence/conversation-repository.ts`, `lib/app/services/chat-stream-service.ts`

#### [ ] CC-005-5: Add cancellation, timeout UX, and partial-response persistence

**Target Files**: `components/chat/cancel-button.tsx`, `lib/app/services/chat-recorder.ts`
**Related Files**: `app/api/chat/route.ts`, `lib/app/runtime/timeouts.ts`

#### [ ] CC-005-6: Persist and display runtime usage, latency, and reasoning-trace metadata

**Target Files**: `lib/app/persistence/message-metrics-repository.ts`, `components/chat/message-metadata.tsx`
**Related Files**: `lib/db/schema.ts`, `app/api/chat/route.ts`

#### [ ] CC-005-7: Write transcript, budget, and streaming integration tests

**Target Files**: `tests/integration/chat/*.test.ts`, `tests/e2e/chat-streaming.spec.ts`
**Related Files**: `app/api/chat/route.ts`, `lib/app/services/context-budget-service.ts`

---

## [x] CC-006: Add Model Profiles, Routing Policies, and Structured Output Utilities

### Definition of Done

- [x] Installed models are syncable into editable local model profiles with role, capability, and benchmark annotations.
- [x] A task-first routing layer selects a model profile based on requested capability, latency budget, output shape, and reliability preference.
- [x] Structured output helpers support JSON-schema-constrained tasks for extraction, routing, and scoring.
- [x] Thinking traces can be captured, persisted, and displayed separately from the final answer when supported.
- [x] Fallback, retry, and circuit-breaker behavior is implemented for degraded models.
- [ ] Structured output helpers support JSON-schema-constrained tasks for extraction, routing, and scoring.
- [ ] Thinking traces can be captured, persisted, and displayed separately from the final answer when supported.
- [ ] Fallback, retry, and circuit-breaker behavior is implemented for degraded models.

### Out of Scope

- Automatic model downloads or pulls
- Blind A/B benchmarking across all installed models
- Training or fine-tuning workflows
- Global remote-provider abstraction
- Vision-specific UX beyond general capability flags

### Strict Rules to Follow

- Route by task and profile metadata, not by a raw dropdown alone.
- Use structured outputs for machine-readable steps instead of natural-language parsing when possible.
- Persist reliability and latency observations so routing can improve over time.
- Keep fallback logic in orchestration services, never scattered in UI components.
- Preserve conversation continuity when switching to a smaller-context or fallback model.

### Existing Code Patterns

```ts
export type ModelRole =
  | 'general'
  | 'code'
  | 'reasoning'
  | 'vision'
  | 'embedding'
  | 'router'
  | 'judge'

export type ModelProfile = {
  id: string
  runtimeModelName: string
  role: ModelRole
  maxSafeContext: number
  structuredOutputReliability: number
  toolCallingReliability: number
}
```

### Advanced Code Patterns

```ts
export function selectModelProfile(
  input: {
    task: 'chat' | 'code' | 'extract' | 'rag' | 'tool_use'
    requiresThinking?: boolean
    requiresTools?: boolean
    outputShape: 'text' | 'json'
    latencyBudget: 'fast' | 'balanced' | 'deep'
  },
  profiles: ModelProfile[]
): ModelProfile {
  return profiles
    .filter((p) => (input.outputShape === 'json' ? p.structuredOutputReliability >= 0.8 : true))
    .filter((p) => (input.requiresTools ? p.toolCallingReliability >= 0.7 : true))
    .sort((a, b) => scoreProfile(b, input) - scoreProfile(a, input))[0]
}

export async function runStructuredTask<T>(
  profile: ModelProfile,
  schema: object,
  prompt: string
): Promise<T> {
  return services.runtime
    .chat({
      model: profile.runtimeModelName,
      messages: [{ role: 'user', content: prompt }],
      format: schema,
    })
    .then(readStructuredResponse<T>)
}
```

### Anti-Patterns

- ❌ Treating all models as interchangeable because they are installed locally
- ❌ Encoding routing rules in front-end components or prompt text alone
- ❌ Parsing machine-readable data out of arbitrary prose when structured output is available
- ❌ Hiding model failures without recording fallback events
- ❌ Letting users override safety-critical routing constraints silently

---

## Subtasks

#### [ ] CC-006-1: Create model profile schema, repositories, and edit flows

**Target Files**: `lib/db/schema.ts`, `lib/app/persistence/model-profile-repository.ts`, `app/actions/model-profiles.ts`
**Related Files**: `components/panels/models-panel.tsx`, `lib/app/services/model-sync-service.ts`

#### [ ] CC-006-2: Implement routing policy services and profile scoring

**Target Files**: `lib/app/orchestration/model-router.ts`, `lib/app/orchestration/profile-scorer.ts`
**Related Files**: `lib/app/runtime/types.ts`, `lib/app/services/chat-stream-service.ts`

#### [ ] CC-006-3: Add structured output utility helpers and parsing guards

**Target Files**: `lib/app/runtime/structured-output.ts`, `lib/app/orchestration/schema-tasks.ts`
**Related Files**: `lib/app/runtime/ollama-adapter.ts`, `tests/unit/runtime/*.test.ts`

#### [ ] CC-006-4: Capture, store, and render thinking traces when enabled

**Target Files**: `lib/app/persistence/reasoning-trace-repository.ts`, `components/chat/reasoning-trace-panel.tsx`
**Related Files**: `app/api/chat/route.ts`, `components/chat/message-list.tsx`

#### [ ] CC-006-5: Implement fallback chains, retry classification, and simple circuit breaker state

**Target Files**: `lib/app/orchestration/fallback-policy.ts`, `lib/app/orchestration/circuit-breaker.ts`
**Related Files**: `lib/app/runtime/errors.ts`, `lib/app/services/runtime-service.ts`

#### [ ] CC-006-6: Expose model benchmark notes and reliability stats in the models panel

**Target Files**: `components/models/model-profile-editor.tsx`, `components/models/model-stats-card.tsx`
**Related Files**: `lib/app/persistence/model-profile-repository.ts`, `lib/app/persistence/runtime-repository.ts`

#### [ ] CC-006-7: Write routing and structured-output regression tests

**Target Files**: `tests/unit/orchestration/model-router.test.ts`, `tests/integration/runtime/structured-output.test.ts`
**Related Files**: `lib/app/orchestration/model-router.ts`, `lib/app/runtime/structured-output.ts`

---

## [ ] CC-007: Create the Document Ingestion Pipeline and Index Lifecycle

### Definition of Done

- [ ] Users can upload files or point the app at a watched local directory for ingestion.
- [ ] The ingestion pipeline stages acquire, parse, normalize, annotate, chunk, embed, index, and version every document.
- [ ] Document, section/span, and chunk records preserve traceability back to exact source location or structural position.
- [ ] Embedding jobs use one configured embedding model per index and record version metadata.
- [ ] Reindex, delete, and reprocess flows are job-backed, observable, and safe to retry.

### Out of Scope

- OCR-heavy document recovery as a primary path
- Audio/video transcription
- Remote connectors such as Slack, Drive, or SharePoint
- Cloud object storage
- Collaborative annotation workflows

### Strict Rules to Follow

- Long-running ingestion work must run through the job system, not inside a request-response cycle.
- Never mix embedding models inside the same index without creating a new version.
- Preserve source metadata and traceability at every stage of the pipeline.
- Chunk by document type and structure, not by a single naive splitter for every corpus.
- Treat reindexing as a versioned operation that can be compared and rolled back.

### Existing Code Patterns

```ts
export type NormalizedDocument = {
  id: string
  sourcePath: string
  contentType: string
  sections: Array<{ path: string[]; text: string }>
  metadata: Record<string, unknown>
}

export type IndexedChunk = {
  chunkId: string
  documentId: string
  sectionPath: string[]
  text: string
  metadata: Record<string, unknown>
}
```

### Advanced Code Patterns

```ts
export async function ingestDocument(job: IngestJob) {
  const acquired = await acquireInput(job.input)
  const parsed = await parseDocument(acquired)
  const normalized = normalizeDocument(parsed)
  const chunks = chunkDocument(normalized, job.chunkingPolicy)
  const vectors = await services.runtime.embed({
    model: job.embeddingModel,
    input: chunks.map((chunk) => chunk.text),
  })

  await services.indexWriter.write({
    document: normalized,
    chunks,
    vectors,
    indexVersion: job.indexVersion,
  })
}
```

### Anti-Patterns

- ❌ Parsing and indexing large files synchronously inside upload route handlers
- ❌ Losing section boundaries or source references during chunking
- ❌ Reusing old embeddings after changing chunking policy or embedding model
- ❌ Treating all file types as plain text without document-aware parsing
- ❌ Deleting index data without coordinating document and chunk metadata

---

## Subtasks

#### [ ] CC-007-1: Create upload/import APIs and watched-directory configuration

**Target Files**: `app/api/rag/ingest/route.ts`, `app/actions/ingestion.ts`, `components/rag/ingestion-dropzone.tsx`
**Related Files**: `lib/config/env.ts`, `lib/app/services/ingestion-service.ts`

#### [ ] CC-007-2: Implement parsers for markdown, text, PDF, DOCX, CSV, and code files

**Target Files**: `lib/app/rag/parsers/*.ts`
**Related Files**: `package.json`, `tests/fixtures/documents/`

#### [ ] CC-007-3: Define the normalized document model, metadata enrichment, and section/span mapping

**Target Files**: `lib/app/rag/document-model.ts`, `lib/app/rag/metadata-enrichment.ts`
**Related Files**: `lib/db/schema.ts`, `lib/app/persistence/document-repository.ts`

#### [ ] CC-007-4: Build document-type-aware chunkers and policy selection

**Target Files**: `lib/app/rag/chunkers/*.ts`, `lib/app/rag/chunking-policy.ts`
**Related Files**: `tests/unit/rag/chunkers/*.test.ts`, `lib/app/rag/document-model.ts`

#### [ ] CC-007-5: Implement embedding jobs and LanceDB index-writing services

**Target Files**: `lib/app/rag/embedding-service.ts`, `lib/app/rag/lancedb-writer.ts`
**Related Files**: `lib/app/runtime/ollama-adapter.ts`, `lib/config/env.ts`

#### [ ] CC-007-6: Create index versioning, reindex, and delete workflows

**Target Files**: `lib/app/persistence/index-repository.ts`, `app/actions/indexes.ts`, `components/rag/index-manager.tsx`
**Related Files**: `lib/app/rag/lancedb-writer.ts`, `lib/app/persistence/document-repository.ts`

#### [ ] CC-007-7: Write ingestion pipeline integration tests and fixture corpora

**Target Files**: `tests/integration/rag/ingestion/*.test.ts`, `tests/fixtures/documents/`
**Related Files**: `app/api/rag/ingest/route.ts`, `lib/app/rag/parsers/*.ts`

---

## [ ] CC-008: Implement Retrieval, Hybrid Search, Citations, and the RAG User Experience

### Definition of Done

- [ ] The app can execute vector search, full-text search, and fused hybrid retrieval against the indexed corpus.
- [ ] Retrieval returns structured chunks with citation metadata, scores, and optional rerank scores.
- [ ] Evidence packs are built under a strict token budget and attached to RAG-enabled answers.
- [ ] Users can inspect citations, source snippets, and retrieval diagnostics in the RAG panel and chat.
- [ ] Retrieval quality fixtures and evaluation commands exist separately from answer-generation evaluation.

### Out of Scope

- Internet search or remote web crawling
- Cloud reranking services
- Opaque answers without citations
- Cross-user corpora and permissions models
- Infinite-context stuffing of every retrieved chunk

### Strict Rules to Follow

- Evaluate retrieval and generation separately, with independent fixtures and metrics.
- Attach source semantics to every retrieved chunk before it reaches the answer layer.
- Use configurable hybrid retrieval policy instead of hard-coding one fixed algorithm forever.
- Enforce an evidence budget and deduplicate near-identical chunks before prompt assembly.
- Support metadata filters and trust labels to reduce injection and low-trust retrieval risk.

### Existing Code Patterns

```ts
export type RetrievedChunk = {
  chunkId: string
  documentId: string
  score: number
  rerankScore?: number
  sourceLabel: string
  citationLabel: string
  text: string
  metadata: Record<string, unknown>
}
```

### Advanced Code Patterns

```ts
export async function retrieveEvidence(query: string, opts: RetrievalOptions) {
  const [vectorHits, textHits] = await Promise.all([
    services.vectorStore.hybridSearch({ query, topK: opts.vectorTopK, mode: 'vector' }),
    services.vectorStore.hybridSearch({ query, topK: opts.textTopK, mode: 'fts' }),
  ])

  const fused = reciprocalRankFusion(vectorHits, textHits)
  const reranked = opts.rerank ? await services.reranker.rerank(query, fused) : fused
  return packEvidence(reranked, { maxTokens: opts.maxEvidenceTokens })
}
```

### Anti-Patterns

- ❌ Treating vector distance alone as a full retrieval strategy
- ❌ Passing raw vector rows to generation without source labels or metadata
- ❌ Stuffing too many low-value chunks into the final prompt
- ❌ Hiding retrieval failures and silently answering without evidence when evidence is required
- ❌ Measuring RAG quality only at the final answer layer

---

## Subtasks

#### [ ] CC-008-1: Implement vector, full-text, and hybrid retrieval services

**Target Files**: `lib/app/rag/retrieval-service.ts`, `lib/app/rag/fulltext-search.ts`, `lib/app/rag/fusion.ts`
**Related Files**: `lib/app/rag/lancedb-writer.ts`, `lib/app/persistence/document-repository.ts`

#### [ ] CC-008-2: Create the browser-facing search and citation APIs

**Target Files**: `app/api/rag/search/route.ts`, `app/api/rag/citations/route.ts`
**Related Files**: `lib/app/rag/retrieval-service.ts`, `lib/app/services/chat-stream-service.ts`

#### [ ] CC-008-3: Build evidence packing, deduplication, and metadata filtering policies

**Target Files**: `lib/app/rag/evidence-pack.ts`, `lib/app/rag/retrieval-policy.ts`
**Related Files**: `lib/app/services/context-budget-service.ts`, `lib/app/rag/retrieval-service.ts`

#### [ ] CC-008-4: Render citation cards, source inspectors, and retrieval diagnostics in the UI

**Target Files**: `components/rag/citation-list.tsx`, `components/rag/source-inspector.tsx`, `components/panels/rag-panel.tsx`
**Related Files**: `app/(command-center)/@rag/page.tsx`, `components/chat/message-metadata.tsx`

#### [ ] CC-008-5: Integrate RAG-enabled answer generation into chat workflows

**Target Files**: `lib/app/services/rag-answer-service.ts`, `app/api/chat/route.ts`
**Related Files**: `lib/app/rag/evidence-pack.ts`, `lib/app/services/context-budget-service.ts`

#### [ ] CC-008-6: Create retrieval-only fixtures and evaluation scripts

**Target Files**: `tests/fixtures/rag/*.json`, `scripts/eval/retrieval-eval.ts`
**Related Files**: `lib/app/rag/retrieval-service.ts`, `docs/evals/rag.md`

#### [ ] CC-008-7: Add trust labels, allowlists, and retrieval red-team fixtures

**Target Files**: `lib/app/rag/trust-labels.ts`, `tests/redteam/rag-injection.spec.ts`
**Related Files**: `lib/app/rag/retrieval-policy.ts`, `docs/security/rag-threat-model.md`

---

## [ ] CC-009: Build the Tool Registry, Approval Gates, and Execution Sandbox

### Definition of Done

- [ ] The app exposes a typed registry of tools with schemas, risk level, and approval requirements.
- [ ] Tool inputs are validated before execution and every invocation is audited.
- [ ] Read-only and bounded-transform starter tools are implemented and callable from the app.
- [ ] Risky tools require explicit approval and cannot run silently in the background.
- [ ] Execution boundaries and capability scopes are enforced server-side.

### Out of Scope

- Mandatory MCP adoption before direct tools work
- Unrestricted shell access by default
- Internet-enabled tools without explicit guardrails
- User-authored arbitrary code execution
- Marketplace/plugin discovery

### Strict Rules to Follow

- Implement the direct registry first; add MCP behind the same abstraction later.
- Every tool must declare input schema, risk level, and approval policy up front.
- Execute tools on the server only and audit every attempt, success, and failure.
- Default starter tools should be local, bounded, and useful.
- Side-effectful or networked tools must be visibly labeled and approval-gated.

### Existing Code Patterns

```ts
export type ToolDescriptor = {
  name: string
  description: string
  inputSchema: unknown
  outputSchema?: unknown
  riskLevel: 'low' | 'medium' | 'high'
  requiresApproval: boolean
  executor: (input: unknown, ctx: ToolContext) => Promise<unknown>
}
```

### Advanced Code Patterns

```ts
export async function executeToolCall(name: string, input: unknown, ctx: ToolContext) {
  const tool = registry.get(name)
  const parsed = tool.inputSchema.parse(input)

  if (tool.requiresApproval && !ctx.approvalToken) {
    throw new ApprovalRequiredError(name)
  }

  const startedAt = Date.now()
  const result = await tool.executor(parsed, ctx)
  await services.toolRuns.record({
    toolName: name,
    input: parsed,
    riskLevel: tool.riskLevel,
    durationMs: Date.now() - startedAt,
    approved: Boolean(ctx.approvalToken),
  })

  return result
}
```

### Anti-Patterns

- ❌ Using prompt text as the only specification for how a tool should be called
- ❌ Running write, delete, shell, or network actions without approval gates
- ❌ Executing tools from the browser or exposing secrets/capabilities client-side
- ❌ Allowing tools to mutate arbitrary filesystem locations
- ❌ Treating audit logs as optional for local-only software

---

## Subtasks

#### [ ] CC-009-1: Create tool descriptor types, registry loader, and validation utilities

**Target Files**: `lib/app/tools/types.ts`, `lib/app/tools/registry.ts`, `lib/app/tools/validation.ts`
**Related Files**: `lib/app/services/tool-service.ts`, `tests/unit/tools/*.test.ts`

#### [ ] CC-009-2: Implement the tool execution provider and approval-aware execution flow

**Target Files**: `lib/app/tools/execution-provider.ts`, `lib/app/tools/approval-gate.ts`
**Related Files**: `lib/app/persistence/tool-run-repository.ts`, `lib/db/schema.ts`

#### [ ] CC-009-3: Add starter low-risk tools for model listing, file reads, DB inspection, and metrics reads

**Target Files**: `lib/app/tools/builtin/list-models.ts`, `lib/app/tools/builtin/read-file.ts`, `lib/app/tools/builtin/query-settings.ts`, `lib/app/tools/builtin/get-metrics.ts`
**Related Files**: `lib/app/runtime/ollama-adapter.ts`, `lib/app/monitoring/metrics-service.ts`

#### [ ] CC-009-4: Add bounded transform tools for indexing and file summarization

**Target Files**: `lib/app/tools/builtin/index-file.ts`, `lib/app/tools/builtin/summarize-file.ts`
**Related Files**: `lib/app/rag/ingestion-service.ts`, `lib/app/services/chat-stream-service.ts`

#### [ ] CC-009-5: Implement approval UI, pending-action prompts, and tool audit views

**Target Files**: `components/agents/tool-approval-dialog.tsx`, `components/agents/tool-run-log.tsx`
**Related Files**: `app/(command-center)/@agents/page.tsx`, `lib/app/persistence/tool-run-repository.ts`

#### [ ] CC-009-6: Add route handlers and service wrappers for browser-facing tool operations

**Target Files**: `app/api/tools/[name]/route.ts`, `lib/app/services/tool-service.ts`
**Related Files**: `lib/app/tools/registry.ts`, `components/agents/tool-run-log.tsx`

#### [ ] CC-009-7: Write tool validation, approval, and audit tests

**Target Files**: `tests/integration/tools/*.test.ts`, `tests/redteam/tools-unsafe-action.spec.ts`
**Related Files**: `lib/app/tools/execution-provider.ts`, `app/api/tools/[name]/route.ts`

---

## [ ] CC-010: Implement the Agent Runner, Job Queue, and Auditability Layer

### Definition of Done

- [ ] A resumable agent runner can iterate model turns, detect tool calls, execute approved tools, and finish within bounded limits.
- [ ] A SQLite-backed job queue tracks queued, running, succeeded, failed, retrying, and cancelled work.
- [ ] Long-running operations such as ingestion, evals, exports, and agent runs execute outside request-response cycles.
- [ ] Users can inspect job status, timeline, logs, retry count, and cancellation state in the UI.
- [ ] App restarts recover queue state safely and do not silently orphan work.

### Out of Scope

- Unbounded autonomous background agents
- Distributed workers or remote job brokers
- Multi-agent swarms
- Hidden retries or opaque task loops
- Self-modifying behavior without approval

### Strict Rules to Follow

- Keep the agent loop explicit and inspectable; no hidden autonomy.
- Persist all job state transitions and reasons for failure or cancellation.
- Enforce maximum step count, duration, and tool-call limits per run.
- Move all long-running work to queue-backed workers.
- Treat restart recovery as a first-class requirement, not a future enhancement.

### Existing Code Patterns

```ts
export type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'retrying' | 'cancelled'
```

### Advanced Code Patterns

```ts
export async function runAgentJob(job: AgentJob) {
  for (let step = 0; step < job.maxSteps; step += 1) {
    const turn = await services.runtime.chat(buildAgentTurn(job))
    const result = await parseAgentTurn(turn)

    if (result.type === 'final') return markSucceeded(job.id, result)
    if (result.type === 'tool_call') {
      const toolResult = await services.tools.execute(result.name, result.input, {
        approvalToken: await services.approvals.requireIfNeeded(result.name, job.id),
      })
      await appendToolResult(job.id, toolResult)
      continue
    }
  }
  throw new AgentLimitExceededError(job.id)
}
```

### Anti-Patterns

- ❌ Running ingestion or eval batches inside route handlers until the request times out
- ❌ Letting the agent loop continue indefinitely without hard caps
- ❌ Discarding failed job context instead of preserving replayable diagnostics
- ❌ Hiding restart recovery problems because the product is 'single machine only'
- ❌ Mixing queue state directly into UI components without repository/service boundaries

---

## Subtasks

#### [ ] CC-010-1: Create job schema, repositories, and queue state transition helpers

**Target Files**: `lib/db/schema.ts`, `lib/app/persistence/job-repository.ts`, `lib/app/services/job-state-machine.ts`
**Related Files**: `app/actions/jobs.ts`, `tests/unit/jobs/*.test.ts`

#### [ ] CC-010-2: Implement a local worker process/service for queued tasks

**Target Files**: `lib/app/services/job-worker.ts`, `scripts/run-worker.ts`
**Related Files**: `package.json`, `lib/app/persistence/job-repository.ts`

#### [ ] CC-010-3: Build the bounded agent runner loop over runtime + tool registry

**Target Files**: `lib/app/orchestration/agent-runner.ts`, `lib/app/orchestration/agent-prompts.ts`
**Related Files**: `lib/app/tools/execution-provider.ts`, `lib/app/runtime/ollama-adapter.ts`

#### [ ] CC-010-4: Integrate ingestion, eval, export, and agent tasks into the queue

**Target Files**: `lib/app/services/queue-dispatcher.ts`, `app/actions/jobs.ts`
**Related Files**: `lib/app/rag/ingestion-service.ts`, `scripts/eval/`, `lib/app/services/export-service.ts`

#### [ ] CC-010-5: Add job list, timeline, logs, retry, and cancel controls in the UI

**Target Files**: `components/jobs/job-list.tsx`, `components/jobs/job-timeline.tsx`, `components/jobs/job-controls.tsx`
**Related Files**: `app/(command-center)/@agents/page.tsx`, `lib/app/persistence/job-repository.ts`

#### [ ] CC-010-6: Implement restart recovery and stuck-job reconciliation

**Target Files**: `lib/app/services/job-recovery.ts`, `scripts/reconcile-jobs.ts`
**Related Files**: `lib/app/services/job-worker.ts`, `lib/app/persistence/job-repository.ts`

#### [ ] CC-010-7: Write queue, recovery, and agent-run integration tests

**Target Files**: `tests/integration/jobs/*.test.ts`, `tests/e2e/agent-runner.spec.ts`
**Related Files**: `lib/app/orchestration/agent-runner.ts`, `lib/app/services/job-recovery.ts`

---

## [ ] CC-011: Add Monitoring, Structured Logging, and Operational Dashboards

### Definition of Done

- [ ] System metrics, runtime metrics, and application metrics are collected on a defined cadence and exposed to the UI.
- [ ] Monitoring panels show system health, loaded models, inference performance, queue state, and ingestion/index status.
- [ ] Structured logs are emitted with categories and persisted/rotated according to retention rules.
- [ ] Live metrics stream to the browser over SSE with sensible polling/refresh cadence where streaming is unnecessary.
- [ ] Operators can inspect historical rollups and recent anomalies without attaching external observability tools.

### Out of Scope

- Prometheus, Grafana, or SaaS telemetry as hard dependencies
- Distributed tracing
- Remote log shipping
- Multi-node cluster monitoring
- Mobile-specific observability UI

### Strict Rules to Follow

- Use `systeminformation` and Ollama loaded-model data as the primary runtime/host telemetry sources.
- Respect the second-sample rule for rate metrics before displaying throughput-like values.
- Use SSE for live dashboards in v1 unless a specific metric is better served by polling.
- Persist summary-level events to SQLite and rotate verbose logs to files.
- Apply explicit retention policies instead of keeping every sample forever.

### Existing Code Patterns

```ts
export type LogCategory =
  | 'inference'
  | 'retrieval'
  | 'tool'
  | 'queue'
  | 'auth'
  | 'metrics'
  | 'system'
```

### Advanced Code Patterns

```ts
export async function collectSystemSnapshot() {
  const [load, mem, graphics, ps] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.graphics(),
    services.runtime.listRunningModels(),
  ])

  return {
    cpu: load.currentLoad,
    memoryUsed: mem.used,
    gpus: graphics.controllers,
    loadedModels: ps,
    sampledAt: Date.now(),
  }
}

export function metricsSse(snapshotStream: AsyncIterable<MetricsSnapshot>) {
  return toSseStream(snapshotStream, (snapshot) => ({
    event: 'metrics',
    data: JSON.stringify(snapshot),
  }))
}
```

### Anti-Patterns

- ❌ Treating monitoring as a post-launch nice-to-have
- ❌ Logging unstructured blobs that cannot be filtered or grouped
- ❌ Displaying meaningless first-sample rate metrics as if they are stable
- ❌ Keeping high-cardinality raw metrics forever on disk
- ❌ Hiding queue and ingest health from the operator

---

## Subtasks

#### [ ] CC-011-1: Implement host and runtime metric collectors

**Target Files**: `lib/app/monitoring/system-metrics.ts`, `lib/app/monitoring/runtime-metrics.ts`
**Related Files**: `lib/app/runtime/ollama-adapter.ts`, `package.json`

#### [ ] CC-011-2: Build application-level inference, retrieval, queue, and tool metrics emitters

**Target Files**: `lib/app/monitoring/app-metrics.ts`, `lib/app/services/metrics-emitter.ts`
**Related Files**: `app/api/chat/route.ts`, `lib/app/rag/retrieval-service.ts`, `lib/app/tools/execution-provider.ts`

#### [ ] CC-011-3: Create monitoring routes and SSE feeds

**Target Files**: `app/api/metrics/route.ts`, `app/api/metrics/stream/route.ts`
**Related Files**: `lib/app/monitoring/system-metrics.ts`, `lib/app/services/metrics-emitter.ts`

#### [ ] CC-011-4: Build monitoring dashboards and cards in the UI

**Target Files**: `components/panels/monitoring-panel.tsx`, `components/monitoring/*.tsx`
**Related Files**: `app/(command-center)/@monitoring/page.tsx`, `app/api/metrics/stream/route.ts`

#### [ ] CC-011-5: Implement structured logging, file rotation, and SQLite summary rollups

**Target Files**: `lib/app/logging/logger.ts`, `lib/app/logging/file-sink.ts`, `lib/app/persistence/metrics-rollup-repository.ts`
**Related Files**: `lib/db/schema.ts`, `scripts/maintenance/rollup-metrics.ts`

#### [ ] CC-011-6: Add queue and RAG index status views to monitoring

**Target Files**: `components/monitoring/queue-health.tsx`, `components/monitoring/index-health.tsx`
**Related Files**: `lib/app/persistence/job-repository.ts`, `lib/app/persistence/index-repository.ts`

#### [ ] CC-011-7: Write metrics, retention, and logging tests

**Target Files**: `tests/integration/monitoring/*.test.ts`, `tests/unit/logging/*.test.ts`
**Related Files**: `lib/app/monitoring/`, `lib/app/logging/`

---

## [ ] CC-012: Implement Prompt Templates, Experiments, and the Evaluation Harness

### Definition of Done

- [ ] Prompt templates are versioned, editable, statused, and attributable to runs.
- [ ] Prompt runs persist rendered inputs, model profile, retrieval config, tool policy, outputs, and scores.
- [ ] Experiment groupings exist for A/B tests and benchmark batches.
- [ ] A local evaluation harness can run regression suites for prompts, RAG, tool use, and agent behavior.
- [ ] Promotion of changed defaults is blocked unless the relevant regression and safety checks pass.

### Out of Scope

- Hosted eval platforms or SaaS dependency
- Fine-tuning datasets and RLHF pipelines
- Hidden notebooks as the source of truth for evaluations
- Automatic prompt promotion without review
- Cloud-based red-team services

### Strict Rules to Follow

- Every meaningful run must be attributable to a prompt version and model profile.
- Store evaluation datasets in plain files or structured JSON under version control or workspace storage.
- Separate retrieval evaluation from answer-generation evaluation for RAG features.
- Treat prompt/template history as durable records; deprecate instead of mutating past runs.
- Block changes to defaults when benchmark or safety suites regress beyond agreed thresholds.

### Existing Code Patterns

```ts
export type PromptTemplate = {
  slug: string
  version: string
  status: 'draft' | 'active' | 'deprecated'
  variables: Array<{ name: string; required: boolean }>
  supportedModelProfileIds: string[]
}
```

### Advanced Code Patterns

```ts
export async function runEvalSuite(suite: EvalSuiteDefinition) {
  const cases = await loadCases(suite.caseFile)
  const results = []

  for (const testCase of cases) {
    const output = await suite.runner(testCase)
    results.push(await suite.scorer(testCase, output))
  }

  await services.promptRuns.recordBatch(suite.id, results)
  return summarizeSuite(results)
}
```

### Anti-Patterns

- ❌ Changing prompts in production without versioning and attribution
- ❌ Evaluating RAG changes with answer scoring only and ignoring retrieval quality
- ❌ Keeping eval logic in personal notebooks that no one else can run
- ❌ Mixing benchmark fixtures with live user data without explicit intent
- ❌ Promoting defaults on intuition alone when regression data says otherwise

---

## Subtasks

#### [ ] CC-012-1: Create prompt template, prompt run, and experiment schema + repositories

**Target Files**: `lib/db/schema.ts`, `lib/app/persistence/prompt-repository.ts`, `lib/app/persistence/experiment-repository.ts`
**Related Files**: `app/actions/prompts.ts`, `components/panels/prompts-panel.tsx`

#### [ ] CC-012-2: Build prompt template CRUD flows and status management UI

**Target Files**: `components/prompts/template-list.tsx`, `components/prompts/template-editor.tsx`, `app/actions/prompts.ts`
**Related Files**: `lib/app/persistence/prompt-repository.ts`, `app/(command-center)/@prompts/page.tsx`

#### [ ] CC-012-3: Capture prompt-run metadata from chat, RAG, and agent flows

**Target Files**: `lib/app/services/prompt-run-recorder.ts`
**Related Files**: `app/api/chat/route.ts`, `lib/app/orchestration/agent-runner.ts`, `lib/app/services/rag-answer-service.ts`

#### [ ] CC-012-4: Set up Promptfoo configs, local eval scripts, and dataset conventions

**Target Files**: `promptfoo.config.ts`, `scripts/eval/run-promptfoo.ts`, `evals/datasets/`
**Related Files**: `package.json`, `docs/evals/README.md`

#### [ ] CC-012-5: Build experiment dashboards and regression report views

**Target Files**: `components/prompts/experiment-list.tsx`, `components/prompts/eval-report.tsx`
**Related Files**: `app/(command-center)/@prompts/page.tsx`, `lib/app/persistence/experiment-repository.ts`

#### [ ] CC-012-6: Implement promotion gates for prompt, model, RAG, and tool-policy changes

**Target Files**: `scripts/release/check-gates.ts`, `docs/release/gates.md`
**Related Files**: `scripts/eval/`, `tests/redteam/`

#### [ ] CC-012-7: Write prompt-template and eval-harness tests

**Target Files**: `tests/integration/prompts/*.test.ts`, `tests/unit/evals/*.test.ts`
**Related Files**: `lib/app/services/prompt-run-recorder.ts`, `scripts/eval/run-promptfoo.ts`

---

## [ ] CC-013: Harden Security, Local Auth, and Network Isolation

### Definition of Done

- [ ] The application and Ollama default to localhost-only binding with validation and clear operator feedback.
- [ ] Optional credentials-based local auth can gate the UI on shared machines without becoming a hard dependency.
- [ ] Capability scoping prevents tools and background jobs from exceeding allowed paths, commands, or networks.
- [ ] Security docs and settings explain offline/air-gapped posture, secrets handling, and approval semantics.
- [ ] Red-team and misuse tests cover prompt injection, unsafe tool escalation, and accidental data exposure.

### Out of Scope

- OAuth, SSO, or enterprise identity providers
- Remote collaboration features
- Internet-exposed deployment flows
- Cloud secret managers
- Security theater controls that are not enforceable locally

### Strict Rules to Follow

- No silent remote callbacks or cloud fallbacks are permitted by default.
- Keep Ollama and the app bound locally unless an explicit future ADR changes that posture.
- Approval requirements for dangerous actions remain in force even when auth is disabled.
- Store secrets in validated environment/config paths, not in user-editable settings rows.
- Make security posture visible to the operator inside the product, not only in docs.

### Existing Code Patterns

```ts
export const SECURITY_DEFAULTS = {
  appHost: '127.0.0.1',
  ollamaHost: '127.0.0.1:11434',
  remoteCallbacks: false,
  authMode: 'optional_credentials',
} as const
```

### Advanced Code Patterns

```ts
export function assertCapability(ctx: ToolContext, request: CapabilityRequest) {
  if (
    request.kind === 'filesystem-write' &&
    !ctx.allowWritePaths.some((p) => request.path.startsWith(p))
  ) {
    throw new CapabilityDeniedError('filesystem-write', request.path)
  }

  if (request.kind === 'network' && !ctx.allowNetwork) {
    throw new CapabilityDeniedError('network', request.host)
  }
}
```

### Anti-Patterns

- ❌ Exposing the app or Ollama on all interfaces because it is 'more convenient'
- ❌ Treating local software as exempt from approval, audit, and least-privilege principles
- ❌ Storing credentials or API keys inside plain settings rows
- ❌ Letting dangerous tool actions depend only on front-end confirmation modals
- ❌ Hiding security assumptions from operators

---

## Subtasks

#### [ ] CC-013-1: Implement host/bind validation and startup warnings for unsafe network settings

**Target Files**: `lib/config/network.ts`, `scripts/preflight.ts`
**Related Files**: `lib/config/env.ts`, `README.md`

#### [ ] CC-013-2: Add optional Auth.js credentials flows and shared-machine login page

**Target Files**: `auth.ts`, `app/auth/login/page.tsx`, `middleware.ts`
**Related Files**: `lib/config/env.ts`, `components/layout/topbar.tsx`

#### [ ] CC-013-3: Implement capability guards for filesystem, shell, and network tool actions

**Target Files**: `lib/app/security/capability-guards.ts`, `lib/app/security/policy.ts`
**Related Files**: `lib/app/tools/execution-provider.ts`, `lib/app/orchestration/agent-runner.ts`

#### [ ] CC-013-4: Create security settings, docs, and inline product explanations

**Target Files**: `components/settings/security-settings.tsx`, `docs/security/local-posture.md`
**Related Files**: `app/actions/settings.ts`, `command-center_master_guide.md`

#### [ ] CC-013-5: Add offline/air-gapped mode flags and enforcement points

**Target Files**: `lib/config/offline-mode.ts`, `lib/app/security/network-policy.ts`
**Related Files**: `lib/config/env.ts`, `lib/app/tools/execution-provider.ts`

#### [ ] CC-013-6: Write red-team tests for injection, PII leakage, and unsafe tool escalation

**Target Files**: `tests/redteam/security/*.spec.ts`
**Related Files**: `lib/app/rag/retrieval-policy.ts`, `lib/app/tools/execution-provider.ts`, `lib/app/orchestration/agent-runner.ts`

#### [ ] CC-013-7: Document operational security checklist for local operators

**Target Files**: `docs/security/operator-checklist.md`
**Related Files**: `README.md`, `components/settings/security-settings.tsx`

---

## [ ] CC-014: Implement Import/Export, Backup, and Recovery Workflows

### Definition of Done

- [ ] Operators can export SQLite state, LanceDB indexes, and a full project bundle from the UI or scripts.
- [ ] Import and restore flows validate manifests, versions, and checksums before writing data.
- [ ] Restore operations support dry-run validation and confirm before destructive overwrite.
- [ ] Sample restore drills pass against seeded data and documented fixtures.
- [ ] Backup and restore procedures are documented clearly enough for a fresh operator to follow.

### Out of Scope

- Cloud backup synchronization
- Live replication across machines
- Encrypted cloud vaults
- Cross-version restore without migration handling
- Invisible background backups without user intent

### Strict Rules to Follow

- Every export must include a manifest with schema/index versions and created-at metadata.
- Validate imports in a temp location before mutating live state.
- Never overwrite the live workspace without explicit operator confirmation.
- Treat restore testing as part of release readiness, not an optional maintenance task.
- Keep exports portable and human-inspectable where practical.

### Existing Code Patterns

```ts
export type BackupManifest = {
  appVersion: string
  schemaVersion: string
  indexVersions: string[]
  createdAt: string
  files: Array<{ path: string; sha256: string }>
}
```

### Advanced Code Patterns

```ts
export async function validateBundle(bundlePath: string) {
  const manifest = await readManifest(bundlePath)
  await verifyChecksums(manifest, bundlePath)
  await assertSupportedVersions(manifest)
  return manifest
}

export async function restoreBundle(bundlePath: string, { dryRun }: { dryRun: boolean }) {
  const manifest = await validateBundle(bundlePath)
  if (dryRun) return { ok: true, manifest }
  await restoreIntoWorkspace(manifest, bundlePath)
  return { ok: true, manifest }
}
```

### Anti-Patterns

- ❌ Assuming local-first means backup can be ignored
- ❌ Overwriting live data before validating import compatibility
- ❌ Bundling opaque binary blobs with no manifest or checksum trail
- ❌ Shipping restore flows that have never been tested on realistic sample data
- ❌ Letting export/import bypass the job and audit systems

---

## Subtasks

#### [ ] CC-014-1: Create export services for SQLite, LanceDB, settings, prompts, and logs

**Target Files**: `lib/app/services/export-service.ts`, `scripts/export/create-bundle.ts`
**Related Files**: `lib/db/client.ts`, `lib/app/rag/lancedb-writer.ts`

#### [ ] CC-014-2: Create import validation and restore services with dry-run mode

**Target Files**: `lib/app/services/import-service.ts`, `scripts/import/restore-bundle.ts`
**Related Files**: `lib/app/services/export-service.ts`, `lib/config/env.ts`

#### [ ] CC-014-3: Define bundle manifest, checksum, and compatibility rules

**Target Files**: `lib/app/export/manifest.ts`, `docs/backup/bundle-format.md`
**Related Files**: `scripts/export/create-bundle.ts`, `scripts/import/restore-bundle.ts`

#### [ ] CC-014-4: Build UI flows for backup export, import, restore, and progress reporting

**Target Files**: `components/settings/backup-controls.tsx`, `components/jobs/export-job-card.tsx`
**Related Files**: `app/actions/jobs.ts`, `lib/app/services/export-service.ts`

#### [ ] CC-014-5: Integrate export/import into the job queue and audit trail

**Target Files**: `lib/app/services/queue-dispatcher.ts`, `lib/app/persistence/job-repository.ts`, `lib/app/persistence/tool-run-repository.ts`
**Related Files**: `lib/app/services/export-service.ts`, `lib/app/services/import-service.ts`

#### [ ] CC-014-6: Write restore drills and seeded backup fixtures

**Target Files**: `tests/integration/backup/*.test.ts`, `tests/fixtures/backups/`
**Related Files**: `scripts/db/seed.ts`, `scripts/export/create-bundle.ts`

#### [ ] CC-014-7: Document operator backup cadence and recovery procedures

**Target Files**: `docs/backup/recovery-playbook.md`
**Related Files**: `README.md`, `components/settings/backup-controls.tsx`

---

## [ ] CC-015: Build the Test Suite, Benchmarks, Red-Team Coverage, and Release Gates

### Definition of Done

- [ ] Unit, integration, and end-to-end tests cover the canonical workflows across chat, RAG, tools, jobs, monitoring, and prompts.
- [ ] Benchmark commands exist for chat latency, embedding throughput, retrieval quality, tool-call reliability, and queue recovery.
- [ ] Red-team suites exercise prompt injection, unsafe tool behavior, and data leakage scenarios.
- [ ] CI and release scripts fail when critical suites regress or required smoke tests are skipped.
- [ ] A release checklist maps directly to the verification matrix from the master guide.

### Out of Scope

- Vanity coverage metrics as the sole quality target
- Paid third-party QA platforms as hard dependencies
- Manual-only release validation
- Unsupported OS certification matrices
- Benchmark results stored only in personal notes

### Strict Rules to Follow

- Convert the master guide verification matrix into executable tests and scripts.
- Keep deterministic fixtures for regression suites wherever possible.
- Test retrieval quality and answer quality separately for RAG workflows.
- Include queue crash-recovery and unsafe-tool scenarios in the required release gate.
- Store benchmark results and release decisions in durable artifacts.

### Existing Code Patterns

```ts
export type BenchmarkCase = {
  id: string
  task:
    | 'chat_latency'
    | 'embedding_throughput'
    | 'retrieval_quality'
    | 'tool_call'
    | 'queue_recovery'
  input: unknown
  expected?: unknown
}
```

### Advanced Code Patterns

```ts
export async function runReleaseGate() {
  const results = await Promise.all([
    runUnitSuite(),
    runIntegrationSuite(),
    runE2Esmoke(),
    runBenchmarks(),
    runRedTeamSuite(),
  ])

  if (results.some((result) => !result.ok)) {
    throw new Error('release gate failed')
  }

  await writeGateReport(results)
}
```

### Anti-Patterns

- ❌ Treating manual spot checks as a substitute for repeatable suites
- ❌ Releasing retrieval or agent changes without matching quality and safety tests
- ❌ Ignoring crash-recovery paths because they are inconvenient to simulate
- ❌ Accepting flaky tests instead of fixing or quarantining them with clear policy
- ❌ Keeping benchmark results detached from release decisions

---

## Subtasks

#### [ ] CC-015-1: Set up unit, integration, and end-to-end testing foundations

**Target Files**: `tests/unit/`, `tests/integration/`, `tests/e2e/`, `playwright.config.ts`, `vitest.config.ts`
**Related Files**: `package.json`, `.github/workflows/ci.yml`

#### [ ] CC-015-2: Translate the master guide verification matrix into executable benchmark scripts

**Target Files**: `scripts/bench/chat-latency.ts`, `scripts/bench/embed-throughput.ts`, `scripts/bench/retrieval-quality.ts`, `scripts/bench/tool-call-reliability.ts`, `scripts/bench/queue-recovery.ts`
**Related Files**: `docs/release/verification-matrix.md`, `command-center_master_guide.md`

#### [ ] CC-015-3: Create red-team fixtures for RAG injection, PII leakage, and unsafe tool escalation

**Target Files**: `tests/redteam/rag/*.spec.ts`, `tests/redteam/tools/*.spec.ts`, `tests/redteam/security/*.spec.ts`
**Related Files**: `lib/app/rag/retrieval-policy.ts`, `lib/app/tools/execution-provider.ts`

#### [ ] CC-015-4: Build CI workflows and local release-gate scripts

**Target Files**: `.github/workflows/ci.yml`, `scripts/release/run-gate.ts`
**Related Files**: `package.json`, `scripts/eval/`, `scripts/bench/`

#### [ ] CC-015-5: Store benchmark outputs and regression reports as versioned artifacts

**Target Files**: `artifacts/.gitkeep`, `scripts/release/write-report.ts`
**Related Files**: `scripts/release/run-gate.ts`, `docs/release/gates.md`

#### [ ] CC-015-6: Document the release checklist, failure policy, and test ownership

**Target Files**: `docs/release/checklist.md`, `docs/release/failure-policy.md`
**Related Files**: `.github/workflows/ci.yml`, `scripts/release/run-gate.ts`

#### [ ] CC-015-7: Run full-system smoke tests against a seeded local workspace

**Target Files**: `scripts/smoke/full-system.ts`, `tests/fixtures/workspace/`
**Related Files**: `scripts/db/seed.ts`, `scripts/check-runtime.ts`

---

## [ ] CC-016: Package the Local-Server Product, Write Operator Documentation, and Launch v1

### Definition of Done

- [ ] Production build and start scripts work on a clean target machine with documented prerequisites.
- [ ] A first-run preflight checks environment, runtime reachability, writable storage, and default security posture.
- [ ] Operator docs cover installation, configuration, backup/restore, troubleshooting, and supported workflows.
- [ ] A sample workspace and seeded demo corpus allow quick validation after install.
- [ ] The v1 launch checklist is completed with links to release artifacts, docs, and gate reports.

### Out of Scope

- Tauri packaging
- App store distribution
- Enterprise multi-user deployment support
- Plugin marketplace or extension SDK
- Major post-v1 runtime adapters

### Strict Rules to Follow

- Package the canonical local-server Next.js product first, not the deferred Tauri path.
- Ship first-run diagnostics and a sample workspace so operators can validate installs quickly.
- Document exact supported OS/runtime assumptions rather than implying broad compatibility.
- Keep packaging simple and reproducible; do not remove required server capabilities to fit a wrapper.
- Do not cut a v1 release until release gates, backup drills, and security checks are green.

### Existing Code Patterns

```ts
export async function preflight() {
  return {
    node: process.version,
    ollama: await pingOllama(),
    dbWritable: await canWrite(env.DATABASE_URL),
    lancedbWritable: await canWrite(env.LANCEDB_DIR),
  }
}
```

### Advanced Code Patterns

```ts
export async function runFirstStartWizard() {
  const checks = await preflight()
  if (!checks.ollama.ok) throw new Error('Ollama is not reachable')
  await ensureSeedWorkspace()
  await writeLaunchMarker({ launchedAt: new Date().toISOString() })
  return checks
}
```

### Anti-Patterns

- ❌ Repackaging the app into Tauri before the local-server product is operationally stable
- ❌ Shipping without install docs or a supported-environment statement
- ❌ Relying on tribal knowledge for backup/restore or troubleshooting
- ❌ Publishing a release without a seeded validation path
- ❌ Treating launch as complete when only the build artifact exists

---

## Subtasks

#### [ ] CC-016-1: Create production build, start, and preflight scripts

**Target Files**: `package.json`, `scripts/preflight.ts`, `scripts/release/build-prod.ts`
**Related Files**: `README.md`, `lib/config/env.ts`

#### [ ] CC-016-2: Build first-run diagnostics and sample-workspace initialization

**Target Files**: `lib/app/services/first-run.ts`, `scripts/seed/sample-workspace.ts`
**Related Files**: `scripts/preflight.ts`, `tests/fixtures/workspace/`

#### [ ] CC-016-3: Write operator and admin documentation

**Target Files**: `README.md`, `docs/operator-guide.md`, `docs/troubleshooting.md`
**Related Files**: `docs/security/operator-checklist.md`, `docs/backup/recovery-playbook.md`

#### [ ] CC-016-4: Create release notes, changelog, and versioning templates

**Target Files**: `CHANGELOG.md`, `docs/release/release-template.md`
**Related Files**: `package.json`, `docs/release/checklist.md`

#### [ ] CC-016-5: Package a sample dataset/demo corpus for quick-start validation

**Target Files**: `examples/demo-corpus/`, `scripts/seed/demo-corpus.ts`
**Related Files**: `tests/fixtures/documents/`, `docs/operator-guide.md`

#### [ ] CC-016-6: Run packaging smoke tests on supported environments and record outcomes

**Target Files**: `scripts/smoke/package-smoke.ts`, `docs/release/platform-smoke-results.md`
**Related Files**: `scripts/release/run-gate.ts`, `scripts/preflight.ts`

#### [ ] CC-016-7: Execute the v1 launch checklist and publish the release bundle

**Target Files**: `docs/release/v1-launch-checklist.md`
**Related Files**: `CHANGELOG.md`, `docs/release/platform-smoke-results.md`, `artifacts/`

---

## Implementation Priority

1. **CC-001**: Bootstrap the Repository, Toolchain, and Delivery Standards (All later work depends on a stable scaffold, typed config, and repeatable local setup.)
2. **CC-002**: Build the App Shell, Route Topology, and UI Foundations (The shell defines how every subsystem surfaces in the product and prevents UI rework later.)
3. **CC-003**: Implement the Runtime Adapter, Ollama Integration, and Diagnostics (Nothing useful ships until the app can reliably talk to the local runtime and explain failures.)
4. **CC-004**: Establish the Persistence Layer, Core Schema, and Settings System (The core data model must exist before chat, RAG, tools, jobs, and prompt ops can persist state correctly.)
5. **CC-005**: Deliver Streaming Chat, Conversation Persistence, and Context Budgeting (Interactive chat is the first end-user value and the base primitive for later RAG and agent work.)
6. **CC-006**: Add Model Profiles, Routing Policies, and Structured Output Utilities (Routing and structured outputs strengthen chat quality and prepare the orchestration layer.)
7. **CC-007**: Create the Document Ingestion Pipeline and Index Lifecycle (The corpus must exist before retrieval, citations, and grounded RAG answers can work.)
8. **CC-008**: Implement Retrieval, Hybrid Search, Citations, and the RAG User Experience (This turns indexed content into user-visible value and enables evidence-backed responses.)
9. **CC-009**: Build the Tool Registry, Approval Gates, and Execution Sandbox (Safe tool primitives are required before any meaningful agent behavior should be enabled.)
10. **CC-010**: Implement the Agent Runner, Job Queue, and Auditability Layer (Queue-backed agent execution unlocks long-running work safely and makes automation inspectable.)
11. **CC-011**: Add Monitoring, Structured Logging, and Operational Dashboards (Operational maturity and debuggability become mandatory as concurrency and background work increase.)
12. **CC-012**: Implement Prompt Templates, Experiments, and the Evaluation Harness (Prompt ops and evals prevent configuration drift and unsafe regressions as behavior expands.)
13. **CC-013**: Harden Security, Local Auth, and Network Isolation (Security controls should be added before wider distribution or shared-machine use.)
14. **CC-014**: Implement Import/Export, Backup, and Recovery Workflows (Local-first software must protect user state before release and before real datasets accumulate.)
15. **CC-015**: Build the Test Suite, Benchmarks, Red-Team Coverage, and Release Gates (Release confidence depends on executable verification, not architecture prose.)
16. **CC-016**: Package the Local-Server Product, Write Operator Documentation, and Launch v1 (Packaging and launch belong at the end, once the product is stable, tested, and recoverable.)

## Notes

- Because the repository is currently document-first, the **Existing Code Patterns** sections reference the seed interfaces and route shapes from the canonical master guide. They are the baseline patterns the first implementation should preserve or refine.
- Use the master guide as the source of truth for architecture. If implementation discovers a better path, add a new ADR before broadening the change.
- Do not parallelize schema-heavy work (persistence, jobs, prompts, retrieval metadata) without coordinating migrations and fixture updates.
- Keep every major subsystem independently smoke-testable: runtime, chat, ingestion, retrieval, tools, jobs, monitoring, and backup/restore.
- Tauri packaging remains a post-v1 exploration track and should not block the local-server implementation plan.
